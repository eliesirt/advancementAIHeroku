import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { transcribeAudio, extractInteractionInfo, enhanceInteractionComments, type ExtractedInteractionInfo } from "./lib/openai";
import { bbecClient, type BBECInteractionSubmission } from "./lib/soap-client";
import { createAffinityMatcher } from "./lib/affinity-matcher";
import { affinityTagScheduler } from "./lib/scheduler";
import { insertInteractionSchema, insertVoiceRecordingSchema, insertItinerarySchema, insertItineraryMeetingSchema } from "@shared/schema";
import fetch from 'node-fetch';
import { z } from "zod";
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

// Dynamic auth import function
async function getAuthModule() {
  const isHerokuDeployment = process.env.NODE_ENV === 'production' && 
    (process.env.HEROKU_APP_NAME || !process.env.REPLIT_DOMAINS || !process.env.REPL_ID);

  if (isHerokuDeployment) {
    return await import("./herokuAuth");
  } else {
    return await import("./replitAuth");
  }
}
import { seedInitialData } from "./seedData";
import OpenAI from "openai";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// AI Model Configuration - Easy toggle between GPT-4 and GPT-5
const AI_MODELS = {
  ANALYSIS: "gpt-4",      // For code analysis
  COMMENTING: "gpt-4",    // For adding comments
  GENERATION: "gpt-5",    // For script generation - TOGGLE: Change to "gpt-4" to revert
} as const;

// Helper function to get current matching threshold
async function getMatchingThreshold(): Promise<number> {
  try {
    const settings = await storage.getAffinityTagSettings();
    console.log("🎯 THRESHOLD DEBUG: Retrieved settings:", settings);
    const threshold = settings?.matchingThreshold || 25;
    const convertedThreshold = threshold / 100;
    console.log("🎯 THRESHOLD DEBUG: Raw threshold:", threshold, "Converted:", convertedThreshold);
    return convertedThreshold;
  } catch (error) {
    console.warn("Failed to get matching threshold, using default:", error);
    return 0.25; // Default threshold
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Get auth module based on environment
  const { setupAuth, isAuthenticated } = await getAuthModule();
  // Helper for admin check - assuming 'isAdmin' is defined elsewhere or this is a placeholder
  // In a real scenario, isAdmin would be a middleware checking user roles.
  // For this context, we'll define a placeholder.
  const isAdmin = async (req: any, res: any, next: any) => {
    // Placeholder for actual admin check
    // In a real app, this would verify if req.user has admin privileges
    const userId = req.user?.claims?.sub;
    if (userId) {
      const user = await storage.getUserWithRoles(userId);
      if (user?.roles?.some(role => role.name === "Administrator")) {
        return next();
      }
    }
    res.status(403).json({ message: "Admin access required" });
  };


  // Auth middleware
  await setupAuth(app);

  // Seed initial data
  try {
    await seedInitialData();
  } catch (error) {
    console.warn("Failed to seed initial data:", error);
  }

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUserWithRoles(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Applications endpoint
  app.get('/api/applications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;



      const applications = await storage.getUserApplications(userId);

      // Debug logging for Heroku deployment issue
      console.log(`📱 Applications for user ${userId} (count: ${applications.length}):`);
      applications.forEach((app, index) => {
        console.log(`  ${index + 1}. ${app.displayName} (sortOrder: ${app.sortOrder ?? 'undefined'})`);
      });

      // Add cache-busting headers to ensure fresh data and force 200 response
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'ETag': Date.now().toString() // Force fresh response by changing ETag
      });

      res.json(applications);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  // Get current user (legacy endpoint - deprecated)
  app.get("/api/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to get user", error: (error as Error).message });
    }
  });

  // Get dashboard stats
  app.get("/api/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      const allInteractions = await storage.getInteractionsByUser(userId);
      const todayInteractions = allInteractions.filter(i => i.createdAt >= today).length;
      const thisWeekInteractions = allInteractions.filter(i => i.createdAt >= weekAgo).length;
      const pendingInteractions = (await storage.getPendingInteractions(userId)).length;

      res.json({
        todayInteractions,
        thisWeekInteractions,
        pendingInteractions
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get stats", error: (error as Error).message });
    }
  });

  // Get recent interactions
  app.get("/api/interactions/recent", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const limit = parseInt(req.query.limit as string) || 10;
      const interactions = await storage.getRecentInteractions(userId, limit);
      res.json(interactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to get recent interactions", error: (error as Error).message });
    }
  });

  // Get all interactions for a user
  app.get("/api/interactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const interactions = await storage.getInteractionsByUser(userId);
      res.json(interactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to get interactions", error: (error as Error).message });
    }
  });

  // Get draft interactions
  app.get("/api/interactions/drafts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const drafts = await storage.getDraftInteractions(userId);
      res.json(drafts);
    } catch (error) {
      res.status(500).json({ message: "Failed to get draft interactions", error: (error as Error).message });
    }
  });

  // Create voice recording
  app.post("/api/voice-recordings", isAuthenticated, async (req: any, res) => {
    try {
      console.log("Voice recording data received:", req.body);

      const userId = req.user.claims.sub;
      const recordingData = {
        userId: userId,
        audioData: req.body.audioData,
        transcript: req.body.transcript || null,
        duration: Number(req.body.duration) || null,
        processed: false,
        interactionId: req.body.interactionId || null
      };

      console.log("Processed recording data:", recordingData);
      const recording = await storage.createVoiceRecording(recordingData);
      res.json(recording);
    } catch (error) {
      console.error("Voice recording error:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to save voice recording", error: (error as Error).message });
    }
  });

  // Process voice recording directly without creating interaction draft first
  app.post("/api/voice-recordings/process-direct", isAuthenticated, async (req: any, res) => {
    try {
      console.log("🎙️ Voice recording processing started");
      const { transcript, audioData, duration } = req.body;

      console.log("Voice processing request data:", { 
        hasTranscript: !!transcript, 
        transcriptLength: transcript?.length || 0,
        transcriptSample: transcript?.substring(0, 50) || 'EMPTY',
        hasAudioData: !!audioData,
        audioDataLength: audioData?.length || 0,
        audioDataSample: audioData?.substring(0, 50) || 'EMPTY',
        duration,
        userId: req.user?.claims?.sub,
        bodyKeys: Object.keys(req.body || {}),
        contentType: req.headers['content-type']
      });

      let finalTranscript = transcript;

      // If no transcript from speech recognition, use OpenAI Whisper to transcribe the audio
      if (!transcript || transcript.trim().length === 0) {
        console.log("No browser transcript available, using OpenAI Whisper for transcription...");

        if (!audioData || audioData.length === 0) {
          return res.status(400).json({ 
            message: "Recording failed - no audio or transcript captured",
            suggestion: "Please ensure microphone permissions are enabled and speak clearly during recording" 
          });
        }

        try {
          console.log("Starting OpenAI Whisper transcription...");
          const { transcribeAudio } = await import("./lib/openai");
          finalTranscript = await transcribeAudio(audioData);

          console.log("OpenAI Whisper transcription completed:", { 
            transcriptLength: finalTranscript.length
          });

        } catch (whisperError) {
          console.error("OpenAI Whisper transcription failed:", whisperError);
          return res.status(500).json({ 
            message: "Voice transcription service temporarily unavailable", 
            error: "Please try speaking more clearly or check your microphone settings",
            technical: process.env.NODE_ENV === 'development' ? (whisperError as Error).message : undefined
          });
        }
      }

      if (!finalTranscript || finalTranscript.trim().length === 0) {
        console.log("No transcript generated from either browser or OpenAI Whisper");
        return res.status(400).json({ 
          message: "Voice recording could not be processed", 
          suggestion: "Please ensure you speak clearly and have a stable internet connection. Try recording again with better audio quality."
        });
      }

      // Generate concise summary
      console.log("📝 Generating concise summary...");
      const { generateConciseSummary } = await import("./lib/openai");
      const conciseSummary = await generateConciseSummary(finalTranscript);
      console.log("✅ Concise summary generated");

      // Extract interaction information
      console.log("🔍 Extracting interaction information...");
      const extractedInfo: ExtractedInteractionInfo = await extractInteractionInfo(finalTranscript) || {
          summary: '',
          category: '',
          subcategory: '',
          contactLevel: 'Initial Contact',
          professionalInterests: [],
          personalInterests: [],
          philanthropicPriorities: [],
          keyPoints: [],
          suggestedAffinityTags: [],
          prospectName: ''
        };

      // Match interests to affinity tags
      console.log("🎯 ROUTES.TS: Loading affinity tags and matcher...");
      const affinityTags = await storage.getAffinityTags();
      console.log("🎯 ROUTES.TS: Loaded affinity tags:", affinityTags.length);
      const threshold = await getMatchingThreshold();
      console.log("🎯 ROUTES.TS: Got threshold:", threshold);
      const affinityMatcher = await createAffinityMatcher(affinityTags, threshold);
      console.log("🎯 ROUTES.TS: Created affinity matcher successfully");

      const professionalInterests = Array.isArray(extractedInfo.professionalInterests) ? extractedInfo.professionalInterests : [];
      const personalInterests = Array.isArray(extractedInfo.personalInterests) ? extractedInfo.personalInterests : [];
      const philanthropicPriorities = Array.isArray(extractedInfo.philanthropicPriorities) ? extractedInfo.philanthropicPriorities : [];

      console.log("🎯 ROUTES.TS: Starting affinity matching with:", {
        affinityTagCount: affinityTags.length,
        threshold,
        professionalCount: professionalInterests.length,
        personalCount: personalInterests.length,
        philanthropicCount: philanthropicPriorities.length,
        transcriptLength: finalTranscript.length
      });

      const matchedTags = affinityMatcher.matchInterests(
        professionalInterests,
        personalInterests,
        philanthropicPriorities,
        finalTranscript  // Use raw transcript for additional direct matching
      );
      const suggestedAffinityTags = matchedTags.map(match => match.tag.name);

      console.log("🎯 ROUTES.TS: Affinity matching completed:", {
        matchedCount: matchedTags.length,
        suggestedTags: suggestedAffinityTags
      });

      // Generate enhanced comments with full synopsis and transcript
      const userId = req.user.claims.sub;
      const enhancedComments = await enhanceInteractionComments(finalTranscript, extractedInfo, userId);

      // Perform quality assessment
      console.log("📊 Evaluating interaction quality...");
      let qualityAssessment = null;
      try {
        const { evaluateInteractionQuality } = await import("./lib/openai");
        qualityAssessment = await evaluateInteractionQuality(
          finalTranscript,
          extractedInfo,
          {
            prospectName: extractedInfo.prospectName || '',
            firstName: '',
            lastName: '',
            contactLevel: extractedInfo.contactLevel || '',
            method: 'Voice Recording',
            actualDate: new Date().toISOString(),
            comments: enhancedComments,
            summary: extractedInfo.summary || conciseSummary,
            category: extractedInfo.category || '',
            subcategory: extractedInfo.subcategory || ''
          }
        );
        console.log("✅ Quality assessment completed - Score:", qualityAssessment.qualityScore + "/25");
      } catch (qualityError) {
        console.error("Quality assessment failed:", qualityError);
        // Don't fail the entire process if quality assessment fails
      }

      console.log("✅ Voice processing completed successfully");
      res.json({
        transcript: finalTranscript,
        extractedInfo: {
          ...extractedInfo,
          suggestedAffinityTags
        },
        conciseSummary,
        enhancedComments,
        qualityAssessment
      });
    } catch (error) {
      console.error("❌ Direct voice processing error:", error);
      console.error("Error stack:", error instanceof Error ? error.stack : 'No stack trace');

      // Check if it's a specific type of error
      if (error instanceof Error) {
        if (error.message.includes('OPENAI_API_KEY')) {
          return res.status(500).json({ 
            message: "OpenAI API configuration error", 
            error: "OpenAI API key not properly configured" 
          });
        }
        if (error.message.includes('audio') || error.message.includes('transcription')) {
          return res.status(500).json({ 
            message: "Audio transcription failed", 
            error: error.message 
          });
        }
      }

      res.status(500).json({ 
        message: "Failed to process voice recording", 
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        details: process.env.NODE_ENV === 'development' ? error : undefined
      });
    }
  });

  // Process voice recording (transcribe and extract info)
  app.post("/api/voice-recordings/:id/process", async (req, res) => {
    try {
      const recordingId = parseInt(req.params.id);
      const recording = await storage.getVoiceRecording(recordingId);

      if (!recording) {
        return res.status(404).json({ message: "Voice recording not found" });
      }

      if (!recording.audioData) {
        return res.status(400).json({ message: "No audio data to process" });
      }

      // Transcribe audio
      const transcript = await transcribeAudio(recording.audioData);

      // Generate concise summary
      const { generateConciseSummary } = await import("./lib/openai");
      const conciseSummary = await generateConciseSummary(transcript);

      // Extract interaction information
      const extractedInfo: ExtractedInteractionInfo = await extractInteractionInfo(transcript) || {
          summary: '',
          category: '',
          subcategory: '',
          contactLevel: 'Initial Contact',
          professionalInterests: [],
          personalInterests: [],
          philanthropicPriorities: [],
          keyPoints: [],
          suggestedAffinityTags: [],
          prospectName: ''
        };

      // Match interests to affinity tags
      const affinityTags = await storage.getAffinityTags();
      const threshold = await getMatchingThreshold();
      const affinityMatcher = await createAffinityMatcher(affinityTags, threshold);

      const professionalInterests = Array.isArray(extractedInfo.professionalInterests) ? extractedInfo.professionalInterests : [];
      const personalInterests = Array.isArray(extractedInfo.personalInterests) ? extractedInfo.personalInterests : [];
      const philanthropicPriorities = Array.isArray(extractedInfo.philanthropicPriorities) ? extractedInfo.philanthropicPriorities : [];

      const matchedTags = affinityMatcher.matchInterests(
        professionalInterests,
        personalInterests,
        philanthropicPriorities
      );
      const suggestedAffinityTags = matchedTags.map(match => match.tag.name);

      console.log("Extracted interests:", { professionalInterests, personalInterests, philanthropicPriorities });
      console.log("Matched affinity tags:", suggestedAffinityTags);

      // Update recording with transcript and processed data
      await storage.updateVoiceRecording(recordingId, {
        transcript,
        processed: true
      });

      // Generate enhanced comments with full synopsis and transcript
      const enhancedComments = await enhanceInteractionComments(transcript, extractedInfo, 1);

      res.json({
        transcript,
        extractedInfo: {
          ...extractedInfo,
          suggestedAffinityTags
        },
        conciseSummary,
        enhancedComments
      });
    } catch (error) {
      console.error("Voice processing error details:", error);
      res.status(500).json({ message: "Failed to process voice recording", error: (error as Error).message });
    }
  });

  // Create draft interaction (minimal validation)
  app.post("/api/interactions/draft", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const draftData = {
        userId: userId,
        prospectName: req.body.prospectName || 'Draft Interaction',
        summary: req.body.summary || 'Draft summary',
        category: req.body.category || 'General',
        subcategory: req.body.subcategory || 'Other',
        contactLevel: req.body.contactLevel || 'Initial Contact',
        method: req.body.method || 'In Person',
        status: 'Draft',
        actualDate: req.body.actualDate ? new Date(req.body.actualDate) : new Date(),
        comments: req.body.comments || null,
        transcript: req.body.transcript || null,
        affinityTags: req.body.affinityTags || [],
        extractedInfo: req.body.extractedInfo,
        qualityScore: req.body.qualityScore || null,
        qualityExplanation: req.body.qualityExplanation || null,
        qualityRecommendations: req.body.qualityRecommendations || null,
        isDraft: true,
        bbecSubmitted: false
      };

      console.log("Creating draft with data:", draftData);
      const interaction = await storage.createInteraction(draftData);
      console.log("Draft created successfully:", interaction);
      res.json(interaction);
    } catch (error) {
      console.error("Draft creation error:", error);
      res.status(500).json({ message: "Failed to create draft", error: (error as Error).message });
    }
  });

  // Create interaction from processed voice/text
  app.post("/api/interactions", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const interactionData = insertInteractionSchema.parse({
        ...req.body,
        userId: userId
      });
      const interaction = await storage.createInteraction(interactionData);
      res.json(interaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create interaction", error: (error as Error).message });
    }
  });

  // Submit interaction to BBEC and remove from local database
  app.post("/api/interactions/:id/submit-bbec", async (req, res) => {
    try {
      const interactionId = parseInt(req.params.id);
      const interaction = await storage.getInteraction(interactionId);

      if (!interaction) {
        return res.status(404).json({ message: "Interaction not found" });
      }

      // Get the user's BBEC GUID for the fundraiser ID
      const user = await storage.getUser(interaction.userId);
      if (!user?.bbecGuid) {
        return res.status(400).json({ 
          message: "User missing BBEC GUID - please update your profile in Settings" 
        });
      }

      // Check if interaction has constituent GUID, fallback to bbecGuid if available
      let constituentGuid = interaction.constituentGuid;
      if (!constituentGuid && interaction.bbecGuid) {
        // Update the interaction to use bbecGuid as constituentGuid
        constituentGuid = interaction.bbecGuid;
        await storage.updateInteraction(interactionId, { constituentGuid });
      }

      if (!constituentGuid) {
        return res.status(400).json({ 
          message: "Interaction missing constituent GUID - please select a constituent first" 
        });
      }

      // Prepare interaction data for BBEC submission
      const bbecInteraction: BBECInteractionSubmission = {
        constituentId: constituentGuid,
        interactionBbecGuid: interaction.bbecGuid || '',
        prospectName: interaction.prospectName,
        contactLevel: interaction.contactLevel,
        method: interaction.method,
        summary: interaction.summary,
        category: interaction.category,
        subcategory: interaction.subcategory,
        status: interaction.status,
        actualDate: interaction.actualDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
        owner: "sarah.thompson",
        comments: interaction.comments || undefined,
        affinityTags: interaction.affinityTags || undefined,
        fundraiserGuid: user.bbecGuid // Add the user's BBEC GUID as fundraiser ID
      };

      console.log("Submitting interaction to BBEC:", bbecInteraction);

      // Submit to BBEC
      const bbecInteractionId = await bbecClient.submitInteraction(bbecInteraction);

      // If submission successful (no error thrown), remove from local database
      const deleted = await storage.deleteInteraction(interactionId);

      if (!deleted) {
        console.warn(`BBEC submission succeeded but failed to delete local interaction ${interactionId}`);
      }

      res.json({ 
        success: true, 
        bbecInteractionId,
        message: "Interaction submitted to BBEC and removed from local database"
      });

    } catch (error) {
      console.error("BBEC submission error:", error);
      res.status(500).json({ 
        message: "Failed to submit interaction to BBEC", 
        error: (error as Error).message 
      });
    }
  });

  // Update interaction
  app.put("/api/interactions/:id", async (req, res) => {
    try {
      const interactionId = parseInt(req.params.id);
      const updates = insertInteractionSchema.partial().parse(req.body);
      const interaction = await storage.updateInteraction(interactionId, updates);
      res.json(interaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update interaction", error: (error as Error).message });
    }
  });

  // Update interaction (PATCH method)
  app.patch("/api/interactions/:id", async (req, res) => {
    try {
      const interactionId = parseInt(req.params.id);
      console.log("PATCH request body:", JSON.stringify(req.body, null, 2));

      // Handle reprocessAffinity flag separately since it's not part of schema
      const reprocessAffinity = req.body.reprocessAffinity;

      const updates = insertInteractionSchema.partial().parse(req.body);

      // Preserve quality scores when saving as draft (don't clear them)
      const currentInteraction = await storage.getInteraction(interactionId);
      if (updates.isDraft === true && updates.status === 'Draft') {
        if (currentInteraction && currentInteraction.qualityScore && !updates.qualityScore) {
          updates.qualityScore = currentInteraction.qualityScore;
          updates.qualityExplanation = currentInteraction.qualityExplanation;
          updates.qualityRecommendations = currentInteraction.qualityRecommendations;
        }
      }

      // Force quality assessment if quality score is null (for testing recommendations)
      if (!currentInteraction?.qualityScore && updates.status === 'Complete') {
        try {
          const { evaluateInteractionQuality } = await import("./lib/openai");

          // Create basic extracted info for quality assessment
          const extractedInfo: ExtractedInteractionInfo = {
              summary: '',
              category: '',
              subcategory: '',
              contactLevel: 'Initial Contact',
              professionalInterests: [],
              personalInterests: [],
              philanthropicPriorities: [],
              keyPoints: [],
              suggestedAffinityTags: [],
              prospectName: ''
            };

          const qualityAssessment = await evaluateInteractionQuality(
              currentInteraction?.transcript || updates.comments || '',
              extractedInfo,
              {
                prospectName: updates.prospectName || currentInteraction?.prospectName || '',
                firstName: updates.firstName || currentInteraction?.firstName || '',
                lastName: updates.lastName || currentInteraction?.lastName || '',
                contactLevel: updates.contactLevel || currentInteraction?.contactLevel || '',
                method: updates.method || currentInteraction?.method || '',
                actualDate: updates.actualDate?.toString() || currentInteraction?.actualDate?.toISOString() || '',
                comments: updates.comments || currentInteraction?.comments || '',
                summary: updates.summary || currentInteraction?.summary || '',
                category: updates.category || currentInteraction?.category || '',
                subcategory: updates.subcategory || currentInteraction?.subcategory || ''
              }
            );

            updates.qualityScore = qualityAssessment.qualityScore;
            updates.qualityExplanation = qualityAssessment.qualityExplanation;
            updates.qualityRecommendations = qualityAssessment.recommendations;
        } catch (error) {
          console.error('Quality assessment error during update:', error);
          // Don't fail the update if quality assessment fails
        }
      }

      // Special handling for affinity reprocessing
      if (reprocessAffinity && currentInteraction?.extractedInfo) {
        try {
          // Parse the existing extracted info
          const extractedInfo = JSON.parse(typeof currentInteraction.extractedInfo === 'string' ? currentInteraction.extractedInfo : JSON.stringify(currentInteraction.extractedInfo)) as ExtractedInteractionInfo;

          // Match interests to affinity tags with improved logic
          const affinityTags = await storage.getAffinityTags();
          const { createAffinityMatcher } = await import("./lib/affinity-matcher");
          const threshold = await getMatchingThreshold();
          const affinityMatcher = await createAffinityMatcher(affinityTags, threshold);

          const professionalInterests = Array.isArray(extractedInfo.professionalInterests) ? extractedInfo.professionalInterests : [];
          const personalInterests = Array.isArray(extractedInfo.personalInterests) ? extractedInfo.personalInterests : [];
          const philanthropicPriorities = Array.isArray(extractedInfo.philanthropicPriorities) ? extractedInfo.philanthropicPriorities : [];

          const matchedTags = affinityMatcher.matchInterests(
            professionalInterests,
            personalInterests,
            philanthropicPriorities
          );

          const suggestedAffinityTags = matchedTags.map(match => match.tag.name);

          // Update the affinity tags
          updates.affinityTags = suggestedAffinityTags;

        } catch (error) {
          console.error('Affinity reprocessing error:', error);
          // Don't fail the update if affinity reprocessing fails
        }
      }

      // If this is a manual submission (not a draft) OR completing a draft, evaluate quality
      if ((!updates.isDraft && updates.status !== 'Draft') || (updates.isDraft === false && updates.status === 'Complete')) {
        try {
          // Check if we have enough data to evaluate quality
          if (currentInteraction && (currentInteraction.transcript || updates.comments || currentInteraction.comments)) {
            const { evaluateInteractionQuality } = await import("./lib/openai");

            // Create mock extracted info if not available
            const extractedInfo: ExtractedInteractionInfo = typeof currentInteraction.extractedInfo === 'string' 
              ? JSON.parse(currentInteraction.extractedInfo)
              : (currentInteraction.extractedInfo as ExtractedInteractionInfo) || {
                  summary: '',
                  category: '',
                  subcategory: '',
                  contactLevel: 'Initial Contact',
                  professionalInterests: [],
                  personalInterests: [],
                  philanthropicPriorities: [],
                  keyPoints: [],
                  suggestedAffinityTags: [],
                  prospectName: ''
                };

            const qualityAssessment = await evaluateInteractionQuality(
              currentInteraction.transcript || updates.comments || currentInteraction.comments || '',
              extractedInfo,
              {
                prospectName: updates.prospectName || currentInteraction.prospectName || '',
                firstName: updates.firstName || currentInteraction.firstName || '',
                lastName: updates.lastName || currentInteraction.lastName || '',
                contactLevel: updates.contactLevel || currentInteraction.contactLevel || '',
                method: updates.method || currentInteraction.method || '',
                actualDate: updates.actualDate?.toString() || currentInteraction.actualDate?.toISOString() || '',
                comments: updates.comments || currentInteraction.comments || '',
                summary: updates.summary || currentInteraction.summary || '',
                category: updates.category || currentInteraction.category || '',
                subcategory: updates.subcategory || currentInteraction.subcategory || ''
              }
            );

            // Add quality assessment to updates
            updates.qualityScore = qualityAssessment.qualityScore;
            updates.qualityExplanation = qualityAssessment.qualityExplanation;
            updates.qualityRecommendations = qualityAssessment.recommendations;
          }
        } catch (qualityError) {
          console.warn("Quality assessment failed:", qualityError);
          // Continue with update even if quality assessment fails
        }
      }

      updates.firstName = req.body.firstName || undefined;
      updates.lastName = req.body.lastName || undefined;
      updates.buid = req.body.buid || undefined;

      const interaction = await storage.updateInteraction(interactionId, updates);
      res.json(interaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log("Validation errors:", error.errors);
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.log("Update error:", error);
      res.status(500).json({ message: "Failed to update interaction", error: (error as Error).message });
    }
  });

  // Submit interaction to BBEC
  app.post("/api/interactions/:id/submit-bbec", async (req, res) => {
    try {
      const interactionId = parseInt(req.params.id);
      const interaction = await storage.getInteraction(interactionId);

      if (!interaction) {
        return res.status(404).json({ message: "Interaction not found" });
      }

      if (interaction.bbecSubmitted) {
        return res.status(400).json({ message: "Interaction already submitted to BBEC" });
      }

      // Get the user's BBEC GUID for the fundraiser ID
      const user = await storage.getUser(interaction.userId);
      if (!user?.bbecGuid) {
        return res.status(400).json({ 
          message: `User missing BBEC GUID for interaction ${interaction.id}` 
        });
      }

      // Submit to BBEC via SOAP API using the proper workflow
      const bbecInteractionId = await bbecClient.submitInteraction({
        constituentId: "", // Will be determined by searchConstituent
        interactionBbecGuid: interaction.bbecGuid || "",
        prospectName: interaction.prospectName || "Unknown",
        contactLevel: interaction.contactLevel,
        method: interaction.method,
        summary: interaction.summary,
        category: interaction.category,
        subcategory: interaction.subcategory,
        status: interaction.status,
        actualDate: interaction.actualDate.toISOString().split('T')[0],
        owner: "sarah.thompson",
        comments: interaction.comments || "",
        affinityTags: interaction.affinityTags || [],
        fundraiserGuid: user.bbecGuid
      });

      // Update interaction as submitted
      const updatedInteraction = await storage.updateInteraction(interactionId, {
        bbecSubmitted: true,
        bbecInteractionId
      });

      res.json({ 
        success: true, 
        bbecInteractionId,
        interaction: updatedInteraction 
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to submit to BBEC", error: (error as Error).message });
    }
  });

  // Delete interaction
  app.delete("/api/interactions/:id", async (req, res) => {
    try {
      const interactionId = parseInt(req.params.id);
      console.log(`🗑️ Attempting to delete interaction: ${interactionId}`);

      // Check if interaction exists first
      const existingInteraction = await storage.getInteraction(interactionId);
      if (!existingInteraction) {
        console.log(`❌ Interaction ${interactionId} not found`);
        return res.status(404).json({ success: false, message: "Interaction not found" });
      }

      const success = await storage.deleteInteraction(interactionId);
      console.log(`🔍 Delete operation result for ${interactionId}:`, success, typeof success);

      if (success) {
        console.log(`✅ Interaction ${interactionId} deleted successfully`);
        res.json({ success: true, message: "Interaction deleted successfully" });
      } else {
        console.log(`❌ Delete operation failed for interaction ${interactionId}`);
        res.status(500).json({ success: false, message: "Delete operation failed" });
      }
    } catch (error) {
      console.error(`❌ Delete interaction error for ID ${req.params.id}:`, error);
      res.status(500).json({ message: "Failed to delete interaction", error: (error as Error).message });
    }
  });

  // Bulk delete interactions
  app.delete("/api/interactions", async (req, res) => {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "Invalid interaction IDs provided" });
      }

      const results = await Promise.allSettled(
        ids.map(id => storage.deleteInteraction(parseInt(id)))
      );

      const successCount = results.filter(result => 
        result.status === 'fulfilled' && result.value
      ).length;

      res.json({ 
        success: true, 
        message: `Successfully deleted ${successCount} of ${ids.length} interactions`,
        deletedCount: successCount,
        totalCount: ids.length
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to bulk delete interactions", error: (error as Error).message });
    }
  });

  // Get affinity tags
  app.get("/api/affinity-tags", async (req, res) => {
    try {
      const tags = await storage.getAffinityTags();
      res.json(tags);
    } catch (error) {
      res.status(500).json({ message: "Failed to get affinity tags", error: (error as Error).message });
    }
  });

  // Match affinity tags to interests
  app.post("/api/affinity-tags/match", async (req, res) => {
    try {
      const { professionalInterests, personalInterests, philanthropicPriorities } = req.body;

      if (!Array.isArray(professionalInterests) || !Array.isArray(personalInterests) || !Array.isArray(philanthropicPriorities)) {
        return res.status(400).json({ message: "Invalid interests format" });
      }

      const affinityTags = await storage.getAffinityTags();
      const threshold = await getMatchingThreshold();
      const matcher = await createAffinityMatcher(affinityTags, threshold);

      const matches = matcher.matchInterests(
        professionalInterests,
        personalInterests,
        philanthropicPriorities
      );

      res.json(matches);
    } catch (error) {
      res.status(500).json({ message: "Failed to match affinity tags", error: (error as Error).message });
    }
  });

  // Refresh affinity tags from BBEC (manual trigger)
  app.post("/api/affinity-tags/refresh", async (req, res) => {
    try {
      // Refresh BBEC client credentials before attempting API call
      bbecClient.refreshCredentials();

      // Clear existing affinity tags before refreshing
      await storage.clearAffinityTags();

      const bbecTags = await bbecClient.getAffinityTags();

      const tagsToInsert = bbecTags.map(tag => ({
        name: tag.name,
        category: tag.category,
        bbecId: tag.bbecId
      }));

      await storage.updateAffinityTags(tagsToInsert);

      res.json({ 
        success: true, 
        synced: tagsToInsert.length,
        total: tagsToInsert.length,
        lastRefresh: new Date().toISOString(),
        message: `Refreshed ${tagsToInsert.length} affinity tags from BBEC` 
      });
    } catch (error) {
      console.error('Detailed refresh error:', error);
      const errorMessage = (error as Error).message;

      if (errorMessage.includes('401') || errorMessage.includes('Authentication failed')) {
        res.status(401).json({ 
          message: "Authentication failed. Please update your BLACKBAUD_API_AUTHENTICATION credentials.", 
          error: "Invalid or expired authentication credentials"
        });
      } else {
        res.status(500).json({ 
          message: "Failed to refresh affinity tags from BBEC", 
          error: errorMessage 
        });
      }
    }
  });

  // Test BBEC connection and credentials
  app.get("/api/bbec/test-connection", async (req, res) => {
    try {
      const authHeader = process.env.BLACKBAUD_API_AUTHENTICATION || "";
      const apiUrl = 'https://crm30656d.sky.blackbaud.com/7d6e1ca0-9d84-4282-a36c-7f5b5b3b90b5/webapi/AppFx.asmx';

      console.log('Testing BBEC connection with auth header format:', authHeader ? `${authHeader.substring(0, 30)}...` : 'EMPTY');

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Host': 'crm30656d.sky.blackbaud.com',
          'Content-Type': 'text/xml; charset=utf-8',
          'Authorization': authHeader,
          'User-Agent': 'NodeJS-BBEC-Client/1.0'
        },
        body: `<?xml version="1.0" encoding="utf-8"?>
          <soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
            <soap:Body>
              <DataListLoadRequest xmlns="Blackbaud.AppFx.WebService.API.1">
                <DataListID>1d1f6c6f-6804-421a-9964-9e3a7fda5727</DataListID>
                <ClientAppInfo REDatabaseToUse="30656d"/>
              </DataListLoadRequest>
            </soap:Body>
          </soap:Envelope>`
      });

      res.json({
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        authHeaderPresent: !!authHeader,
        authHeaderLength: authHeader.length,
        responseHeaders: Object.fromEntries(response.headers.entries())
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        error: (error as Error).message 
      });
    }
  });

  // Get affinity tags info (count, last refresh, etc.)
  app.get("/api/affinity-tags/info", async (req, res) => {
    try {
      const tags = await storage.getAffinityTags();
      const settings = await storage.getAffinityTagSettings();

      res.json({
        total: tags.length,
        lastRefresh: settings?.lastRefresh,
        autoRefresh: settings?.autoRefresh || false,
        refreshInterval: settings?.refreshInterval || 'daily',
        matchingThreshold: settings?.matchingThreshold || 25
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get affinity tags info", error: (error as Error).message });
    }
  });

  // Update affinity tag settings
  app.post("/api/affinity-tags/settings", async (req, res) => {
    try {
      const { autoRefresh, refreshInterval, lastRefresh, totalTags, matchingThreshold } = req.body;

      const settings = {
        autoRefresh: Boolean(autoRefresh),
        refreshInterval: refreshInterval || 'daily',
        lastRefresh: lastRefresh ? new Date(lastRefresh) : null,
        totalTags: totalTags || 0,
        matchingThreshold: typeof matchingThreshold === 'number' ? Math.max(0, Math.min(100, matchingThreshold)) : 25,
        nextRefresh: null
      };

      await storage.updateAffinityTagSettings(settings);

      // Update scheduler based on new settings
      await affinityTagScheduler.updateSchedule(
        settings.autoRefresh, 
        settings.refreshInterval as 'hourly' | 'daily' | 'weekly'
      );

      res.json({ 
        success: true, 
        settings,
        schedulerStatus: affinityTagScheduler.getScheduleStatus(),
        message: "Affinity tag settings updated successfully" 
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to update affinity tag settings", error: (error as Error).message });
    }
  });

  // Get AI prompt settings for user
  app.get("/api/ai-prompt-settings/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      const settings = await storage.getUserAiPromptSettings(userId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to get AI prompt settings", error: (error as Error).message });
    }
  });

  // Get specific AI prompt setting
  app.get("/api/ai-prompt-settings/:userId/:promptType", async (req, res) => {
    try {
      const userId = req.params.userId;
      const { promptType } = req.params;
      const setting = await storage.getAiPromptSettings(userId, promptType);
      res.json(setting || null);
    } catch (error) {
      res.status(500).json({ message: "Failed to get AI prompt setting", error: (error as Error).message });
    }
  });

  // Create or update AI prompt setting
  app.post("/api/ai-prompt-settings", async (req, res) => {
    try {
      const { userId, promptType, promptTemplate } = req.body;

      if (!userId || !promptType || !promptTemplate) {
        return res.status(400).json({ message: "userId, promptType, and promptTemplate are required" });
      }

      // Check if setting already exists
      const existingSetting = await storage.getAiPromptSettings(userId, promptType);

      if (existingSetting) {
        // Update existing
        const updatedSetting = await storage.updateAiPromptSettings(existingSetting.id, {
          promptTemplate
        });
        res.json({ success: true, setting: updatedSetting, message: "AI prompt setting updated successfully" });
      } else {
        // Create new
        const newSetting = await storage.createAiPromptSettings({
          userId,
          promptType,
          promptTemplate,
          isDefault: false
        });
        res.json({ success: true, setting: newSetting, message: "AI prompt setting created successfully" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to save AI prompt setting", error: (error as Error).message });
    }
  });

  // Search constituents in BBEC
  app.get("/api/constituents/search", async (req, res) => {
    try {
      const searchTerm = req.query.q as string;

      if (!searchTerm || searchTerm.length < 2) {
        return res.status(400).json({ message: "Search term must be at least 2 characters" });
      }

      const constituents = await bbecClient.searchConstituent(searchTerm);
      res.json(constituents);
    } catch (error) {
      res.status(500).json({ message: "Failed to search constituents", error: (error as Error).message });
    }
  });

  // Get BBEC form metadata
  app.get("/api/bbec/form-metadata", async (req, res) => {
    try {
      const metadata = await bbecClient.getInteractionFormMetadata();
      res.json(metadata);
    } catch (error) {
      res.status(500).json({ message: "Failed to get form metadata", error: (error as Error).message });
    }
  });

  // Search constituents in BBEC
  app.get("/api/bbec/constituents/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== 'string') {
        return res.status(400).json({ error: 'Search query required' });
      }

      const constituents = await bbecClient.searchConstituent(q);
      res.json(constituents);
    } catch (error) {
      console.error('Constituent search error:', error);
      res.status(500).json({ error: 'Failed to search constituents' });
    }
  });

  // Enhanced comments generation
  app.post("/api/interactions/enhance-comments", async (req, res) => {
    try {
      const { transcript, extractedInfo } = req.body;

      if (!transcript || !extractedInfo) {
        return res.status(400).json({ message: "Transcript and extracted info are required" });
      }

      const enhancedComments = await enhanceInteractionComments(transcript, extractedInfo, 1);
      res.json({ enhancedComments });
    } catch (error) {
      res.status(500).json({ message: "Failed to enhance comments", error: (error as Error).message });
    }
  });

  // Regenerate synopsis for existing interaction
  app.post("/api/interactions/:id/regenerate-synopsis", async (req, res) => {
    try {
      const interactionId = parseInt(req.params.id);
      const interaction = await storage.getInteraction(interactionId);

      if (!interaction) {
        return res.status(404).json({ message: "Interaction not found" });
      }

      if (!interaction.transcript) {
        return res.status(400).json({ message: "No transcript available for synopsis generation" });
      }

      // Use stored extracted info or create basic structure
      const extractedInfo: ExtractedInteractionInfo | null = typeof interaction.extractedInfo === 'string' 
        ? JSON.parse(interaction.extractedInfo)
        : (interaction.extractedInfo as ExtractedInteractionInfo) || {
            summary: '',
            category: '',
            subcategory: '',
            contactLevel: 'Initial Contact',
            professionalInterests: [],
            personalInterests: [],
            philanthropicPriorities: [],
            keyPoints: [],
            suggestedAffinityTags: [],
            prospectName: ''
          };

      // Generate enhanced comments with synopsis
      const enhancedComments = await enhanceInteractionComments(interaction.transcript, extractedInfo as ExtractedInteractionInfo, 1);

      // Perform quality assessment
      const { evaluateInteractionQuality } = await import("./lib/openai");
      const qualityAssessment = await evaluateInteractionQuality(
        interaction.transcript,
        extractedInfo as ExtractedInteractionInfo,
        {
          prospectName: interaction.prospectName || '',
          firstName: interaction.firstName || '',
          lastName: interaction.lastName || '',
          contactLevel: interaction.contactLevel || '',
          method: interaction.method || '',
          actualDate: interaction.actualDate?.toISOString() || '',
          comments: interaction.comments || '',
          summary: interaction.summary || '',
          category: interaction.category || '',
          subcategory: interaction.subcategory || ''
        }
      );

      // Update interaction with enhanced comments and quality assessment
      const updatedInteraction = await storage.updateInteraction(interactionId, {
        comments: enhancedComments,
        qualityScore: qualityAssessment.qualityScore,
        qualityExplanation: qualityAssessment.qualityExplanation,
        qualityRecommendations: qualityAssessment.recommendations
      });

      res.json({ 
        success: true,
        comments: enhancedComments,
        qualityScore: qualityAssessment.qualityScore,
        qualityExplanation: qualityAssessment.qualityExplanation,
        qualityRecommendations: qualityAssessment.recommendations,
        interaction: updatedInteraction,
        message: "Synopsis and quality assessment completed successfully" 
      });
    } catch (error) {
      console.error("Synopsis generation error:", error);
      res.status(500).json({ 
        message: "Failed to generate synopsis", 
        error: (error as Error).message 
      });
    }
  });

  // Identify affinity tags for interaction text
  app.post("/api/interactions/identify-affinity-tags", async (req, res) => {
    try {
      const { text, prospectName } = req.body;

      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return res.status(400).json({ message: "Text content is required" });
      }

      // Extract interests from the text
      const extractedInfo = await extractInteractionInfo(text);

      // Match interests to affinity tags
      const affinityTags = await storage.getAffinityTags();
      const threshold = await getMatchingThreshold();
      const affinityMatcher = await createAffinityMatcher(affinityTags, threshold);

      const professionalInterests = Array.isArray(extractedInfo.professionalInterests) ? extractedInfo.professionalInterests : [];
      const personalInterests = Array.isArray(extractedInfo.personalInterests) ? extractedInfo.personalInterests : [];
      const philanthropicPriorities = Array.isArray(extractedInfo.philanthropicPriorities) ? extractedInfo.philanthropicPriorities : [];

      const matchedTags = affinityMatcher.matchInterests(
        professionalInterests,
        personalInterests,
        philanthropicPriorities
      );
      const suggestedAffinityTags = matchedTags.map(match => match.tag.name);

      console.log("Affinity tag identification:", { 
        professionalInterests, 
        personalInterests, 
        philanthropicPriorities,
        matchedTags: suggestedAffinityTags 
      });

      res.json({
        success: true,
        affinityTags: suggestedAffinityTags,
        interests: {
          professionalInterests,
          personalInterests,
          philanthropicPriorities
        }
      });
    } catch (error) {
      console.error('Affinity tag identification error:', error);
      res.status(500).json({ message: "Failed to identify affinity tags", error: (error as Error).message });
    }
  });

  // Analyze text content for AI insights
  app.post("/api/interactions/analyze-text", async (req, res) => {
    try {
      const { text, prospectName } = req.body;

      if (!text || text.trim().length === 0) {
        return res.status(400).json({ message: "Text content is required for analysis" });
      }

      // Extract interaction information from the text
      const { extractInteractionInfo } = await import("./lib/openai");
      let extractedInfo = await extractInteractionInfo(text);

      // If prospect name was provided, use it to override extracted name
      if (prospectName && prospectName.trim().length > 0) {
        extractedInfo.prospectName = prospectName.trim();
      }

      // Clear any AI-suggested affinity tags and use our matcher instead
      extractedInfo.suggestedAffinityTags = [];

      // Match interests to affinity tags using our precise matcher
      const affinityTags = await storage.getAffinityTags();
      const { createAffinityMatcher } = await import("./lib/affinity-matcher");
      const threshold = await getMatchingThreshold();
      const affinityMatcher = await createAffinityMatcher(affinityTags, threshold);

      const professionalInterests = Array.isArray(extractedInfo.professionalInterests) ? extractedInfo.professionalInterests : [];
      const personalInterests = Array.isArray(extractedInfo.personalInterests) ? extractedInfo.personalInterests : [];
      const philanthropicPriorities = Array.isArray(extractedInfo.philanthropicPriorities) ? extractedInfo.philanthropicPriorities : [];

      let suggestedAffinityTags: string[] = [];
      if (professionalInterests.length > 0 || personalInterests.length > 0 || philanthropicPriorities.length > 0) {
        const matchedTags = affinityMatcher.matchInterests(
          professionalInterests,
          personalInterests,
          philanthropicPriorities
        );
        suggestedAffinityTags = matchedTags.map(match => match.tag.name);
      }

      // Replace with matcher results
      extractedInfo.suggestedAffinityTags = suggestedAffinityTags;

      // Perform quality assessment on the analyzed text
      const { evaluateInteractionQuality } = await import("./lib/openai");
      const qualityAssessment = await evaluateInteractionQuality(
        text,
        extractedInfo,
        {
          prospectName: extractedInfo.prospectName || prospectName || '',
          firstName: '',
          lastName: '',
          contactLevel: '',
          method: '',
          actualDate: new Date().toISOString(),
          comments: text,
          summary: extractedInfo.summary,
          category: extractedInfo.category,
          subcategory: extractedInfo.subcategory
        }
      );

      res.json({ 
        success: true,
        extractedInfo,
        qualityScore: qualityAssessment.qualityScore,
        qualityExplanation: qualityAssessment.qualityExplanation,
        qualityRecommendations: qualityAssessment.recommendations,
        message: "Text analysis and quality assessment completed successfully" 
      });
    } catch (error) {
      console.error("Text analysis error:", error);
      res.status(500).json({ 
        message: "Failed to analyze text", 
        error: (error as Error).message 
      });
    }
  });

  // Bulk process interactions with batch tag matching
  app.post("/api/interactions/bulk-process", async (req, res) => {
    try {
      const { interactionIds } = req.body;

      if (!Array.isArray(interactionIds) || interactionIds.length === 0) {
        return res.status(400).json({ message: "Valid interaction IDs array is required" });
      }

      // Get all interactions
      const interactions = await Promise.all(
        interactionIds.map(id => storage.getInteraction(parseInt(id)))
      );

      // Filter out null results
      const validInteractions = interactions.filter(interaction => interaction !== undefined);

      if (validInteractions.length === 0) {
        return res.status(404).json({ message: "No valid interactions found" });
      }

      // Get affinity tags once for all interactions
      const affinityTags = await storage.getAffinityTags();
      const threshold = await getMatchingThreshold();
      const affinityMatcher = await createAffinityMatcher(affinityTags, threshold);

      const results = [];

      // Process each interaction
      for (const interaction of validInteractions) {
        try {
          let extractedInfo: ExtractedInteractionInfo | null = interaction.extractedInfo ? JSON.parse(typeof interaction.extractedInfo === 'string' ? interaction.extractedInfo : JSON.stringify(interaction.extractedInfo)) : null;
          let enhancedComments = interaction.comments;
          let suggestedAffinityTags = interaction.affinityTags || [];

          // If there's a transcript but no extracted info, process it
          if (interaction.transcript && !extractedInfo) {
            const { extractInteractionInfo, enhanceInteractionComments } = await import("./lib/openai");
            extractedInfo = await extractInteractionInfo(interaction.transcript) || {
              summary: '',
              category: '',
              subcategory: '',
              contactLevel: 'Initial Contact',
              professionalInterests: [],
              personalInterests: [],
              philanthropicPriorities: [],
              keyPoints: [],
              suggestedAffinityTags: [],
              prospectName: ''
            };
            enhancedComments = await enhanceInteractionComments(interaction.transcript, extractedInfo, 1);
          }

          // Re-match affinity tags - try current affinity tags or extract from stored info
          if (extractedInfo) {
            const parsedInfo: ExtractedInteractionInfo = typeof extractedInfo === 'string' ? JSON.parse(extractedInfo) : extractedInfo;
            const allInterests = [
              ...(Array.isArray(parsedInfo.professionalInterests) ? parsedInfo.professionalInterests : []),
              ...(Array.isArray(parsedInfo.personalInterests) ? parsedInfo.personalInterests : []),
              ...(Array.isArray(parsedInfo.philanthropicPriorities) ? parsedInfo.philanthropicPriorities : [])
            ];

            if (allInterests.length > 0) {
              const matchedTags = affinityMatcher.matchInterests(
                parsedInfo.professionalInterests || [],
                parsedInfo.personalInterests || [],
                parsedInfo.philanthropicPriorities || []
              );
              suggestedAffinityTags = matchedTags.map(match => match.tag.name);
            }
          }

          // If still no tags, try to match existing summary/comments for interests
          if (suggestedAffinityTags.length === 0 && (interaction.summary || interaction.comments)) {
            const textToMatch = `${interaction.summary || ''} ${interaction.comments || ''}`.toLowerCase();
            const keywords = textToMatch.split(/\s+/).filter(word => word.length > 3);
            if (keywords.length > 0) {
              const matchedTags = affinityMatcher.matchInterests(keywords, [], []);
              suggestedAffinityTags = matchedTags.map(match => match.tag.name);

            }
          }

          // Update the interaction
          await storage.updateInteraction(interaction.id, {
            extractedInfo: extractedInfo ? JSON.stringify(extractedInfo) : undefined,
            comments: enhancedComments,
            affinityTags: suggestedAffinityTags
          });

          results.push({
            id: interaction.id,
            success: true,
            affinityTagsMatched: suggestedAffinityTags.length,
            message: `Processed successfully with ${suggestedAffinityTags.length} affinity tags`
          });

        } catch (error) {
          results.push({
            id: interaction.id,
            success: false,
            error: (error as Error).message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const totalTagsMatched = results
        .filter(r => r.success)
        .reduce((total, r) => total + (r.affinityTagsMatched || 0), 0);

      const response = {
        success: true,
        processed: results.length,
        successful: successCount,
        failed: results.length - successCount,
        totalAffinityTagsMatched: totalTagsMatched,
        results
      };

      res.json(response);

    } catch (error) {
      console.error("Bulk processing error:", error);
      res.status(500).json({ 
        message: "Failed to process interactions in bulk", 
        error: (error as Error).message 
      });
    }
  });

  // Search user by BUID
  app.get("/api/users/search/:buid", async (req, res) => {
    try {
      const { buid } = req.params;

      if (!buid) {
        return res.status(400).json({ message: "BUID is required" });
      }

      const { bbecClient } = await import("./lib/soap-client");
      await bbecClient.initialize();

      const user = await bbecClient.searchUserByBUID(buid);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(user);
    } catch (error) {
      console.error("Error searching user by BUID:", error);
      res.status(500).json({ 
        message: "Failed to search user", 
        error: (error as Error).message 
      });
    }
  });

  // Search constituents by last name
  app.get("/api/constituents/search/:lastName", async (req, res) => {
    try {
      const { lastName } = req.params;
      const { firstName } = req.query;

      if (!lastName) {
        return res.status(400).json({ message: "Last name is required" });
      }

      const { bbecClient } = await import("./lib/soap-client");
      await bbecClient.initialize();

      let constituents = await bbecClient.searchConstituentsByLastName(lastName);

      // Sort by last name then first name (ascending)
      constituents.sort((a, b) => {
        const lastNameComparison = (a.last_name || '').localeCompare(b.last_name || '');
        if (lastNameComparison !== 0) {
          return lastNameComparison;
        }
        return (a.first_name || '').localeCompare(b.first_name || '');
      });

      // If firstName is provided, prioritize matches with both first and last name
      if (firstName && typeof firstName === 'string' && firstName.trim()) {
        const firstNameTrim = firstName.trim().toLowerCase();

        // Separate matches into two groups
        const exactMatches = constituents.filter(c => 
          c.first_name && c.first_name.toLowerCase().includes(firstNameTrim)
        );
        const otherMatches = constituents.filter(c => 
          !c.first_name || !c.first_name.toLowerCase().includes(firstNameTrim)
        );

        // Sort each group independently
        exactMatches.sort((a, b) => {
          const lastNameComparison = (a.last_name || '').localeCompare(b.last_name || '');
          if (lastNameComparison !== 0) {
            return lastNameComparison;
          }
          return (a.first_name || '').localeCompare(b.first_name || '');
        });

        otherMatches.sort((a, b) => {
          const lastNameComparison = (a.last_name || '').localeCompare(b.last_name || '');
          if (lastNameComparison !== 0) {
            return lastNameComparison;
          }
          return (a.first_name || '').localeCompare(b.first_name || '');
        });

        // Combine with exact matches first
        constituents = [...exactMatches, ...otherMatches];
      }

      res.json(constituents);
    } catch (error) {
      console.error("Error searching constituents by last name:", error);
      res.status(500).json({ 
        message: "Failed to search constituents", 
        error: (error as Error).message 
      });
    }
  });

  // Search constituents by BUID  
  app.get("/api/constituents/search-by-buid/:buid", async (req, res) => {
    try {
      const { buid } = req.params;

      if (!buid) {
        return res.status(400).json({ message: "BUID is required" });
      }

      const { bbecClient } = await import("./lib/soap-client");
      await bbecClient.initialize();

      const constituent = await bbecClient.searchUserByBUID(buid);

      // Convert the single user result to an array to match the expected format
      const result = constituent ? [constituent] : [];
      res.json(result);
    } catch (error) {
      console.error("Error searching constituent by BUID:", error);
      res.status(500).json({ 
        message: "Failed to search constituent by BUID", 
        error: (error as Error).message 
      });
    }
  });

  // Update user profile
  app.patch("/api/user/profile", async (req, res) => {
    try {
      const { firstName, lastName, email, buid } = req.body;
      const userId = (req.user as any)?.id || (req.user as any)?.sub;

      const updatedUser = await storage.updateUser(userId, {
        firstName,
        lastName,
        email,
        buid,
        bbecGuid: req.body.bbecGuid
      });

      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ 
        message: "Failed to update user profile", 
        error: (error as Error).message 
      });
    }
  });

  // Test endpoint for quality assessment
  app.post('/api/test-quality-assessment', async (req, res) => {
    try {
      const { transcript, extractedInfo, interactionData } = req.body;

      const { evaluateInteractionQuality } = await import("./lib/openai");
      const qualityAssessment = await evaluateInteractionQuality(
        transcript,
        extractedInfo,
        interactionData
      );

      res.json({ qualityAssessment });
    } catch (error) {
      console.error('Quality assessment test error:', error);
      res.status(500).json({ error: 'Quality assessment failed' });
    }
  });

  // Manual admin assignment endpoint (for bootstrapping)
  app.post('/api/admin/bootstrap', async (req, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // Find user by email or create if doesn't exist
      let user = await storage.getUserByUsername(email);
      if (!user) {
        // Try to find by ID (for Replit Auth users)
        const userId = (req.user as any)?.id || (req.user as any)?.sub;
        if (userId) {
          user = await storage.getUser(userId);
        }
      }

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get admin role
      const roles = await storage.getRoles();
      const adminRole = roles.find(r => r.name === "Administrator");

      if (!adminRole) {
        return res.status(500).json({ message: "Administrator role not found" });
      }

      // Check if user already has admin role
      const userRoles = await storage.getUserRoles(user.id);
      const hasAdminRole = userRoles.some(role => role.id === adminRole.id);

      if (hasAdminRole) {
        return res.json({ success: true, message: "User already has Administrator role" });
      }

      // Assign admin role
      await storage.assignUserRole(user.id, adminRole.id, "bootstrap");

      res.json({ 
        success: true, 
        message: `Administrator role assigned to ${user.email || user.id}` 
      });
    } catch (error) {
      console.error("Bootstrap admin assignment error:", error);
      res.status(500).json({ 
        message: "Failed to assign admin role", 
        error: (error as Error).message 
      });
    }
  });

  // Admin API endpoints
  // Check admin permission middleware
  const requireAdmin = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUserWithRoles(userId);

      if (!user || !user.roles?.some(role => role.name === "Administrator")) {
        return res.status(403).json({ message: "Admin access required" });
      }

      next();
    } catch (error) {
      res.status(500).json({ message: "Failed to verify admin access" });
    }
  };

  // Python AI endpoints
  app.get("/api/python-scripts", isAuthenticated, async (req: any, res) => {
    try {
      const scripts = await storage.getPythonScripts();
      res.json(scripts);
    } catch (error: any) {
      console.error('Error fetching Python scripts:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/python-scripts", isAuthenticated, async (req: any, res) => {
    try {
      // Assuming req.session.user exists and contains user info after authentication
      // If using a different auth mechanism, adjust how userId is retrieved.
      const userId = req.user?.claims?.sub; 
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      const scriptData = { ...req.body, ownerId: userId };
      const script = await storage.createPythonScript(scriptData);
      res.json(script);
    } catch (error: any) {
      console.error('Error creating Python script:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/python-scripts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const script = await storage.getPythonScript(parseInt(id));
      if (!script) {
        return res.status(404).json({ error: 'Script not found' });
      }
      res.json(script);
    } catch (error: any) {
      console.error('Error fetching Python script:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/python-scripts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const script = await storage.updatePythonScript(parseInt(id), req.body);
      res.json(script);
    } catch (error: any) {
      console.error('Error updating Python script:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // DELETE Python script
  app.delete("/api/python-scripts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const scriptId = parseInt(id);
      
      // Check if script exists and user has permission to delete
      const script = await storage.getPythonScript(scriptId);
      if (!script) {
        return res.status(404).json({ error: 'Script not found' });
      }

      const userId = req.session?.user?.id || "42195145";
      if (script.ownerId !== userId) {
        return res.status(403).json({ error: 'Permission denied. You can only delete your own scripts.' });
      }

      // Delete the script (this will cascade delete executions, versions, etc. due to foreign key constraints)
      await storage.deletePythonScript(scriptId);
      
      console.log(`🗑️ [SCRIPT DELETED] Script ${scriptId} (${script.name}) deleted by user ${userId}`);
      res.json({ success: true, message: 'Script deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting Python script:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/python-scripts/:id/execute", isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { inputs } = req.body;
      const startTime = Date.now();

      // Get the script from storage
      const script = await storage.getPythonScript(parseInt(id));
      if (!script) {
        return res.status(404).json({ error: 'Script not found' });
      }

      // Create a temporary directory for execution
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const scriptPath = path.join(tempDir, `script_${id}_${Date.now()}.py`);
      
      // Write script content to temporary file
      let scriptContent = script.content || '';
      
      // If inputs are provided, inject them as a JSON variable at the top of the script
      if (inputs && Object.keys(inputs).length > 0) {
        const inputsJson = JSON.stringify(inputs, null, 2);
        scriptContent = `# Injected runtime inputs\ninputs = ${inputsJson}\n\n${scriptContent}`;
      }
      
      fs.writeFileSync(scriptPath, scriptContent);

      try {
        // Install requirements if specified
        if (script.requirements && script.requirements.length > 0) {
          console.log(`Installing Python requirements: ${script.requirements.join(', ')}`);
          for (const requirement of script.requirements) {
            try {
              await execAsync(`pip3 install "${requirement}"`, {
                timeout: 60000, // 60 second timeout for installations
                cwd: tempDir
              });
            } catch (installError) {
              console.warn(`Failed to install ${requirement}, continuing anyway:`, installError);
            }
          }
        }

        // Execute the Python script
        const { stdout, stderr } = await execAsync(`python3 "${scriptPath}"`, {
          timeout: 30000, // 30 second timeout
          cwd: tempDir,
          env: { ...process.env, PYTHONPATH: tempDir }
        });

        const endTime = Date.now();
        
        // Clean up temporary file
        fs.unlinkSync(scriptPath);

        // Save execution to database
        const userId = req.user?.claims?.sub;
        const savedExecution = await storage.createScriptExecution({
          scriptId: parseInt(id),
          triggeredBy: userId,
          status: 'completed',
          inputs,
          stdout: stdout || null,
          stderr: stderr || null,
          exitCode: 0,
          duration: endTime - startTime,
          startedAt: new Date(startTime),
          completedAt: new Date(endTime),
          isScheduled: false
        });

        // Also update the script's lastRunAt
        await storage.updatePythonScript(parseInt(id), { lastRunAt: new Date() });

        res.json(savedExecution);
      } catch (execError: any) {
        const endTime = Date.now();
        
        // Clean up temporary file
        if (fs.existsSync(scriptPath)) {
          fs.unlinkSync(scriptPath);
        }

        // Save failed execution to database
        const userId = req.user?.claims?.sub;
        const savedExecution = await storage.createScriptExecution({
          scriptId: parseInt(id),
          triggeredBy: userId,
          status: 'failed',
          inputs,
          stdout: execError.stdout || null,
          stderr: execError.stderr || execError.message,
          exitCode: execError.code || 1,
          duration: endTime - startTime,
          startedAt: new Date(startTime),
          completedAt: new Date(endTime),
          isScheduled: false
        });

        res.json(savedExecution);
      }
    } catch (error: any) {
      console.error('Error executing Python script:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/script-executions", isAuthenticated, async (req: any, res) => {
    try {
      const { scriptId, userId } = req.query;
      const executions = await storage.getScriptExecutions(
        scriptId ? parseInt(scriptId as string) : undefined,
        userId as string
      );
      res.json(executions);
    } catch (error: any) {
      console.error('Error fetching script executions:', error);
      res.status(500).json({ error: error.message });
    }
  });


  // Admin endpoints
  app.get("/api/admin/users", isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      console.log("Getting all users with roles...");
      const users = await storage.getAllUsersWithRoles();
      console.log("Successfully retrieved users:", users.length);
      res.json(users);
    } catch (error) {
      console.error("Error getting users:", error);
      res.status(500).json({ message: "Failed to get users", error: (error as Error).message });
    }
  });

  // Create new user (admin only)
  app.post('/api/admin/users', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      console.log("Creating user with data:", req.body);
      const userData = req.body;

      // Check if user with this email already exists
      const existingUser = await storage.getUserByUsername(userData.email);
      if (existingUser) {
        return res.status(400).json({ 
          message: "Email already exists", 
          error: `A user with email "${userData.email}" already exists. Please use a different email address.`
        });
      }

      const user = await storage.createUser(userData);
      console.log("Successfully created user:", user);
      res.json(user);
    } catch (error: any) {
      console.error("Error creating user:", error);

      // Handle duplicate email constraint violation
      if (error.code === '23505' && error.constraint_name === 'users_email_unique') {
        return res.status(400).json({ 
          message: "Email already exists", 
          error: "A user with this email address already exists. Please use a different email address."
        });
      }

      res.status(500).json({ message: "Failed to create user", error: error.message });
    }
  });

  // Update user (admin only)
  app.patch('/api/admin/users/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const user = await storage.updateUser(id, updates);
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to update user", error: (error as Error).message });
    }
  });

  // Assign role to user (admin only)
  app.post('/api/admin/users/:id/roles', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { roleId } = req.body;
      const adminId = req.user.claims.sub;

      const userRole = await storage.assignUserRole(id, roleId, adminId);
      res.json(userRole);
    } catch (error) {
      res.status(500).json({ message: "Failed to assign role", error: (error as Error).message });
    }
  });

  // Remove role from user (admin only)
  app.delete('/api/admin/users/:id/roles/:roleId', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id, roleId } = req.params;
      const success = await storage.removeUserRole(id, parseInt(roleId));
      res.json({ success });
    } catch (error) {
      res.status(500).json({ message: "Failed to remove role", error: (error as Error).message });
    }
  });

  // Impersonate user (admin only)
  app.post('/api/admin/impersonate/:userId', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { userId } = req.params;
      const adminId = req.user?.id;

      // Verify the target user exists and is not an admin
      const targetUser = await storage.getUserWithRoles(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "Target user not found" });
      }

      // Prevent impersonating other admins
      const isTargetAdmin = targetUser.roles?.some(role => role.name === 'Administrator') || false;
      if (isTargetAdmin) {
        return res.status(403).json({ message: "Cannot impersonate other administrators" });
      }

      // Store impersonation in session
      req.session.impersonation = {
        adminId: adminId,
        targetUserId: userId,
        startedAt: new Date().toISOString()
      };

      // Update user claims to target user
      req.user.claims.sub = userId;

      res.json({ 
        success: true, 
        message: `Now impersonating ${targetUser.firstName} ${targetUser.lastName}`,
        targetUser: targetUser
      });
    } catch (error) {
      console.error("Error starting impersonation:", error);
      res.status(500).json({ message: "Failed to start impersonation", error: (error as Error).message });
    }
  });

  // Stop impersonation (return to admin)
  app.post('/api/admin/stop-impersonation', isAuthenticated, async (req: any, res) => {
    try {
      if (!req.session.impersonation) {
        return res.status(400).json({ message: "Not currently impersonating anyone" });
      }

      const { adminId } = req.session.impersonation;

      // Restore admin user claims
      req.user.claims.sub = adminId;

      // Clear impersonation from session
      delete req.session.impersonation;

      res.json({ 
        success: true, 
        message: "Impersonation ended, returned to admin account" 
      });
    } catch (error) {
      console.error("Error stopping impersonation:", error);
      res.status(500).json({ message: "Failed to stop impersonation", error: (error as Error).message });
    }
  });

  // Check impersonation status
  app.get('/api/admin/impersonation-status', isAuthenticated, async (req: any, res) => {
    try {
      if (req.session.impersonation) {
        const { adminId, targetUserId, startedAt } = req.session.impersonation;
        console.log("🔍 Checking impersonation status:", { adminId, targetUserId });

        // Safely fetch users with null handling
        let targetUser = null;
        let adminUser = null;

        try {
          if (targetUserId) {
            targetUser = await storage.getUserWithRoles(targetUserId);
          }
        } catch (targetError) {
          console.warn("Warning: Could not fetch target user:", targetError);
        }

        try {
          if (adminId) {
            adminUser = await storage.getUserWithRoles(adminId);
          }
        } catch (adminError) {
          console.warn("Warning: Could not fetch admin user:", adminError);
        }

        res.json({
          isImpersonating: true,
          admin: adminUser || { id: adminId, firstName: "Admin", lastName: "User" },
          targetUser: targetUser || { id: targetUserId, firstName: "Unknown", lastName: "User" },
          startedAt: startedAt
        });
      } else {
        res.json({ isImpersonating: false });
      }
    } catch (error) {
      console.error("Error checking impersonation status:", error);
      res.status(500).json({ message: "Failed to check impersonation status", error: (error as Error).message });
    }
  });

  // Get all roles (admin only)
  app.get('/api/admin/roles', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const roles = await storage.getRoles();
      res.json(roles);
    } catch (error) {
      res.status(500).json({ message: "Failed to get roles", error: (error as Error).message });
    }
  });

  // Create new role (admin only)
  app.post('/api/admin/roles', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const roleData = req.body;
      const role = await storage.createRole(roleData);
      res.json(role);
    } catch (error) {
      res.status(500).json({ message: "Failed to create role", error: (error as Error).message });
    }
  });

  // Update role (admin only)
  app.patch('/api/admin/roles/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      const role = await storage.updateRole(parseInt(id), updates);
      res.json(role);
    } catch (error) {
      res.status(500).json({ message: "Failed to update role", error: (error as Error).message });
    }
  });

  // Delete role (admin only)
  app.delete('/api/admin/roles/:id', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteRole(parseInt(id));
      res.json({ success });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete role", error: (error as Error).message });
    }
  });

  // Get all applications (admin only)
  app.get('/api/admin/applications', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      console.log("Getting all applications...");
      const applications = await storage.getAllApplications();
      console.log("Successfully retrieved applications:", applications.length);
      res.json(applications);
    } catch (error) {
      console.error("Error getting applications:", error);
      res.status(500).json({ message: "Failed to get applications", error: (error as Error).message });
    }
  });

  // Get role applications with permissions (admin only)
  app.get('/api/admin/role-applications', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const roles = await storage.getRoles();
      const rolesWithApps = await Promise.all(
        roles.map(async (role) => {
          const applications = await storage.getRoleApplications(role.id);
          return { ...role, applications };
        })
      );
      res.json(rolesWithApps);
    } catch (error) {
      res.status(500).json({ message: "Failed to get role applications", error: (error as Error).message });
    }
  });

  // Assign application permissions to role (admin only)
  app.post('/api/admin/roles/:roleId/applications', isAuthenticated, requireAdmin, async (req: any, res) => {
    try {
      const { roleId } = req.params;
      const { applicationId, permissions } = req.body;

      console.log('Assigning role permissions:', { roleId, applicationId, permissions });

      if (!applicationId || !Array.isArray(permissions)) {
        return res.status(400).json({ message: "applicationId and permissions array are required" });
      }

      const roleApp = await storage.assignRoleApplication(parseInt(roleId), parseInt(applicationId), permissions);
      res.json(roleApp);
    } catch (error) {
      console.error("Role permission assignment error:", error);
      res.status(500).json({ message: "Failed to assign application permissions", error: (error as Error).message });
    }
  });

  // Prospect Management API Routes

  // Get prospects for the logged-in manager
  app.get('/api/prospects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const prospects = await storage.getProspectsByManager(userId);
      res.json(prospects);
    } catch (error) {
      console.error("Error fetching prospects:", error);
      res.status(500).json({ message: "Failed to fetch prospects", error: (error as Error).message });
    }
  });

  // Get specific prospect with full details
  app.get('/api/prospects/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const prospect = await storage.getProspect(parseInt(id));

      if (!prospect) {
        return res.status(404).json({ message: "Prospect not found" });
      }

      // Check if user has access to this prospect
      if (prospect.prospectManagerId !== userId && prospect.primaryProspectManagerId !== userId) {
        return res.status(403).json({ message: "Access denied to this prospect" });
      }

      res.json(prospect);
    } catch (error) {
      console.error("Error fetching prospect:", error);
      res.status(500).json({ message: "Failed to fetch prospect", error: (error as Error).message });
    }
  });

  // Refresh all prospect data for the logged-in manager
  app.post('/api/prospects/refresh-all', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.refreshAllProspectData(userId);

      // Return updated prospects
      const prospects = await storage.getProspectsByManager(userId);
      res.json({ message: "All prospect data refreshed successfully", prospects });
    } catch (error) {
      console.error("Error refreshing prospect data:", error);
      res.status(500).json({ message: "Failed to refresh prospect data", error: (error as Error).message });
    }
  });

  // Refresh specific prospect data
  app.post('/api/prospects/:id/refresh', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const prospect = await storage.getProspect(parseInt(id));

      if (!prospect) {
        return res.status(404).json({ message: "Prospect not found" });
      }

      // Check if user has access to this prospect
      if (prospect.prospectManagerId !== userId && prospect.primaryProspectManagerId !== userId) {
        return res.status(403).json({ message: "Access denied to this prospect" });
      }

      const updatedProspect = await storage.refreshProspectData(parseInt(id));
      res.json({ message: "Prospect data refreshed successfully", prospect: updatedProspect });
    } catch (error) {
      console.error("Error refreshing prospect:", error);
      res.status(500).json({ message: "Failed to refresh prospect", error: (error as Error).message });
    }
  });

  // Itinerary routes
  app.get('/api/itineraries', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const itineraries = await storage.getItineraries(userId);
      res.json(itineraries);
    } catch (error) {
      console.error("Error fetching itineraries:", error);
      res.status(500).json({ message: "Failed to fetch itineraries", error: (error as Error).message });
    }
  });

  app.get('/api/itineraries/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const itinerary = await storage.getItinerary(parseInt(id));
      if (!itinerary) {
        return res.status(404).json({ message: "Itinerary not found" });
      }

      // Check if user owns this itinerary
      if (itinerary.userId !== userId) {
        return res.status(403).json({ message: "Access denied to this itinerary" });
      }

      // Get meetings and travel segments
      const meetings = await storage.getItineraryMeetings(parseInt(id));
      const travelSegments = await storage.getItineraryTravelSegments(parseInt(id));

      res.json({ ...itinerary, meetings, travelSegments });
    } catch (error) {
      console.error("Error fetching itinerary:", error);
      res.status(500).json({ message: "Failed to fetch itinerary", error: (error as Error).message });
    }
  });

  app.post('/api/itineraries', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Validate and parse the request body
      const validatedData = insertItinerarySchema.parse({
        ...req.body,
        userId
      });

      const newItinerary = await storage.createItinerary(validatedData);
      res.json(newItinerary);
    } catch (error) {
      console.error("Error creating itinerary:", error);
      res.status(500).json({ message: "Failed to create itinerary", error: (error as Error).message });
    }
  });

  app.put('/api/itineraries/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const itinerary = await storage.getItinerary(parseInt(id));
      if (!itinerary || itinerary.userId !== userId) {
        return res.status(404).json({ message: "Itinerary not found or access denied" });
      }

      const updatedItinerary = await storage.updateItinerary(parseInt(id), req.body);
      res.json(updatedItinerary);
    } catch (error) {
      console.error("Error updating itinerary:", error);
      res.status(500).json({ message: "Failed to update itinerary", error: (error as Error).message });
    }
  });

  app.delete('/api/itineraries/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const itinerary = await storage.getItinerary(parseInt(id));
      if (!itinerary || itinerary.userId !== userId) {
        return res.status(404).json({ message: "Itinerary not found or access denied" });
      }

      await storage.deleteItinerary(parseInt(id));
      res.json({ success: true, message: "Itinerary deleted successfully" });
    } catch (error) {
      console.error("Error deleting itinerary:", error);
      res.status(500).json({ message: "Failed to delete itinerary", error: (error as Error).message });
    }
  });

  // Itinerary meeting routes
  app.post('/api/itineraries/:id/meetings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { id } = req.params;

      const itinerary = await storage.getItinerary(parseInt(id));
      if (!itinerary || itinerary.userId !== userId) {
        return res.status(404).json({ message: "Itinerary not found or access denied" });
      }

      // Validate and parse the request body
      const validatedData = insertItineraryMeetingSchema.parse({
        ...req.body,
        itineraryId: parseInt(id)
      });

      const newMeeting = await storage.createItineraryMeeting(validatedData);
      res.json(newMeeting);
    } catch (error) {
      console.error("Error creating meeting:", error);
      res.status(500).json({ message: "Failed to create meeting", error: (error as Error).message });
    }
  });

  app.put('/api/meetings/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updatedMeeting = await storage.updateItineraryMeeting(parseInt(id), req.body);
      res.json(updatedMeeting);
    } catch (error) {
      console.error("Error updating meeting:", error);
      res.status(500).json({ message: "Failed to update meeting", error: (error as Error).message });
    }
  });

  app.delete('/api/meetings/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.deleteItineraryMeeting(parseInt(id));
      res.json({ success: true, message: "Meeting deleted successfully" });
    } catch (error) {
      console.error("Error deleting meeting:", error);
      res.status(500).json({ message: "Failed to delete meeting", error: (error as Error).message });
    }
  });

  // Google Places API routes
  app.get('/api/places/autocomplete', isAuthenticated, async (req: any, res) => {
    try {
      console.log('[PLACES API] Autocomplete request received:', { input: req.query.input, user: req.user?.claims?.sub });

      const { input } = req.query;
      if (!input || typeof input !== 'string') {
        console.log('[PLACES API] Invalid input parameter');
        return res.status(400).json({ error: 'Input parameter is required' });
      }

      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        console.log('[PLACES API] Google Places API key not configured');
        return res.status(500).json({ error: 'Google Places API key not configured' });
      }

      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}&types=establishment|geocode&components=country:us`;
      console.log('[PLACES API] Making request to Google Places API');

      const response = await fetch(url);
      const data = await response.json();

      console.log('[PLACES API] Received response from Google, predictions:', data.predictions?.length || 0);
      res.json(data);
    } catch (error) {
      console.error('[PLACES API] Error with Places Autocomplete API:', error);
      res.status(500).json({ error: 'Failed to fetch place suggestions' });
    }
  });

  app.get('/api/places/details', isAuthenticated, async (req: any, res) => {
    try {
      console.log('[PLACES API] Details request received:', { place_id: req.query.place_id, user: req.user?.claims?.sub });

      const { place_id } = req.query;
      if (!place_id || typeof place_id !== 'string') {
        console.log('[PLACES API] Invalid place_id parameter');
        return res.status(400).json({ error: 'Place ID parameter is required' });
      }

      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        console.log('[PLACES API] Google Places API key not configured');
        return res.status(500).json({ error: 'Google Places API key not configured' });
      }

      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=formatted_address,address_components,geometry&key=${apiKey}`;
      console.log('[PLACES API] Making request to Google Places Details API');

      const response = await fetch(url);
      const data = await response.json();

      console.log('[PLACES API] Received details response from Google');
      res.json(data);
    } catch (error) {
      console.error('[PLACES API] Error with Places Details API:', error);
      res.status(500).json({ error: 'Failed to fetch place details' });
    }
  });

  // AI Code Quality Analysis for Python Scripts
  app.post('/api/python-scripts/analyze', isAuthenticated, async (req: any, res) => {
    try {
      const { code, scriptName } = req.body;
      const userId = req.user?.claims?.sub;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!code) {
        return res.status(400).json({ error: 'Code is required for analysis' });
      }

      // Import OpenAI (using dynamic import to avoid issues)
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const analysisPrompt = `
You are a senior Python developer and code quality expert. Analyze the following Python code and provide a comprehensive evaluation.

CRITICAL: You must respond with ONLY a valid JSON object, no additional text before or after the JSON.

SCRIPT NAME: ${scriptName || 'Untitled Script'}

CODE TO ANALYZE:
\`\`\`python
${code}
\`\`\`

Respond with exactly this JSON structure (with your analysis):
{
  "overallScore": number (1-10, where 10 is excellent),
  "qualityAssessment": {
    "codeStructure": {
      "score": number (1-10),
      "comments": "string with specific feedback"
    },
    "readability": {
      "score": number (1-10), 
      "comments": "string with specific feedback"
    },
    "errorHandling": {
      "score": number (1-10),
      "comments": "string with specific feedback"
    },
    "documentation": {
      "score": number (1-10),
      "comments": "string with specific feedback"
    },
    "bestPractices": {
      "score": number (1-10),
      "comments": "string with specific feedback"
    }
  },
  "securityIssues": [
    {
      "severity": "high|medium|low",
      "issue": "description of the security concern",
      "recommendation": "how to fix it",
      "lineNumber": number (if applicable, or null)
    }
  ],
  "performanceImprovements": [
    {
      "priority": "high|medium|low",
      "issue": "description of the performance concern", 
      "recommendation": "how to improve it",
      "lineNumber": number (if applicable, or null)
    }
  ],
  "codeSmells": [
    {
      "type": "type of code smell",
      "description": "what the issue is",
      "suggestion": "how to fix it",
      "lineNumber": number (if applicable, or null)
    }
  ],
  "recommendations": [
    "string recommendations for overall improvement"
  ],
  "summary": "Overall summary of the code quality and main areas for improvement"
}

Focus on:
- Code structure and organization
- Security vulnerabilities (SQL injection, XSS, unsafe imports, etc.)
- Performance bottlenecks and inefficiencies  
- Error handling and edge cases
- Documentation and comments quality
- Python best practices (PEP 8, naming conventions, etc.)
- Potential bugs or logical errors
- Maintainability and readability

Provide specific, actionable feedback with line numbers when possible. Remember: respond with ONLY the JSON object, nothing else.
`;

      const response = await openai.chat.completions.create({
        model: AI_MODELS.ANALYSIS, // Configurable AI model for code analysis
        messages: [{ role: "user", content: analysisPrompt }],
        temperature: 0.3,
        max_tokens: 4000
      });

      const responseContent = response.choices[0].message.content || '';
      
      // Clean the response content to ensure it's valid JSON
      let cleanedContent = responseContent.trim();
      
      // Remove any markdown code blocks if present
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Try to find JSON content if there's extra text
      const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedContent = jsonMatch[0];
      }
      
      let analysis;
      try {
        analysis = JSON.parse(cleanedContent);
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        console.error('Raw response:', responseContent);
        
        // Fallback analysis if JSON parsing fails
        analysis = {
          overallScore: 5,
          qualityAssessment: {
            codeStructure: { score: 5, comments: "Analysis completed but formatting issue occurred" },
            readability: { score: 5, comments: "Please try again" },
            errorHandling: { score: 5, comments: "AI response formatting error" },
            documentation: { score: 5, comments: "Analysis inconclusive" },
            bestPractices: { score: 5, comments: "Please retry analysis" }
          },
          securityIssues: [],
          performanceImprovements: [],
          codeSmells: [],
          recommendations: ["Please retry the AI analysis - there was a formatting issue with the response"],
          summary: "Analysis failed due to response formatting. Please try again."
        };
      }
      
      console.log(`🔍 [CODE ANALYSIS] Script "${scriptName}" analyzed by user ${userId}`);
      
      res.json(analysis);
    } catch (error) {
      console.error('Code analysis error:', error);
      res.status(500).json({ 
        error: 'Failed to analyze code', 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // AI Code Commenting for Python Scripts
  app.post('/api/python-scripts/add-comments', isAuthenticated, async (req: any, res) => {
    try {
      const { code, scriptName } = req.body;
      // Support both Replit auth (req.user?.claims?.sub) and Heroku auth (req.session?.user?.id)
      const userId = req.user?.claims?.sub || req.session?.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!code) {
        return res.status(400).json({ error: 'Code is required for commenting' });
      }

      // Import OpenAI (using dynamic import to avoid issues)
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const commentingPrompt = `
You are a senior Python developer and documentation expert. Add comprehensive, professional comments to the following Python code following industry best practices.

CRITICAL REQUIREMENTS:
1. Return ONLY valid Python code - no markdown, no code blocks, no explanatory text
2. Use ONLY # line-based comments - DO NOT use triple-quoted docstrings (""")
3. Do not break existing code functionality
4. Preserve all original code logic and structure
5. PRESERVE ALL EXISTING COMMENTS AND HEADERS - Do not replace, modify, or remove any existing comments, docstrings, or header metadata

SCRIPT NAME: ${scriptName || 'Untitled Script'}

ORIGINAL CODE:
${code}

IMPORTANT: If the code already has header comments, author information, copyright notices, or any existing documentation, you must keep them EXACTLY as they are. Only ADD new comments where there are none.

Add professional comments using ONLY # line-based format:
- Add module description at the top using # comments (after any existing header comments)
- Add function/class descriptions using # comments above function definitions
- Add inline comments explaining complex logic and business rules where none exist
- Add section comments grouping related functionality where helpful
- Explain parameters, return values, and logic using # comments

Comment formatting rules:
- Use ONLY # for ALL comments - no triple quotes allowed
- Place # comments on their own lines above code blocks
- Use # comments inline for complex expressions
- Keep comments concise and informative
- Focus on WHY the code does something, not obvious WHAT
- Maintain all existing formatting and indentation
- Use # to document function parameters and return values

Example format:
# This function calculates the total sum
# Parameters: numbers - list of integers to sum
# Returns: integer sum of all numbers
def calculate_sum(numbers):
    # Initialize sum variable
    total = 0
    # Iterate through each number in the list
    for num in numbers:
        total += num  # Add current number to running total
    return total

Return the complete Python script with added # comments only. Ensure the output is syntactically valid Python code that can be executed without errors and preserves all original metadata.
`;

      const response = await openai.chat.completions.create({
        model: AI_MODELS.COMMENTING, // Configurable AI model for adding comments
        messages: [{ role: "user", content: commentingPrompt }],
        temperature: 0.2,
        max_tokens: 4000
      });

      let commentedCode = response.choices[0].message.content || '';
      
      // Clean the response to ensure it's valid Python code
      commentedCode = commentedCode.trim();
      
      // Remove any markdown code blocks if present
      if (commentedCode.startsWith('```python') || commentedCode.startsWith('```py')) {
        commentedCode = commentedCode.replace(/^```(python|py)\s*/, '').replace(/\s*```$/, '');
      } else if (commentedCode.startsWith('```')) {
        commentedCode = commentedCode.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Remove any explanatory text before or after the code
      const lines = commentedCode.split('\n');
      let startIndex = 0;
      let endIndex = lines.length - 1;
      
      // Find the first line that looks like Python code (starts with import, def, class, #, or is indented)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#') || line.startsWith('"""') || line.startsWith('import ') || 
            line.startsWith('from ') || line.startsWith('def ') || line.startsWith('class ') ||
            line.startsWith('if ') || line.startsWith('for ') || line.startsWith('while ') ||
            lines[i].startsWith('    ') || line.length === 0) {
          startIndex = i;
          break;
        }
      }
      
      // Find the last line that looks like Python code
      for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line.length > 0 && !line.startsWith('Note:') && !line.startsWith('This ') && 
            !line.startsWith('The ') && !line.includes('commented version')) {
          endIndex = i;
          break;
        }
      }
      
      commentedCode = lines.slice(startIndex, endIndex + 1).join('\n');
      
      console.log(`💬 [CODE COMMENTING] Script "${scriptName}" commented by user ${userId}`);
      
      res.json({ commentedCode: commentedCode.trim() });
    } catch (error) {
      console.error('Code commenting error:', error);
      res.status(500).json({ 
        error: 'Failed to add comments to code', 
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // AI Script Generation endpoint with async job processing
  app.post('/api/python-scripts/generate', isAuthenticated, async (req, res) => {
    // Ensure we always return JSON
    res.setHeader('Content-Type', 'application/json');
    
    try {
      const { description } = req.body;
      // Support both Replit auth (req.user?.claims?.sub) and Heroku auth (req.session?.user?.id)
      const userId = req.user?.claims?.sub || req.session?.user?.id;

      console.log(`🤖 [SCRIPT GENERATION] Request from user ${userId} with description: ${description?.substring(0, 50)}...`);

      if (!description || !description.trim()) {
        return res.status(400).json({ error: 'Description is required' });
      }

      if (!userId) {
        console.error('🚨 [SCRIPT GENERATION] No user ID found in request');
        return res.status(401).json({ error: 'Unauthorized - No user authentication found' });
      }

      // Create async job for long-running AI operation
      const jobData = await storage.createAiJob({
        userId,
        type: 'script_generation',
        status: 'pending',
        input: { description },
        progress: 0
      });

      // Start processing job asynchronously (non-blocking)
      processScriptGenerationJob(jobData.id).catch(error => {
        console.error(`🚨 [JOB PROCESSOR] Job ${jobData.id} failed:`, error);
      });

      console.log(`✅ [SCRIPT GENERATION] Job ${jobData.id} created for user ${userId}`);
      
      // Return immediately with job ID
      res.json({ 
        jobId: jobData.id,
        status: 'processing',
        message: 'Script generation started. Use the job ID to check status.',
        estimatedTime: '30-60 seconds'
      });
    } catch (error) {
      console.error('🚨 [SCRIPT GENERATION] Error creating job:', error);
      
      // Ensure we always return JSON even in error cases
      res.setHeader('Content-Type', 'application/json');
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorResponse = { 
        error: 'Failed to start script generation', 
        details: errorMessage,
        timestamp: new Date().toISOString()
      };
      
      console.error('🚨 [SCRIPT GENERATION] Returning error response:', errorResponse);
      res.status(500).json(errorResponse);
    }
  });

  // Job status endpoint
  app.get('/api/ai-jobs/:jobId', isAuthenticated, async (req, res) => {
    try {
      const { jobId } = req.params;
      const userId = req.user?.claims?.sub || req.session?.user?.id;

      const job = await storage.getAiJob(parseInt(jobId));
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      // Verify job belongs to user
      if (job.userId !== userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      res.json(job);
    } catch (error) {
      console.error('Error fetching job status:', error);
      res.status(500).json({ error: 'Failed to fetch job status' });
    }
  });

  // Debug endpoint to check job result structure
  app.get('/api/ai-jobs/:jobId/debug', isAuthenticated, async (req, res) => {
    try {
      const { jobId } = req.params;
      const job = await storage.getAiJob(parseInt(jobId));
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      console.log(`🔍 [DEBUG] Job ${jobId} full data:`, JSON.stringify(job, null, 2));
      
      res.json({
        jobId: job.id,
        status: job.status,
        result: job.result,
        resultType: typeof job.result,
        resultKeys: job.result ? Object.keys(job.result) : null,
        rawJob: job
      });
    } catch (error) {
      console.error('Error in debug endpoint:', error);
      res.status(500).json({ error: 'Debug failed' });
    }
  });

  // Background job processor for script generation
  async function processScriptGenerationJob(jobId: number) {
    try {
      console.log(`🔄 [JOB PROCESSOR] Starting job ${jobId}`);
      
      // Update job to processing
      await storage.updateAiJob(jobId, { 
        status: 'processing', 
        startedAt: new Date(),
        progress: 10 
      });

      const job = await storage.getAiJob(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      const { description } = job.input as { description: string };
      
      // Import OpenAI (using dynamic import to avoid issues)
      const OpenAI = (await import('openai')).default;
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const generationPrompt = `
You are a senior Python developer. Generate a complete, production-ready Python script based on the user's description.

USER DESCRIPTION: ${description}

CRITICAL REQUIREMENTS:
1. Return ONLY valid Python code - no markdown, no code blocks, no explanatory text
2. Start with header metadata comments in this EXACT format:
   # Script Name: [descriptive name, max 5 words]
   # Description: [brief description, max 20 words]
   # Tags: [comma-separated relevant tags like 'data-processing', 'automation', 'web-scraping']
   # Python Version: [recommended version like '3.11']
   # Inputs: [describe expected inputs or 'None']
   # Timeout: [recommended timeout in seconds like '300']
   # Memory: [recommended memory in MB like '512']
   # CPU Limit: [recommended CPU limit like '1.0']

3. Include comprehensive # line-based comments throughout the code
4. Follow Python best practices and PEP 8 conventions
5. Add error handling where appropriate
6. Include input validation and proper documentation
7. Make the script robust and production-ready

Example header format:
# Script Name: Data File Processor
# Description: Processes CSV files and generates summary reports
# Tags: data-processing, csv, reporting, automation
# Python Version: 3.11
# Inputs: CSV file path as command line argument
# Timeout: 300
# Memory: 512
# CPU Limit: 1.0

Generate a complete, functional Python script that accomplishes the user's requirements with proper error handling, documentation, and best practices.
`;

      // Get user's AI model preference and create model order
      let response;
      const userId = req.user?.claims?.sub || req.session?.user?.id || "42195145";
      const userPreference = await storage.getUserSettingValue(userId, 'ai_model_preference', 'gpt-4o');
      
      // Create ordered list based on user preference
      let modelsToTry;
      switch (userPreference) {
        case 'gpt-5':
          modelsToTry = ["gpt-5", "gpt-4o", "gpt-4", "gpt-3.5-turbo"];
          break;
        case 'gpt-4':
          modelsToTry = ["gpt-4", "gpt-3.5-turbo", "gpt-4o"];
          break;
        case 'gpt-4o':
        default:
          modelsToTry = ["gpt-4o", "gpt-4", "gpt-3.5-turbo"];
          break;
      }
      
      console.log(`🤖 [JOB PROCESSOR] Attempting OpenAI generation with models: ${modelsToTry.join(', ')}`);
      
      for (const model of modelsToTry) {
        try {
          console.log(`🔄 [JOB PROCESSOR] Trying model: ${model}`);
          
          const apiParams: any = {
            model: model,
            messages: [{ role: "user", content: generationPrompt }],
            temperature: 0.3,
            max_tokens: 4000
          };
          
          response = await openai.chat.completions.create(apiParams);
          
          if (response.choices?.[0]?.message?.content && response.choices[0].message.content.trim().length > 0) {
            console.log(`✅ [JOB PROCESSOR] Successfully generated content with ${model}`);
            break;
          } else {
            console.warn(`⚠️ [JOB PROCESSOR] Model ${model} returned empty content`);
          }
        } catch (error) {
          console.warn(`⚠️ [JOB PROCESSOR] Model ${model} failed:`, error.message);
          if (modelsToTry.indexOf(model) === modelsToTry.length - 1) {
            throw error; // Re-throw if this was the last model
          }
        }
      }
      
      if (!response) {
        throw new Error('All AI models failed to generate content');
      }

      console.log(`📝 [JOB PROCESSOR] OpenAI response for job ${jobId}:`, {
        choices: response.choices?.length || 0,
        hasContent: !!response.choices?.[0]?.message?.content,
        contentLength: response.choices?.[0]?.message?.content?.length || 0,
        model: response.model,
        finishReason: response.choices?.[0]?.finish_reason
      });

      let generatedScript = response.choices[0].message.content || '';
      
      if (!generatedScript || generatedScript.trim().length === 0) {
        throw new Error('OpenAI returned empty response');
      }
      
      // Clean the response to ensure it's valid Python code
      generatedScript = generatedScript.trim();
      
      // Remove any markdown code blocks if present
      if (generatedScript.startsWith('```python') || generatedScript.startsWith('```py')) {
        generatedScript = generatedScript.replace(/^```(python|py)\s*/, '').replace(/\s*```$/, '');
      } else if (generatedScript.startsWith('```')) {
        generatedScript = generatedScript.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      // Parse metadata from the generated script
      const lines = generatedScript.split('\n');
      const metadata = {
        name: '',
        description: '',
        tags: [] as string[],
        pythonVersion: '',
        inputs: '',
        timeout: '',
        memory: '',
        cpuLimit: ''
      };

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('# Script Name:')) {
          metadata.name = trimmed.replace('# Script Name:', '').trim();
        } else if (trimmed.startsWith('# Description:')) {
          metadata.description = trimmed.replace('# Description:', '').trim();
        } else if (trimmed.startsWith('# Tags:')) {
          const tagString = trimmed.replace('# Tags:', '').trim();
          metadata.tags = tagString.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
        } else if (trimmed.startsWith('# Python Version:')) {
          metadata.pythonVersion = trimmed.replace('# Python Version:', '').trim();
        } else if (trimmed.startsWith('# Inputs:')) {
          metadata.inputs = trimmed.replace('# Inputs:', '').trim();
        } else if (trimmed.startsWith('# Timeout:')) {
          metadata.timeout = trimmed.replace('# Timeout:', '').trim();
        } else if (trimmed.startsWith('# Memory:')) {
          metadata.memory = trimmed.replace('# Memory:', '').trim();
        } else if (trimmed.startsWith('# CPU Limit:')) {
          metadata.cpuLimit = trimmed.replace('# CPU Limit:', '').trim();
        }
      }

      // Update progress
      await storage.updateAiJob(jobId, { progress: 80 });

      // Complete job with results
      console.log(`🔍 [JOB PROCESSOR] Saving result for job ${jobId}:`, {
        scriptLength: generatedScript.length,
        metadataName: metadata.name,
        metadataKeys: Object.keys(metadata)
      });

      await storage.updateAiJob(jobId, {
        status: 'completed',
        progress: 100,
        result: {
          generatedScript: generatedScript.trim(),
          metadata
        },
        completedAt: new Date()
      });
      
      console.log(`✅ [JOB PROCESSOR] Job ${jobId} completed successfully`);
      
    } catch (error) {
      console.error(`🚨 [JOB PROCESSOR] Job ${jobId} failed:`, error);
      
      // Mark job as failed
      await storage.updateAiJob(jobId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date()
      }).catch(updateError => {
        console.error('Failed to update job status:', updateError);
      });
    }
  }

  // ===== SYSTEM SETTINGS API =====
  
  // Get user's AI model preference (with fallback to system default)
  app.get('/api/settings/ai-model-preference', async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.user?.id || "42195145";
      
      const preference = await storage.getUserSettingValue(userId, 'ai_model_preference', 'gpt-4o');
      
      res.json({ 
        value: preference,
        description: 'AI model preference for all OpenAI functionality'
      });
    } catch (error) {
      console.error('Error fetching AI model preference:', error);
      res.status(500).json({ error: 'Failed to fetch AI model preference' });
    }
  });

  // Set user's AI model preference
  app.post('/api/settings/ai-model-preference', async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.user?.id || "42195145";
      const { value } = req.body;
      
      if (!['gpt-5', 'gpt-4o', 'gpt-4'].includes(value)) {
        return res.status(400).json({ 
          error: 'Invalid AI model preference. Must be gpt-5, gpt-4o, or gpt-4' 
        });
      }

      const setting = await storage.setUserSetting({
        userId,
        settingKey: 'ai_model_preference',
        value: value
      });

      console.log(`🤖 User ${userId} set AI model preference to: ${value}`);

      res.json({ 
        success: true,
        setting,
        message: `AI model preference updated to ${value}`
      });
    } catch (error) {
      console.error('Error setting AI model preference:', error);
      res.status(500).json({ error: 'Failed to set AI model preference' });
    }
  });

  // Get all user settings
  app.get('/api/settings', async (req, res) => {
    try {
      const userId = req.user?.claims?.sub || req.session?.user?.id || "42195145";
      
      const settings = await storage.getAllUserSettings(userId);
      
      // Include AI model preference with default
      const aiModelPreference = await storage.getUserSettingValue(userId, 'ai_model_preference', 'gpt-4o');
      
      res.json({
        userSettings: settings,
        computed: {
          aiModelPreference
        }
      });
    } catch (error) {
      console.error('Error fetching user settings:', error);
      res.status(500).json({ error: 'Failed to fetch user settings' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}