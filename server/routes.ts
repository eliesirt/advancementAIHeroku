import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { transcribeAudio, extractInteractionInfo, enhanceInteractionComments, type ExtractedInteractionInfo } from "./lib/openai";
import { bbecClient } from "./lib/soap-client";
import { createAffinityMatcher } from "./lib/affinity-matcher";
import { affinityTagScheduler } from "./lib/scheduler";
import { insertInteractionSchema, insertVoiceRecordingSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get current user (simplified for demo)
  app.get("/api/user", async (req, res) => {
    try {
      const user = await storage.getUser(1); // Default user
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Failed to get user", error: (error as Error).message });
    }
  });

  // Get dashboard stats
  app.get("/api/stats", async (req, res) => {
    try {
      const userId = 1; // Default user
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
  app.get("/api/interactions/recent", async (req, res) => {
    try {
      const userId = 1; // Default user
      const limit = parseInt(req.query.limit as string) || 10;
      const interactions = await storage.getRecentInteractions(userId, limit);
      res.json(interactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to get recent interactions", error: (error as Error).message });
    }
  });

  // Get all interactions for a user
  app.get("/api/interactions", async (req, res) => {
    try {
      const userId = 1; // Default user
      const interactions = await storage.getInteractionsByUser(userId);
      res.json(interactions);
    } catch (error) {
      res.status(500).json({ message: "Failed to get interactions", error: (error as Error).message });
    }
  });

  // Get draft interactions
  app.get("/api/interactions/drafts", async (req, res) => {
    try {
      const userId = 1; // Default user
      const drafts = await storage.getDraftInteractions(userId);
      res.json(drafts);
    } catch (error) {
      res.status(500).json({ message: "Failed to get draft interactions", error: (error as Error).message });
    }
  });

  // Create voice recording
  app.post("/api/voice-recordings", async (req, res) => {
    try {
      console.log("Voice recording data received:", req.body);
      
      const recordingData = {
        userId: Number(req.body.userId) || 1,
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
      const extractedInfo = await extractInteractionInfo(transcript);
      
      // Match interests to affinity tags
      const affinityTags = await storage.getAffinityTags();
      const affinityMatcher = await createAffinityMatcher(affinityTags);
      
      const allInterests = [
        ...(Array.isArray(extractedInfo.professionalInterests) ? extractedInfo.professionalInterests : []),
        ...(Array.isArray(extractedInfo.personalInterests) ? extractedInfo.personalInterests : []),
        ...(Array.isArray(extractedInfo.philanthropicPriorities) ? extractedInfo.philanthropicPriorities : [])
      ];
      
      const matchedTags = affinityMatcher.matchInterests(allInterests, 0.3);
      const suggestedAffinityTags = matchedTags.map(match => match.tag.name);
      
      // Update recording with transcript
      await storage.updateVoiceRecording(recordingId, {
        transcript,
        processed: true,
        interactionId: recording.interactionId
      });

      // If this recording is linked to an interaction, update it with the AI-processed data
      if (recording.interactionId) {
        // Generate enhanced comments with full synopsis and transcript
        const enhancedComments = await enhanceInteractionComments(transcript, extractedInfo);
        
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
          comments: enhancedComments
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
  app.post("/api/interactions/draft", async (req, res) => {
    try {
      const draftData = {
        userId: Number(req.body.userId) || 1,
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
  app.post("/api/interactions", async (req, res) => {
    try {
      const interactionData = insertInteractionSchema.parse(req.body);
      const interaction = await storage.createInteraction(interactionData);
      res.json(interaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create interaction", error: (error as Error).message });
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
      const updates = insertInteractionSchema.partial().parse(req.body);
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

      // Submit to BBEC via SOAP API using the proper workflow
      const bbecInteractionId = await bbecClient.submitInteraction({
        constituentId: "", // Will be determined by searchConstituent
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
        affinityTags: interaction.affinityTags || []
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
      const matcher = await createAffinityMatcher(affinityTags);
      
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
      res.status(500).json({ message: "Failed to refresh affinity tags", error: (error as Error).message });
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
        refreshInterval: settings?.refreshInterval || 'daily'
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get affinity tags info", error: (error as Error).message });
    }
  });

  // Update affinity tag settings
  app.post("/api/affinity-tags/settings", async (req, res) => {
    try {
      const { autoRefresh, refreshInterval, lastRefresh, totalTags } = req.body;
      
      const settings = {
        autoRefresh: Boolean(autoRefresh),
        refreshInterval: refreshInterval || 'daily',
        lastRefresh: lastRefresh ? new Date(lastRefresh) : null,
        totalTags: totalTags || 0,
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

      const enhancedComments = await enhanceInteractionComments(transcript, extractedInfo);
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
      const extractedInfo = interaction.extractedInfo || {
        prospectName: interaction.prospectName,
        summary: interaction.summary,
        category: interaction.category,
        subcategory: interaction.subcategory,
        professionalInterests: [],
        personalInterests: [],
        philanthropicPriorities: [],
        keyPoints: [],
        suggestedAffinityTags: interaction.affinityTags || []
      } as ExtractedInteractionInfo;

      // Generate enhanced comments with synopsis
      const enhancedComments = await enhanceInteractionComments(interaction.transcript, extractedInfo);
      
      // Update interaction with enhanced comments
      await storage.updateInteraction(interactionId, {
        comments: enhancedComments
      });

      res.json({ 
        success: true,
        comments: enhancedComments,
        message: "Synopsis generated successfully" 
      });
    } catch (error) {
      console.error("Synopsis generation error:", error);
      res.status(500).json({ 
        message: "Failed to generate synopsis", 
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
      const affinityMatcher = await createAffinityMatcher(affinityTags);

      const results = [];

      // Process each interaction
      for (const interaction of validInteractions) {
        try {
          let extractedInfo = interaction.extractedInfo;
          let enhancedComments = interaction.comments;
          let suggestedAffinityTags = interaction.affinityTags || [];



          // If there's a transcript but no extracted info, process it
          if (interaction.transcript && !extractedInfo) {
            const { extractInteractionInfo, enhanceInteractionComments } = await import("./lib/openai");
            extractedInfo = await extractInteractionInfo(interaction.transcript);
            enhancedComments = await enhanceInteractionComments(interaction.transcript, extractedInfo);

          }

          // Re-match affinity tags - try current affinity tags or extract from stored info
          if (extractedInfo) {
            const parsedInfo = typeof extractedInfo === 'string' ? JSON.parse(extractedInfo) : extractedInfo;
            const allInterests = [
              ...(Array.isArray(parsedInfo.professionalInterests) ? parsedInfo.professionalInterests : []),
              ...(Array.isArray(parsedInfo.personalInterests) ? parsedInfo.personalInterests : []),
              ...(Array.isArray(parsedInfo.philanthropicPriorities) ? parsedInfo.philanthropicPriorities : [])
            ];

            if (allInterests.length > 0) {
              const matchedTags = affinityMatcher.matchInterests(allInterests, 0.3);
              suggestedAffinityTags = matchedTags.map(match => match.tag.name);
            }
          }
          
          // If still no tags, try to match existing summary/comments for interests
          if (suggestedAffinityTags.length === 0 && (interaction.summary || interaction.comments)) {
            const textToMatch = `${interaction.summary || ''} ${interaction.comments || ''}`.toLowerCase();
            const keywords = textToMatch.split(/\s+/).filter(word => word.length > 3);
            if (keywords.length > 0) {
              const matchedTags = affinityMatcher.matchInterests(keywords, 0.2);
              suggestedAffinityTags = matchedTags.map(match => match.tag.name);

            }
          }

          // Update the interaction
          await storage.updateInteraction(interaction.id, {
            extractedInfo: extractedInfo ? JSON.stringify(extractedInfo) : interaction.extractedInfo,
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
      
      if (!lastName) {
        return res.status(400).json({ message: "Last name is required" });
      }

      const { bbecClient } = await import("./lib/soap-client");
      await bbecClient.initialize();
      
      const constituents = await bbecClient.searchConstituentsByLastName(lastName);
      
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
      const userId = 1; // For now, using default user
      
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

  const httpServer = createServer(app);
  return httpServer;
}
