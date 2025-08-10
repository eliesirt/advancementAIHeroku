import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { transcribeAudio, extractInteractionInfo, enhanceInteractionComments, type ExtractedInteractionInfo } from "./lib/openai";
import { bbecClient, type BBECInteractionSubmission } from "./lib/soap-client";
import { createAffinityMatcher } from "./lib/affinity-matcher";
import { affinityTagScheduler } from "./lib/scheduler";
import { insertInteractionSchema, insertVoiceRecordingSchema } from "@shared/schema";
import { z } from "zod";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { seedInitialData } from "./seedData";

// Helper function to get current matching threshold
async function getMatchingThreshold(): Promise<number> {
  try {
    const settings = await storage.getAffinityTagSettings();
    const threshold = settings?.matchingThreshold || 25;
    // Convert from 0-100 scale to 0-1 scale for the matcher
    return threshold / 100;
  } catch (error) {
    console.warn("Failed to get matching threshold, using default:", error);
    return 0.25; // Default threshold
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
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

      // Update recording with transcript
      await storage.updateVoiceRecording(recordingId, {
        transcript,
        processed: true,
        interactionId: recording.interactionId
      });

      // If this recording is linked to an interaction, update it with the AI-processed data
      if (recording.interactionId) {
        // Generate enhanced comments with full synopsis and transcript
        const enhancedComments = await enhanceInteractionComments(transcript, extractedInfo, 1);

        // Parse first and last name from prospect name
        const parseProspectName = (fullName: string) => {
          if (!fullName || fullName.trim().length === 0) return { firstName: '', lastName: '' };

          const nameParts = fullName.trim().split(/\s+/);
          if (nameParts.length === 1) {
            return { firstName: nameParts[0], lastName: '' };
          } else if (nameParts.length === 2) {
            return { firstName: nameParts[0], lastName: nameParts[1] };
          } else {
            // For names with more than 2 parts, assume first word is first name, rest is last name
            return { 
              firstName: nameParts[0], 
              lastName: nameParts.slice(1).join(' ') 
            };
          }
        };

        const prospectName = extractedInfo.prospectName || 'Voice Recording';
        const { firstName, lastName } = parseProspectName(prospectName);

        // Get current interaction data for quality assessment
        const currentInteraction = await storage.getInteraction(recording.interactionId);

        // Evaluate interaction quality
        const { evaluateInteractionQuality } = await import("./lib/openai");
        const qualityAssessment = await evaluateInteractionQuality(
          transcript,
          extractedInfo,
          {
            prospectName: prospectName || currentInteraction?.prospectName || '',
            firstName: firstName || currentInteraction?.firstName || '',
            lastName: lastName || currentInteraction?.lastName || '',
            contactLevel: extractedInfo.contactLevel || currentInteraction?.contactLevel || '',
            method: currentInteraction?.method || '',
            actualDate: currentInteraction?.actualDate?.toISOString() || '',
            comments: enhancedComments || currentInteraction?.comments || '',
            summary: conciseSummary || currentInteraction?.summary || '',
            category: extractedInfo.category || currentInteraction?.category || '',
            subcategory: extractedInfo.subcategory || currentInteraction?.subcategory || ''
          }
        );

        await storage.updateInteraction(recording.interactionId, {
          transcript,
          extractedInfo: JSON.stringify(extractedInfo),
          summary: conciseSummary,
          prospectName,
          firstName,
          lastName,
          category: extractedInfo.category || 'General',
          subcategory: extractedInfo.subcategory || 'Other',
          affinityTags: suggestedAffinityTags,
          comments: enhancedComments,
          qualityScore: qualityAssessment.qualityScore,
          qualityExplanation: qualityAssessment.qualityExplanation,
          qualityRecommendations: qualityAssessment.recommendations
        });
      }

      res.json({
        transcript,
        extractedInfo,
        conciseSummary
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
          const extractedInfo = JSON.parse(currentInteraction.extractedInfo) as ExtractedInteractionInfo;

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
      const success = await storage.deleteInteraction(interactionId);

      if (success) {
        res.json({ success: true, message: "Interaction deleted successfully" });
      } else {
        res.status(404).json({ success: false, message: "Interaction not found" });
      }
    } catch (error) {
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
      const userId = parseInt(req.params.userId);
      const settings = await storage.getUserAiPromptSettings(userId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Failed to get AI prompt settings", error: (error as Error).message });
    }
  });

  // Get specific AI prompt setting
  app.get("/api/ai-prompt-settings/:userId/:promptType", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
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
          promptTemplate,
          updatedAt: new Date()
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
          let extractedInfo: ExtractedInteractionInfo | null = interaction.extractedInfo ? JSON.parse(interaction.extractedInfo) : null;
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
      const userId = req.user.claims.sub;

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
        const userId = req.user?.claims?.sub;
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

  // Get all users (admin only)
  app.get('/api/admin/users', isAuthenticated, requireAdmin, async (req: any, res) => {
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
      const user = await storage.createUser(userData);
      console.log("Successfully created user:", user);
      res.json(user);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user", error: (error as Error).message });
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

  const httpServer = createServer(app);
  return httpServer;
}