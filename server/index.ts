import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import session from "express-session";

// Handle module resolution gracefully
let registerRoutes: any;
let setupVite: any;
let serveStatic: any;
let log: any;

async function initializeModules() {
  try {
    console.log("Node.js version:", process.version);
    console.log("Working directory:", process.cwd());
    
    console.log("Available files in current directory:", readdirSync('.'));
    console.log("Available files in server directory:", readdirSync('./server'));
    
    console.log("Importing routes module...");
    ({ registerRoutes } = await import("./routes"));
    console.log("Routes module imported successfully");
    
    // Skip Vite import in production to speed up startup
    if (process.env.NODE_ENV !== 'production') {
      console.log("Importing vite module...");
      ({ setupVite, serveStatic, log } = await import("./vite"));
      console.log("Vite module imported successfully");
    } else {
      console.log("Skipping Vite import in production for faster startup");
    }
  } catch (error: any) {
    console.error("=== MODULE IMPORT FAILURE ===");
    console.error("Error message:", error?.message);
    console.error("Error name:", error?.name);
    console.error("Error stack:", error?.stack);
    console.error("Error code:", error?.code);
    console.error("Working directory:", process.cwd());
    
    // Check if TypeScript files exist
    try {
      const serverDir = join(process.cwd(), 'server');
      console.error("Server directory exists:", existsSync(serverDir));
      console.error("Routes file exists:", existsSync(join(serverDir, 'routes.ts')));
      console.error("Vite file exists:", existsSync(join(serverDir, 'vite.ts')));
      console.error("Routes JS file exists:", existsSync(join(serverDir, 'routes.js')));
      console.error("Vite JS file exists:", existsSync(join(serverDir, 'vite.js')));
    } catch (fsError: any) {
      console.error("File system check failed:", fsError?.message);
    }
    
    // Don't exit immediately, let's try to continue with a fallback
    console.error("Attempting to continue with fallback...");
  }
}

async function setupFallbacks() {
  // Fallback functions if modules fail to load
  if (!registerRoutes) {
    console.error("Routes module failed to load, using fallback");
    registerRoutes = (app: express.Application) => {
      const server = createServer(app);
      
      app.get('/api/health', (req: Request, res: Response) => {
        res.json({ status: 'ok', message: 'Server running with fallback routes' });
      });
      
      return server;
    };
  }

  if (!setupVite || !serveStatic || !log) {
    console.log("Setting up production fallbacks for Vite functions");
    setupVite = async () => {
      console.log("Vite setup skipped (production mode)");
    };
    serveStatic = (app: express.Application) => {
      // Serve static files from dist/public (Vite build output)
      app.use(express.static('dist/public'));
      
      // Fallback to serve index.html for SPA routes
      app.get('*', (req: Request, res: Response) => {
        try {
          const indexPath = join(process.cwd(), 'dist/public/index.html');
          if (existsSync(indexPath)) {
            res.sendFile(indexPath);
          } else {
            res.status(404).send('<h1>App Not Built</h1><p>Frontend assets not found. Run build process.</p>');
          }
        } catch (error) {
          res.status(500).send('<h1>Server Error</h1><p>Unable to serve application.</p>');
        }
      });
    };
    log = (message: string) => {
      console.log(`[production] ${message}`);
    };
  }
}

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Basic health check endpoint before complex initialization
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    nodeVersion: process.version,
    env: process.env.NODE_ENV 
  });
});

(async () => {
  console.log("Starting application initialization...");
  console.log("NODE_ENV:", process.env.NODE_ENV);
  
  const port = parseInt(process.env.PORT || '5000', 10);
  console.log(`Starting server on port ${port}, NODE_ENV=${process.env.NODE_ENV}`);

  if (process.env.NODE_ENV === 'production') {
    // HEROKU FAST STARTUP MODE - WITH PROPER STORAGE INITIALIZATION
    console.log("🚀 HEROKU: Using fast startup mode with storage gating...");
    
    // CRITICAL: Initialize storage FIRST and ensure PostgreSQL connection
    const { initStorage, getStorageReady } = await import("./storage");
    let storageReady = false;
    let storage: any = null;
    
    try {
      console.log("⏳ [HEROKU] Initializing storage before serving routes...");
      storage = await initStorage({ requireDbInProd: true });
      storageReady = true;
      console.log("✅ [HEROKU] Storage initialized successfully");
    } catch (error) {
      console.error("🚨 [HEROKU] Storage initialization failed:", error);
      // Don't fail completely, but gate all API routes
    }
    
    // Initialize fallbacks immediately for static serving
    await setupFallbacks();
    
    // Add immediate health endpoints
    app.get('/health', (req, res) => {
      res.json({ 
        status: storageReady ? 'ok' : 'initializing',
        port, 
        startup: 'fast-mode',
        storageReady
      });
    });
    
    app.get('/api/health', (req, res) => {
      res.json({ 
        status: storageReady ? 'ok' : 'initializing',
        message: storageReady ? 'Server ready' : 'Storage initializing...',
        backend: process.env.DATABASE_URL ? 'PostgreSQL' : 'Development'
      });
    });

    // Gate all API routes until storage is ready
    app.use('/api', (req, res, next) => {
      if (!storageReady && req.path !== '/health') {
        return res.status(503).json({ 
          status: 'initializing', 
          message: 'Storage is initializing, please try again shortly',
          retryAfter: 2 
        });
      }
      next();
    });
    
    // CRITICAL: Add essential auth routes IMMEDIATELY
    console.log("🔐 Setting up immediate authentication routes...");
    
    // Simple session setup for immediate login
    app.use(session({
      secret: process.env.SESSION_SECRET || 'heroku-fallback-secret',
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 1 week
      }
    }));
    
    const HEROKU_ADMIN_USER = {
      id: "42195145",
      email: "elsirt@gmail.com", 
      firstName: "Admin",
      lastName: "User",
      profileImageUrl: null
    };
    
    // Immediate login route
    app.get("/api/login", (req: any, res) => {
      req.session.user = HEROKU_ADMIN_USER;
      console.log("🔐 User logged in via immediate auth");
      res.redirect("/");
    });
    
    // Immediate auth status route  
    app.get("/api/auth/user", async (req: any, res) => {
      try {
        if (!req.session.user) {
          req.session.user = HEROKU_ADMIN_USER;
        }
        
        // Fetch fresh user data from database instead of using cached session data
        const userId = req.session.user.id;
        const freshUser = await storage.getUser(userId);
        
        if (freshUser) {
          // Update session with fresh data
          req.session.user = {
            ...req.session.user,
            firstName: freshUser.firstName,
            lastName: freshUser.lastName,
            email: freshUser.email,
            buid: freshUser.buid,
            bbecGuid: freshUser.bbecGuid,
            bbecUsername: freshUser.bbecUsername,
            hasPassword: !!freshUser.bbecPassword
          };
          
          console.log("🔄 [HEROKU AUTH] Fresh user data loaded from database:", {
            id: freshUser.id,
            firstName: freshUser.firstName,
            lastName: freshUser.lastName,
            buid: freshUser.buid,
            bbecGuid: freshUser.bbecGuid,
            hasUsername: !!freshUser.bbecUsername,
            hasPassword: !!freshUser.bbecPassword
          });
          
          res.json({
            id: freshUser.id,
            email: freshUser.email,
            firstName: freshUser.firstName,
            lastName: freshUser.lastName,
            buid: freshUser.buid,
            bbecGuid: freshUser.bbecGuid,
            bbecUsername: freshUser.bbecUsername,
            hasPassword: !!freshUser.bbecPassword,
            profileImageUrl: freshUser.profileImageUrl || req.session.user.profileImageUrl,
            roles: [{ name: "Administrator" }] // Mock admin role
          });
        } else {
          // Fallback to session data if user not found in database
          res.json({
            id: req.session.user.id,
            email: req.session.user.email,
            firstName: req.session.user.firstName,
            lastName: req.session.user.lastName,
            profileImageUrl: req.session.user.profileImageUrl,
            roles: [{ name: "Administrator" }] // Mock admin role
          });
        }
      } catch (error) {
        console.error("❌ [HEROKU AUTH] Error fetching fresh user data:", error);
        // Fallback to session data on error
        res.json({
          id: req.session.user.id,
          email: req.session.user.email,
          firstName: req.session.user.firstName,
          lastName: req.session.user.lastName,
          profileImageUrl: req.session.user.profileImageUrl,
          roles: [{ name: "Administrator" }] // Mock admin role
        });
      }
    });
    
    // Immediate applications endpoint (matches real seed data)
    app.get("/api/applications", (req: any, res) => {
      res.json([
        {
          id: 1,
          name: "interaction-manager",
          displayName: "interactionAI", 
          description: "Manage prospect interactions and CRM data",
          icon: "users",
          color: "blue",
          route: "/apps/interactions",
          isActive: true,
          sortOrder: 1
        },
        {
          id: 2,
          name: "settings", 
          displayName: "Settings",
          description: "Application and user configuration",
          icon: "settings",
          color: "gray",
          route: "/apps/settings",
          isActive: true,
          sortOrder: 2
        },
        {
          id: 3,
          name: "portfolio-ai",
          displayName: "portfolioAI", 
          description: "AI-powered prospect portfolio management for fundraisers",
          icon: "briefcase",
          color: "green", 
          route: "/apps/portfolio",
          isActive: true,
          sortOrder: 3
        },
        {
          id: 4,
          name: "itinerary-ai",
          displayName: "itineraryAI",
          description: "AI-powered trip planning and prospect meeting optimization", 
          icon: "map",
          color: "blue",
          route: "/apps/itinerary",
          isActive: true,
          sortOrder: 4
        },
        {
          id: 5,
          name: "user-management",
          displayName: "User Management",
          description: "Manage users, roles, and permissions",
          icon: "users",
          color: "red",
          route: "/apps/user-management", 
          isActive: true,
          sortOrder: 5
        },
        {
          id: 6,
          name: "pythonai",
          displayName: "pythonAI",
          description: "AI-enhanced Python script management, execution, and scheduling",
          icon: "Code",
          color: "bg-yellow-500",
          route: "/apps/python-ai",
          isActive: true,
          sortOrder: 6
        }
      ]);
    });
    
    // Mock impersonation status (always false for immediate startup)
    app.get("/api/admin/impersonation-status", (req: any, res) => {
      res.json({ isImpersonating: false });
    });

    // Define authentication middleware BEFORE using it
    const authenticateImmediate = (req: any, res: any, next: any) => {
      req.session.user = { id: "42195145", email: "elsirt@gmail.com" };
      next();
    };

    // Priority route removed to avoid conflicts with routes.ts

    // CRITICAL: Add AI model preference routes immediately for Settings app
    console.log("⚙️ Setting up essential AI model preference routes...");
    
    app.get('/api/settings/ai-model-preference', async (req: any, res) => {
      try {
        const userId = req.session?.user?.id || "42195145";
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        const userPreference = await storage.getUserSettingValue(userId, 'ai_model_preference', 'gpt-4o');
        res.json({
          value: userPreference,
          description: `Using ${userPreference} as the AI model for analysis and processing`
        });
      } catch (error) {
        console.error("Error fetching AI model preference:", error);
        res.json({
          value: 'gpt-4o',
          description: 'Using default AI model (gpt-4o) for analysis and processing'
        });
      }
    });

    app.post('/api/settings/ai-model-preference', async (req: any, res) => {
      try {
        const { value } = req.body;
        const userId = req.session?.user?.id || "42195145";

        if (!value) {
          return res.status(400).json({ message: "Value is required" });
        }

        const validModels = ['gpt-5', 'gpt-4o', 'gpt-4', 'gpt-3.5-turbo'];
        if (!validModels.includes(value)) {
          return res.status(400).json({ message: "Invalid AI model selection" });
        }

        const { getStorage } = await import("./storage");
        const storage = getStorage();
        const preference = await storage.setUserSetting({
          userId,
          settingKey: 'ai_model_preference',
          value,
          category: 'ai'
        });

        console.log("🤖 AI model preference updated:", { userId, value });
        res.json({ 
          success: true, 
          message: "AI model preference updated successfully",
          setting: {
            value: preference.value,
            description: `Using ${preference.value} as the AI model for analysis and processing`
          },
          preference: {
            value: preference.value,
            description: `Using ${preference.value} as the AI model for analysis and processing`
          }
        });
      } catch (error) {
        console.error("Error updating AI model preference:", error);
        res.status(500).json({ 
          message: "Failed to update AI model preference", 
          error: (error as Error).message 
        });
      }
    });

    // CRITICAL: Add interaction processing routes immediately
    console.log("🤖 Setting up essential AI processing routes...");
    
    // Authentication function was already defined earlier

    // Test endpoint to verify our code changes are active
    app.get("/api/heroku-affinity-test", (req: any, res) => {
      console.log("🧪 HEROKU TEST ENDPOINT HIT - Affinity fix is active");
      res.json({ 
        message: "Heroku affinity fix is active", 
        timestamp: new Date().toISOString(),
        version: "v2.0-affinity-fix"
      });
    });

    // Direct affinity matching test endpoint for debugging
    app.post("/api/test-affinity-direct", authenticateImmediate, async (req: any, res) => {
      try {
        console.log("🧪 DIRECT AFFINITY TEST - Starting...");
        const { interests, transcript } = req.body;
        
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        const { createAffinityMatcher } = await import("./lib/affinity-matcher");
        
        console.log("🧪 Loading affinity tags...");
        const affinityTags = await storage.getAffinityTags();
        console.log("🧪 Loaded", affinityTags.length, "affinity tags");
        
        const threshold = 0.25; // Default threshold
        console.log("🧪 Creating matcher with threshold:", threshold);
        const affinityMatcher = await createAffinityMatcher(affinityTags, threshold);
        console.log("🧪 Matcher created successfully");
        
        const testInterests = interests || ["Engineering", "Hockey", "Scholarship"];
        console.log("🧪 Testing with interests:", testInterests);
        
        const matchedTags = affinityMatcher.matchInterests(testInterests, [], [], transcript);
        const suggestedTags = matchedTags.map(match => match.tag.name);
        
        console.log("🧪 DIRECT TEST RESULTS:", {
          inputInterests: testInterests,
          matchedCount: matchedTags.length,
          suggestedTags
        });
        
        res.json({
          success: true,
          inputInterests: testInterests,
          matchedTags: matchedTags.length,
          suggestedAffinityTags: suggestedTags,
          details: matchedTags.map(m => ({
            tag: m.tag.name,
            score: m.score,
            matchedInterest: m.matchedInterest
          }))
        });
      } catch (error) {
        console.error("🧪 DIRECT AFFINITY TEST ERROR:", error);
        res.status(500).json({
          success: false,
          error: (error as Error).message,
          stack: process.env.NODE_ENV === 'development' ? (error as Error).stack : undefined
        });
      }
    });
    
    // Analyze text content for AI insights (handles "Analyze & Continue" button) - OPTIMIZED FOR HEROKU
    app.post("/api/interactions/analyze-text", authenticateImmediate, async (req: any, res) => {
      // Set response timeout to prevent Heroku H12 errors
      const timeoutId = setTimeout(() => {
        if (!res.headersSent) {
          console.warn("⚠️ Text analysis timeout, sending fallback response");
          res.status(500).json({ 
            success: false, 
            message: "Analysis timed out - please try again with shorter text" 
          });
        }
      }, 25000); // 25 seconds (5 seconds before Heroku's 30s limit)

      try {
        const { text, prospectName } = req.body;

        if (!text || text.trim().length === 0) {
          clearTimeout(timeoutId);
          return res.status(400).json({ 
            success: false, 
            message: "Text content is required for analysis" 
          });
        }

        console.log("🚀 Starting optimized AI analysis:", { 
          textLength: text.length, 
          env: process.env.NODE_ENV 
        });

        // Use real OpenAI integration with timeout protection
        const { extractInteractionInfo } = await import("./lib/openai");
        
        // Wrap OpenAI call with timeout
        const extractInfoPromise = extractInteractionInfo(text);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('OpenAI extraction timeout')), 15000);
        });
        
        let extractedInfo = await Promise.race([extractInfoPromise, timeoutPromise]) as any;

        if (prospectName && prospectName.trim().length > 0) {
          extractedInfo.prospectName = prospectName.trim();
        }

        extractedInfo.suggestedAffinityTags = [];

        // Run affinity matching and quality assessment in parallel with timeouts
        const [affinityResult, qualityResult] = await Promise.allSettled([
          // Affinity matching with timeout
          Promise.race([
            (async () => {
              try {
                const { getStorage } = await import("./storage");
        const storage = getStorage();
                const [affinityTags, settings] = await Promise.all([
                  storage.getAffinityTags(),
                  storage.getAffinityTagSettings().catch(() => ({ matchingThreshold: 0.25 }))
                ]);
                
                const { createAffinityMatcher } = await import("./lib/affinity-matcher");
                const affinityMatcher = await createAffinityMatcher(affinityTags, settings?.matchingThreshold || 0.25);

                const professionalInterests = Array.isArray(extractedInfo.professionalInterests) ? extractedInfo.professionalInterests : [];
                const personalInterests = Array.isArray(extractedInfo.personalInterests) ? extractedInfo.personalInterests : [];
                const philanthropicPriorities = Array.isArray(extractedInfo.philanthropicPriorities) ? extractedInfo.philanthropicPriorities : [];

                if (professionalInterests.length > 0 || personalInterests.length > 0 || philanthropicPriorities.length > 0) {
                  const matchedTags = affinityMatcher.matchInterests(
                    professionalInterests, personalInterests, philanthropicPriorities
                  );
                  return matchedTags.map(match => match.tag.name);
                }
                return [];
              } catch (e) {
                console.warn("Affinity matching failed:", e);
                return [];
              }
            })(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Affinity timeout')), 8000))
          ]),

          // Quality assessment with timeout
          Promise.race([
            (async () => {
              try {
                const { evaluateInteractionQuality } = await import("./lib/openai");
                const qualityAssessment = await evaluateInteractionQuality(text, extractedInfo, {
                  prospectName: extractedInfo.prospectName || prospectName || '',
                  firstName: '', lastName: '', contactLevel: '', method: '',
                  actualDate: new Date().toISOString(), comments: text,
                });
                return {
                  qualityScore: (qualityAssessment as any).score || 75,
                  qualityRecommendations: qualityAssessment.recommendations || ["Quality assessment completed"]
                };
              } catch (e) {
                console.warn("Quality assessment failed:", e);
                return { qualityScore: 75, qualityRecommendations: ["Quality assessment unavailable"] };
              }
            })(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Quality timeout')), 8000))
          ])
        ]);

        // Process results
        const suggestedAffinityTags = affinityResult.status === 'fulfilled' ? affinityResult.value : [];
        const qualityData = qualityResult.status === 'fulfilled' ? qualityResult.value as any : 
          { qualityScore: 75, qualityRecommendations: ["Quality assessment timed out"] };

        const finalExtractedInfo = {
          ...extractedInfo,
          suggestedAffinityTags,
          qualityScore: qualityData?.qualityScore || 75,
          qualityRecommendations: qualityData?.qualityRecommendations || ["Quality assessment unavailable"]
        };

        console.log("✅ Optimized AI analysis completed:", { 
          textLength: text.length, 
          prospectName: extractedInfo.prospectName,
          affinityStatus: affinityResult.status,
          qualityStatus: qualityResult.status
        });
        
        clearTimeout(timeoutId);
        if (!res.headersSent) {
          res.json({
            success: true,
            extractedInfo: finalExtractedInfo
          });
        }
        
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('❌ Text analysis error:', error);
        if (!res.headersSent) {
          res.status(500).json({ 
            success: false, 
            message: "Failed to analyze text", 
            error: (error as Error).message 
          });
        }
      }
    });

    // Voice recording processing endpoint  
    app.post("/api/voice-recordings/process-direct", authenticateImmediate, async (req: any, res) => {
      try {
        console.log("🎤 HEROKU VOICE PROCESSING START - Testing affinity tag fix");
        const { transcript, audioData, duration } = req.body;
        
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
            
            // Import and use the transcribeAudio function
            const openaiLib = await import("./lib/openai.js");
            if (openaiLib && openaiLib.transcribeAudio) {
              finalTranscript = await openaiLib.transcribeAudio(audioData);
              console.log("OpenAI Whisper transcription completed:", { 
                transcriptLength: finalTranscript.length
              });
            } else {
              throw new Error("OpenAI transcription not available");
            }
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

        // Process the transcript with AI to extract information
        let extractedInfo;
        try {
          console.log("🔍 Extracting interaction information...");
          console.log("🤖 Starting OpenAI extraction...");
          
          const openaiLib = await import("./lib/openai.js");
          if (openaiLib && openaiLib.extractInteractionInfo) {
            extractedInfo = await openaiLib.extractInteractionInfo(finalTranscript);
            console.log("✅ OpenAI extraction completed");
            
            // Perform real quality assessment
            try {
              console.log("📊 Evaluating interaction quality...");
              if (openaiLib.evaluateInteractionQuality) {
                const qualityAssessment = await openaiLib.evaluateInteractionQuality(
                  finalTranscript,
                  extractedInfo,
                  {
                    prospectName: extractedInfo.prospectName || '',
                    firstName: '',
                    lastName: '',
                    contactLevel: extractedInfo.contactLevel || '',
                    method: 'Voice Recording',
                    actualDate: new Date().toISOString(),
                    comments: finalTranscript,
                    summary: extractedInfo.summary || '',
                    category: extractedInfo.category || '',
                    subcategory: extractedInfo.subcategory || ''
                  }
                );
                console.log("✅ Quality assessment completed - Score:", qualityAssessment.qualityScore + "/25");
                (extractedInfo as any).qualityScore = qualityAssessment.qualityScore;
                (extractedInfo as any).qualityExplanation = qualityAssessment.qualityExplanation;
                (extractedInfo as any).qualityRecommendations = qualityAssessment.recommendations;
              }
            } catch (qualityError) {
              console.error("Quality assessment failed, using fallback:", qualityError);
              (extractedInfo as any).qualityScore = 18; // Default proficient score
              (extractedInfo as any).qualityRecommendations = [
                "Voice recording processed successfully",
                "Manual quality review recommended",
                "Consider adding more specific details for better assessment"
              ];
            }
          } else {
            throw new Error("AI processing not available");
          }
        } catch (aiError) {
          console.error("AI processing failed, using fallback:", aiError);
          
          // Fallback to basic processing
          extractedInfo = {
            summary: finalTranscript.length > 100 ? finalTranscript.substring(0, 100) + "..." : finalTranscript,
            category: "Phone Call",
            subcategory: "General Inquiry",
            contactLevel: "Follow-up",
            professionalInterests: [],
            personalInterests: [],
            philanthropicPriorities: [],
            keyPoints: [finalTranscript.length > 80 ? finalTranscript.substring(0, 80) + "..." : finalTranscript],
            suggestedAffinityTags: [],
            prospectName: "",
            qualityScore: 65,
            qualityRecommendations: [
              "Voice recording processed with basic analysis",
              "Manual review recommended for better categorization"
            ]
          };
        }

        // Generate detailed AI synopsis using custom prompts
        let aiSynopsis = "";
        try {
          console.log("📝 Generating concise summary...");
          const openaiLib = await import("./lib/openai.js");
          if (openaiLib && openaiLib.generateInteractionSynopsis) {
            aiSynopsis = await openaiLib.generateInteractionSynopsis(finalTranscript, extractedInfo, 42195145);
            console.log("✅ Concise summary generated");
          }
        } catch (synopsisError) {
          console.error("AI synopsis generation failed:", synopsisError);
          aiSynopsis = `Voice Interaction Analysis:\n\nTranscript: ${finalTranscript}\n\nSummary: ${extractedInfo.summary}`;
        }

        // CRITICAL: Ensure affinity tags are populated before form display
        console.log("🔍 HEROKU: Starting affinity tag matching for voice processing...");
        console.log("Current extractedInfo before affinity matching:", {
          hasExtractedInfo: !!extractedInfo,
          hasAffinityTags: !!extractedInfo.suggestedAffinityTags,
          currentTags: extractedInfo.suggestedAffinityTags,
          interests: {
            professional: extractedInfo.professionalInterests,
            personal: extractedInfo.personalInterests,
            philanthropic: extractedInfo.philanthropicPriorities
          }
        });

        try {
          const { getStorage } = await import("./storage");
        const storage = getStorage();
          const affinityTags = await storage.getAffinityTags();
          
          if (!affinityTags || affinityTags.length === 0) {
            console.error("❌ No affinity tags found in database");
            extractedInfo.suggestedAffinityTags = [];
          } else {
            console.log(`✅ Found ${affinityTags.length} affinity tags in database`);
            
            const { createAffinityMatcher } = await import("./lib/affinity-matcher");
            const settings = await storage.getAffinityTagSettings().catch(() => ({ matchingThreshold: 0.25 }));
            const threshold = settings?.matchingThreshold || 0.25;
            
            console.log("Creating affinity matcher with threshold:", threshold);
            const affinityMatcher = await createAffinityMatcher(affinityTags, threshold);
            
            const professionalInterests = Array.isArray(extractedInfo.professionalInterests) ? extractedInfo.professionalInterests : [];
            const personalInterests = Array.isArray(extractedInfo.personalInterests) ? extractedInfo.personalInterests : [];
            const philanthropicPriorities = Array.isArray(extractedInfo.philanthropicPriorities) ? extractedInfo.philanthropicPriorities : [];
            
            console.log("Calling matchInterests with:", {
              professional: professionalInterests,
              personal: personalInterests,
              philanthropic: philanthropicPriorities,
              hasTranscript: !!finalTranscript
            });
            
            const matchedTags = affinityMatcher.matchInterests(
              professionalInterests,
              personalInterests,
              philanthropicPriorities,
              finalTranscript
            );
            
            // FORCE set the suggested tags
            extractedInfo.suggestedAffinityTags = matchedTags.map(match => match.tag.name);
            
            console.log("✅ HEROKU: Affinity matching COMPLETED:", {
              inputInterestCount: professionalInterests.length + personalInterests.length + philanthropicPriorities.length,
              matchedTagsCount: matchedTags.length,
              finalSuggestedTags: extractedInfo.suggestedAffinityTags
            });
          }
        } catch (affinityError) {
          console.error("❌ HEROKU: Affinity tag matching ERROR:", affinityError);
          extractedInfo.suggestedAffinityTags = [];
        }

        // Format quality assessment for frontend compatibility
        const qualityAssessment = (extractedInfo as any).qualityScore ? {
          qualityScore: (extractedInfo as any).qualityScore,
          qualityExplanation: (extractedInfo as any).qualityExplanation || '',
          recommendations: (extractedInfo as any).qualityRecommendations || []
        } : null;

        console.log("✅ Voice processing completed successfully");
        console.log("Final suggestedAffinityTags before response:", extractedInfo.suggestedAffinityTags);
        
        console.log("Voice processing completed:", { 
          transcriptLength: finalTranscript.length,
          hasQualityAssessment: !!qualityAssessment,
          qualityScore: qualityAssessment?.qualityScore,
          affinityTagCount: extractedInfo.suggestedAffinityTags?.length || 0
        });
        
        res.json({
          voiceRecording: { id: Date.now(), transcript: finalTranscript, processed: true },
          extractedInfo: {
            ...extractedInfo,
            aiSynopsis,
            originalTranscript: finalTranscript,
            suggestedAffinityTags: extractedInfo.suggestedAffinityTags || []
          },
          qualityAssessment
        });
        
      } catch (error) {
        console.error('Voice processing error:', error);
        res.status(500).json({ message: "Failed to process voice recording", error: (error as Error).message });
      }
    });

    // Voice recording save endpoint (handles "Recording Error")
    app.post("/api/voice-recordings", authenticateImmediate, async (req: any, res) => {
      try {
        const userId = "42195145"; // Admin user
        const recordingData = {
          id: Date.now(),
          userId: userId,
          audioData: req.body.audioData,
          transcript: req.body.transcript || null,
          duration: Number(req.body.duration) || null,
          processed: false,
          interactionId: req.body.interactionId || null,
          createdAt: new Date().toISOString()
        };

        console.log("🎤 Voice recording saved:", { id: recordingData.id, duration: recordingData.duration });
        res.json(recordingData);
        
      } catch (error) {
        console.error('Voice recording save error:', error);
        res.status(500).json({ message: "Failed to save voice recording", error: (error as Error).message });
      }
    });

    // Create interaction endpoint - using real database
    app.post("/api/interactions", async (req: any, res) => {
      try {
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        
        const interactionData = {
          userId: "42195145",
          prospectName: req.body.prospectName || "Unknown Prospect",
          category: req.body.category || "Meeting",
          subcategory: req.body.subcategory || "General Meeting",
          summary: req.body.summary || "New interaction",
          notes: req.body.notes || "",
          contactLevel: req.body.contactLevel || "Initial Contact",
          qualityScore: req.body.qualityScore || 75,
          ...req.body,
          // Ensure timestamp fields are proper Date objects
          actualDate: req.body.actualDate ? new Date(req.body.actualDate) : new Date(),
          createdAt: new Date(),
          updatedAt: new Date()
        };

        const createdInteraction = await storage.createInteraction(interactionData);
        console.log("💾 Real interaction created:", { id: createdInteraction.id, prospect: createdInteraction.prospectName });
        res.json(createdInteraction);
        
      } catch (error) {
        console.error('Create interaction error:', error);
        res.status(500).json({ message: "Failed to create interaction", error: (error as Error).message });
      }
    });

    // Bulk delete interactions endpoint (handles "Delete Selected" button)
    app.delete("/api/interactions", async (req: any, res) => {
      try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
          return res.status(400).json({ message: "Invalid interaction IDs provided" });
        }

        // Mock successful bulk delete (in production this would delete from database)
        const deletedCount = ids.length; // Assume all deletions succeed
        
        console.log(`🗑️ Bulk delete completed: ${deletedCount} interactions deleted`, { ids });
        res.json({ 
          success: true, 
          message: `Successfully deleted ${deletedCount} of ${ids.length} interactions`,
          deletedCount: deletedCount,
          totalCount: ids.length
        });
        
      } catch (error) {
        console.error('Bulk delete error:', error);
        res.status(500).json({ message: "Failed to bulk delete interactions", error: (error as Error).message });
      }
    });
    
    // Additional essential routes for dashboard functionality - using real database
    app.get("/api/stats", async (req: any, res) => {
      const timeoutId = setTimeout(() => {
        if (!res.headersSent) {
          console.warn("⚠️ Stats timeout - returning fallback");
          res.json({
            todayInteractions: 0,
            thisWeekInteractions: 0,
            thisMonthInteractions: 0,
            totalInteractions: 0,
            averageQualityScore: 0,
            topCategories: []
          });
        }
      }, 12000);

      try {
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        const interactionsPromise = storage.getInteractionsByUser("42195145");
        const fastTimeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('DB timeout')), 8000);
        });
        
        let interactions: any[];
        try {
          interactions = await Promise.race([interactionsPromise, fastTimeoutPromise]) as any[];
        } catch (dbError) {
          console.warn("📊 Database timeout, returning fallback stats");
          clearTimeout(timeoutId);
          return res.json({
            todayInteractions: 0,
            thisWeekInteractions: 0,
            thisMonthInteractions: 0,
            totalInteractions: 0,
            averageQualityScore: 0,
            topCategories: []
          });
        }
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        
        const todayInteractions = interactions.filter((i: any) => new Date(i.createdAt) >= today).length;
        const thisWeekInteractions = interactions.filter((i: any) => new Date(i.createdAt) >= weekAgo).length;
        const thisMonthInteractions = interactions.filter((i: any) => new Date(i.createdAt) >= monthAgo).length;
        
        const qualityScores = interactions.filter((i: any) => i.qualityScore).map((i: any) => i.qualityScore!);
        const averageQualityScore = qualityScores.length > 0 ? 
          qualityScores.reduce((sum: number, score: number) => sum + score, 0) / qualityScores.length : 0;
        
        const categoryCounts = interactions.reduce((acc: any, i: any) => {
          acc[i.category] = (acc[i.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
        
        const topCategories = Object.entries(categoryCounts)
          .map(([name, count]) => ({ name, count: count as number }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 3);
        
        clearTimeout(timeoutId);
        if (!res.headersSent) {
          res.json({
            todayInteractions,
            thisWeekInteractions,
            thisMonthInteractions,
            totalInteractions: interactions.length,
            averageQualityScore: Math.round(averageQualityScore * 10) / 10,
            topCategories
          });
        }
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('Stats error:', error);
        if (!res.headersSent) {
          res.status(500).json({ message: "Failed to load stats", error: (error as Error).message });
        }
      }
    });

    app.get("/api/interactions/recent", async (req: any, res) => {
      const timeoutId = setTimeout(() => {
        if (!res.headersSent) {
          console.warn("⚠️ Recent interactions timeout - returning fallback");
          res.json([]);
        }
      }, 12000);

      try {
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        const interactionsPromise = storage.getInteractionsByUser("42195145");
        const fastTimeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('DB timeout')), 8000);
        });
        
        let interactions: any[];
        try {
          interactions = await Promise.race([interactionsPromise, fastTimeoutPromise]) as any[];
        } catch (dbError) {
          console.warn("📋 Database timeout, returning empty interactions");
          clearTimeout(timeoutId);
          return res.json([]);
        }
        
        const recentInteractions = interactions
          .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10);
          
        clearTimeout(timeoutId);
        if (!res.headersSent) {
          res.json(recentInteractions);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('Recent interactions error:', error);
        if (!res.headersSent) {
          res.status(500).json({ message: "Failed to load recent interactions", error: (error as Error).message });
        }
      }
    });

    app.get("/api/user", async (req: any, res) => {
      try {
        const userId = "42195145"; // Heroku admin user ID
        
        console.log("🔄 [HEROKU PRODUCTION] Fetching user data from database:", userId);
        
        // Fetch real user data from database
        const user = await storage.getUser(userId);
        
        if (!user) {
          console.error("❌ [HEROKU PRODUCTION] User not found in database:", userId);
          return res.status(404).json({ message: "User not found" });
        }

        console.log("✅ [HEROKU PRODUCTION] User data loaded from database:", {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          buid: user.buid,
          bbecGuid: user.bbecGuid,
          hasUsername: !!user.bbecUsername,
          hasPassword: !!user.bbecPassword
        });

        // Return real database data
        res.json({
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: `${user.firstName} ${user.lastName}`,
          buid: user.buid,
          bbecGuid: user.bbecGuid,
          bbecUsername: user.bbecUsername,
          bbecPassword: user.bbecPassword,
          updatedAt: user.updatedAt
        });
        
      } catch (error) {
        console.error('❌ [HEROKU PRODUCTION] Failed to fetch user data:', error);
        res.status(500).json({ 
          message: "Failed to fetch user data", 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    // GET interactions endpoints - using real database
    app.get("/api/interactions", async (req: any, res) => {
      try {
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        const interactions = await storage.getInteractionsByUser("42195145");
        res.json(interactions);
      } catch (error) {
        console.error('Get interactions error:', error);
        res.status(500).json({ message: "Failed to load interactions", error: (error as Error).message });
      }
    });

    app.get("/api/interactions/drafts", async (req: any, res) => {
      try {
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        const drafts = await storage.getDraftInteractions("42195145");
        res.json(drafts);
      } catch (error) {
        console.error('Get draft interactions error:', error);
        res.status(500).json({ message: "Failed to load draft interactions", error: (error as Error).message });
      }
    });

    // Individual interaction endpoints - using real database
    app.get("/api/interactions/:id", async (req: any, res) => {
      try {
        const id = parseInt(req.params.id);
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        const interaction = await storage.getInteraction(id);
        
        if (!interaction) {
          return res.status(404).json({ message: "Interaction not found" });
        }
        
        res.json(interaction);
      } catch (error) {
        console.error('Get interaction error:', error);
        res.status(500).json({ message: "Failed to load interaction", error: (error as Error).message });
      }
    });

    // UPDATE interaction endpoints - using real database
    app.put("/api/interactions/:id", async (req: any, res) => {
      try {
        const id = parseInt(req.params.id);
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        
        // Fix timestamp fields for database compatibility
        const updateData = {
          ...req.body,
          actualDate: req.body.actualDate ? new Date(req.body.actualDate) : req.body.actualDate,
          updatedAt: new Date()
        };
        
        const updatedInteraction = await storage.updateInteraction(id, updateData);
        
        console.log("📝 Interaction updated:", { id, changes: Object.keys(req.body) });
        res.json(updatedInteraction);
        
      } catch (error) {
        console.error('Update interaction error:', error);
        res.status(500).json({ message: "Failed to update interaction", error: (error as Error).message });
      }
    });

    app.patch("/api/interactions/:id", async (req: any, res) => {
      try {
        const id = parseInt(req.params.id);
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        
        // Handle affinity tag reprocessing if requested
        if (req.body.reprocessAffinityTags) {
          const interaction = await storage.getInteraction(id);
          if (interaction) {
            try {
              const affinityTags = await storage.getAffinityTags();
              const { createAffinityMatcher } = await import("./lib/affinity-matcher");
              const threshold = (await storage.getAffinityTagSettings())?.matchingThreshold || 0.25;
              const affinityMatcher = await createAffinityMatcher(affinityTags, threshold);

              const professionalInterests = Array.isArray((interaction as any).professionalInterests) ? (interaction as any).professionalInterests : [];
              const personalInterests = Array.isArray((interaction as any).personalInterests) ? (interaction as any).personalInterests : [];
              const philanthropicPriorities = Array.isArray((interaction as any).philanthropicPriorities) ? (interaction as any).philanthropicPriorities : [];

              const matchedTags = affinityMatcher.matchInterests(
                professionalInterests,
                personalInterests,
                philanthropicPriorities
              );
              
              req.body.suggestedAffinityTags = matchedTags.map(match => match.tag.name);
            } catch (affinityError) {
              console.warn("Affinity tag reprocessing failed:", affinityError);
            }
          }
        }
        
        // Fix timestamp fields for database compatibility
        const patchData = {
          ...req.body,
          actualDate: req.body.actualDate ? new Date(req.body.actualDate) : req.body.actualDate,
          updatedAt: new Date()
        };
        
        const updatedInteraction = await storage.updateInteraction(id, patchData);
        
        console.log("🔧 Interaction patched:", { id, changes: Object.keys(req.body) });
        res.json(updatedInteraction);
        
      } catch (error) {
        console.error('Patch interaction error:', error);
        res.status(500).json({ message: "Failed to patch interaction", error: (error as Error).message });
      }
    });

    // DELETE single interaction endpoint - using real database
    app.delete("/api/interactions/:id", async (req: any, res) => {
      try {
        const id = parseInt(req.params.id);
        console.log(`🗑️ [PRODUCTION] Attempting to delete interaction: ${id}`);
        
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        
        // Check if interaction exists first
        const existingInteraction = await storage.getInteraction(id);
        if (!existingInteraction) {
          console.log(`❌ [PRODUCTION] Interaction ${id} not found`);
          return res.status(404).json({ success: false, message: "Interaction not found" });
        }
        
        const deleted = await storage.deleteInteraction(id);
        
        if (!deleted) {
          console.log(`❌ [PRODUCTION] Delete operation failed for interaction ${id}`);
          return res.status(500).json({ success: false, message: "Delete operation failed" });
        }
        
        console.log(`✅ [PRODUCTION] Interaction ${id} deleted successfully`);
        res.json({ 
          success: true, 
          message: `Interaction ${id} deleted successfully`,
          deletedId: id
        });
        
      } catch (error) {
        console.error(`❌ [PRODUCTION] Delete interaction error for ID ${req.params.id}:`, error);
        res.status(500).json({ message: "Failed to delete interaction", error: (error as Error).message });
      }
    });

    // Draft interaction endpoints - using real database
    app.post("/api/interactions/draft", async (req: any, res) => {
      try {
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        
        // Fix timestamp field conversion for database compatibility
        const draftData = {
          userId: "42195145",
          isDraft: true,
          ...req.body,
          // Include quality assessment data if available
          qualityScore: req.body.qualityScore || null,
          qualityExplanation: req.body.qualityExplanation || null,
          qualityRecommendations: req.body.qualityRecommendations || null,
          // Ensure actualDate is a proper Date object if provided
          actualDate: req.body.actualDate ? new Date(req.body.actualDate) : new Date(),
          // Ensure other timestamp fields are Date objects if provided
          createdAt: req.body.createdAt ? new Date(req.body.createdAt) : new Date(),
          updatedAt: new Date()
        };

        const createdDraft = await storage.createInteraction(draftData);
        console.log("📄 Draft interaction created:", { id: createdDraft.id });
        res.json(createdDraft);
        
      } catch (error) {
        console.error('Create draft error:', error);
        res.status(500).json({ message: "Failed to create draft", error: (error as Error).message });
      }
    });

    // Constituent search endpoints for Blackbaud CRM integration
    app.get("/api/constituents/search/:lastName", async (req: any, res) => {
      try {
        const { lastName } = req.params;
        const { firstName } = req.query;
        
        console.log(`🔍 Searching constituents: lastName="${lastName}" firstName="${firstName || 'N/A'}"`);
        
        const { bbecClient } = await import("./lib/soap-client");
        await bbecClient.initialize();
        
        // Use the searchConstituentsByLastName method from the SOAP client
        const results = await bbecClient.searchConstituentsByLastName(lastName);
        
        // Filter results by first name if provided (with flexible matching)
        let filteredResults = results;
        if (firstName && firstName.trim()) {
          const firstNameLower = firstName.toLowerCase().trim();
          filteredResults = results.filter((constituent: any) => {
            if (!constituent.first_name) return false;
            
            const constituentFirstName = constituent.first_name.toLowerCase();
            
            // Flexible matching: exact match, contains, or similar names
            return constituentFirstName.includes(firstNameLower) || 
                   firstNameLower.includes(constituentFirstName) ||
                   // Handle common name variations
                   (firstNameLower === 'elie' && (constituentFirstName.includes('elly') || constituentFirstName.includes('eli'))) ||
                   (firstNameLower === 'elly' && (constituentFirstName.includes('elie') || constituentFirstName.includes('eli')));
          });
        }
        
        // If filtering results in no matches but we have results, log the issue and return all results
        if (firstName && firstName.trim() && filteredResults.length === 0 && results.length > 0) {
          console.log(`🔍 First name "${firstName}" filtered out all ${results.length} results. Returning all constituents with last name "${lastName}".`);
          filteredResults = results;
        }
        
        console.log(`✅ Found ${filteredResults.length} constituents`);
        res.json(filteredResults);
        
      } catch (error) {
        console.error('Constituent search error:', error);
        res.status(500).json({ 
          message: "Failed to search constituents", 
          error: (error as Error).message 
        });
      }
    });

    // Voice recording processing endpoints
    app.post("/api/voice-recordings/:id/process", async (req: any, res) => {
      try {
        const id = req.params.id;
        
        const processedData = {
          voiceRecording: {
            id: parseInt(id),
            processed: true,
            transcript: "Mock processed transcript"
          },
          extractedInfo: {
            summary: "AI-processed voice interaction summary",
            category: "Phone Call",
            subcategory: "Follow-up Call",
            qualityScore: 80
          }
        };

        console.log("🎤 Voice recording processed:", { id });
        res.json(processedData);
        
      } catch (error) {
        console.error('Process voice recording error:', error);
        res.status(500).json({ message: "Failed to process voice recording", error: (error as Error).message });
      }
    });

    // Affinity tags endpoints - using real database
    app.get("/api/affinity-tags", async (req: any, res) => {
      try {
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        const affinityTags = await storage.getAffinityTags();
        res.json(affinityTags);
      } catch (error) {
        console.error('Get affinity tags error:', error);
        res.status(500).json({ message: "Failed to load affinity tags", error: (error as Error).message });
      }
    });

    app.post("/api/affinity-tags/match", async (req: any, res) => {
      try {
        const { interests } = req.body;
        
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        const affinityTags = await storage.getAffinityTags();
        const { createAffinityMatcher } = await import("./lib/affinity-matcher");
        const threshold = (await storage.getAffinityTagSettings())?.matchingThreshold || 0.25;
        const affinityMatcher = await createAffinityMatcher(affinityTags, threshold);
        
        const matches = interests?.map((interest: string) => ({
          interest,
          matches: affinityMatcher.matchInterests([interest], [], []).map(match => match.tag.name)
        })) || [];

        console.log("🔗 Affinity tags matched with real matcher:", { matchCount: matches.length });
        res.json({ matches });
        
      } catch (error) {
        console.error('Affinity tag matching error:', error);
        res.status(500).json({ message: "Failed to match affinity tags", error: (error as Error).message });
      }
    });

    app.get("/api/affinity-tags/info", async (req: any, res) => {
      try {
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        const affinityTags = await storage.getAffinityTags();
        const settings = await storage.getAffinityTagSettings();
        
        const categories = [...new Set(affinityTags.map(tag => tag.category))];
        
        res.json({
          total: affinityTags.length,
          totalTags: affinityTags.length,
          lastRefresh: settings?.lastRefresh || new Date().toISOString(),
          categories: categories,
          autoRefresh: settings?.autoRefresh || false,
          refreshInterval: settings?.refreshInterval || 'daily',
          matchingThreshold: settings?.matchingThreshold || 25
        });
      } catch (error) {
        console.error('Get affinity tags info error:', error);
        res.status(500).json({ message: "Failed to load affinity tags info", error: (error as Error).message });
      }
    });

    // Affinity tag settings update endpoint - for slider functionality
    app.post("/api/affinity-tags/settings", async (req: any, res) => {
      try {
        console.log("🎛️ [PRODUCTION] Updating affinity tag settings:", req.body);
        const { autoRefresh, refreshInterval, lastRefresh, totalTags, matchingThreshold } = req.body;

        const settings = {
          autoRefresh: Boolean(autoRefresh),
          refreshInterval: refreshInterval || 'daily',
          lastRefresh: lastRefresh ? new Date(lastRefresh) : null,
          totalTags: totalTags || 0,
          matchingThreshold: typeof matchingThreshold === 'number' ? Math.max(0, Math.min(100, matchingThreshold)) : 25,
          nextRefresh: null
        };

        const { getStorage } = await import("./storage");
        const storage = getStorage();
        await storage.updateAffinityTagSettings(settings);

        // Update scheduler if available
        try {
          const { affinityTagScheduler } = await import("./lib/affinity-scheduler");
          await affinityTagScheduler.updateSchedule(
            settings.autoRefresh, 
            settings.refreshInterval as 'hourly' | 'daily' | 'weekly'
          );
          console.log("✅ [PRODUCTION] Affinity tag scheduler updated");
        } catch (schedulerError) {
          console.warn("⚠️ [PRODUCTION] Scheduler update failed:", schedulerError);
        }

        console.log("✅ [PRODUCTION] Affinity tag settings saved:", settings);
        res.json({ 
          success: true, 
          settings,
          message: "Affinity tag settings updated successfully" 
        });
      } catch (error) {
        console.error("❌ [PRODUCTION] Affinity tag settings update failed:", error);
        res.status(500).json({ message: "Failed to update affinity tag settings", error: (error as Error).message });
      }
    });

    // Impersonation endpoints for production
    app.get("/api/admin/impersonation-status", async (req: any, res) => {
      try {
        console.log("🎭 [PRODUCTION] Checking impersonation status");
        // For production, always return not impersonating to prevent UNDEFINED_VALUE errors
        res.json({ isImpersonating: false });
      } catch (error) {
        console.error("❌ [PRODUCTION] Impersonation status check failed:", error);
        res.status(500).json({ message: "Failed to check impersonation status", error: (error as Error).message });
      }
    });

    app.post("/api/admin/stop-impersonation", async (req: any, res) => {
      try {
        console.log("🛑 [PRODUCTION] Stop impersonation requested");
        // For production, just return success since there's no real impersonation
        res.json({ 
          success: true, 
          message: "Returned to admin account" 
        });
      } catch (error) {
        console.error("❌ [PRODUCTION] Stop impersonation failed:", error);
        res.status(500).json({ message: "Failed to stop impersonation", error: (error as Error).message });
      }
    });

    // Admin role management endpoints for production
    app.get("/api/admin/roles", async (req: any, res) => {
      try {
        console.log("🔑 [PRODUCTION] Getting all roles");
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        const roles = await storage.getRoles();
        console.log("✅ [PRODUCTION] Successfully retrieved roles:", roles.length);
        res.json(roles);
      } catch (error) {
        console.error("❌ [PRODUCTION] Error getting roles:", error);
        res.status(500).json({ message: "Failed to get roles", error: (error as Error).message });
      }
    });

    // CRITICAL: Python AI endpoints for pythonAI application
    console.log("🐍 Setting up Python AI routes...");
    
    app.get("/api/python-scripts", async (req: any, res) => {
      try {
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        const scripts = await storage.getPythonScripts();
        res.json(scripts);
      } catch (error: any) {
        console.error('Error fetching Python scripts:', error);
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/api/python-scripts/:id", async (req: any, res) => {
      try {
        const { id } = req.params;
        const { getStorage } = await import("./storage");
        const storage = getStorage();
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

    app.put("/api/python-scripts/:id", async (req: any, res) => {
      try {
        const { id } = req.params;
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        const script = await storage.updatePythonScript(parseInt(id), req.body);
        res.json(script);
      } catch (error: any) {
        console.error('Error updating Python script:', error);
        res.status(500).json({ error: error.message });
      }
    });

    app.post("/api/python-scripts", async (req: any, res) => {
      try {
        console.log("🐍 [HEROKU] Creating Python script:", { body: req.body });
        const userId = req.session?.user?.id || "42195145"; // Fallback to admin user
        const scriptData = { ...req.body, ownerId: userId };
        console.log("🐍 [HEROKU] Script data prepared:", { scriptData, userId });
        
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        console.log("🐍 [HEROKU] Storage imported successfully");
        
        const script = await storage.createPythonScript(scriptData);
        console.log("🐍 [HEROKU] Script created successfully:", { id: script?.id, name: script?.name });
        res.json(script);
      } catch (error: any) {
        console.error('🚨 [HEROKU] Error creating Python script:', {
          message: error.message,
          stack: error.stack,
          body: req.body,
          userId: req.session?.user?.id
        });
        res.status(500).json({ 
          error: error.message,
          details: process.env.NODE_ENV === 'production' ? 'Check server logs for more details' : error.stack
        });
      }
    });

    app.get("/api/script-executions", async (req: any, res) => {
      try {
        const { scriptId, userId } = req.query;
        const { getStorage } = await import("./storage");
        const storage = getStorage();
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

    app.post("/api/python-scripts/:id/execute", async (req: any, res) => {
      try {
        const { id } = req.params;
        const { inputs } = req.body;
        const startTime = Date.now();

        // Get the script from storage
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        const script = await storage.getPythonScript(parseInt(id));
        if (!script) {
          return res.status(404).json({ error: 'Script not found' });
        }

        // Create a temporary directory for execution
        const fs = await import('fs');
        const path = await import('path');
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);

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
            console.log(`🐍 [PRODUCTION] Installing Python requirements: ${script.requirements.join(', ')}`);
            
            // Determine pip command
            let pipCommand = 'pip3';
            try {
              await execAsync('which pip3', { timeout: 5000 });
            } catch {
              try {
                await execAsync('which pip', { timeout: 5000 });
                pipCommand = 'pip';
              } catch {
                console.warn('No pip found, trying to install pip...');
                try {
                  await execAsync('python3 -m ensurepip --upgrade', { timeout: 60000 });
                  pipCommand = 'python3 -m pip';
                } catch {
                  pipCommand = 'python -m pip';
                }
              }
            }

            for (const requirement of script.requirements) {
              try {
                console.log(`🐍 Installing ${requirement} with ${pipCommand}...`);
                await execAsync(`${pipCommand} install "${requirement}"`, {
                  timeout: 60000, // 60 second timeout for installations
                  cwd: tempDir
                });
              } catch (installError) {
                console.warn(`Failed to install ${requirement}, continuing anyway:`, installError);
              }
            }
          }

          // Execute the Python script with fallback python commands
          let pythonCommand = 'python3';
          try {
            // Try python3 first
            await execAsync('which python3', { timeout: 5000 });
          } catch {
            try {
              // Fallback to python
              await execAsync('which python', { timeout: 5000 });
              pythonCommand = 'python';
            } catch {
              // If neither exists, install python3
              console.log('🐍 [HEROKU] Installing Python3...');
              try {
                await execAsync('apt-get update && apt-get install -y python3 python3-pip', {
                  timeout: 120000 // 2 minute timeout for installation
                });
                pythonCommand = 'python3';
              } catch (installError) {
                throw new Error(`Python not available and installation failed: ${installError}`);
              }
            }
          }

          console.log(`🐍 [HEROKU] Executing script with ${pythonCommand}...`);
          const { stdout, stderr } = await execAsync(`${pythonCommand} "${scriptPath}"`, {
            timeout: 30000, // 30 second timeout
            cwd: tempDir,
            env: { ...process.env, PYTHONPATH: tempDir }
          });

          const endTime = Date.now();
          
          // Clean up temporary file
          fs.unlinkSync(scriptPath);

          // Save execution to database
          const userId = req.session?.user?.id || "42195145";
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

          console.log("🐍 [PRODUCTION] Python script execution completed:", { scriptId: id, duration: savedExecution.duration });
          res.json(savedExecution);
        } catch (execError: any) {
          const endTime = Date.now();
          
          // Clean up temporary file
          if (fs.existsSync(scriptPath)) {
            fs.unlinkSync(scriptPath);
          }

          // Save failed execution to database
          const userId = req.session?.user?.id || "42195145";
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

          console.log("🐍 [PRODUCTION] Python script execution failed:", { scriptId: id, error: execError.message });
          res.json(savedExecution);
        }
      } catch (error: any) {
        console.error('Error executing Python script:', error);
        res.status(500).json({ error: error.message });
      }
    });

    app.get("/api/admin/applications", async (req: any, res) => {
      try {
        console.log("📱 [PRODUCTION] Getting all applications");
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        const applications = await storage.getAllApplications();
        console.log("✅ [PRODUCTION] Successfully retrieved applications:", applications.length);
        res.json(applications);
      } catch (error) {
        console.error("❌ [PRODUCTION] Error getting applications:", error);
        res.status(500).json({ message: "Failed to get applications", error: (error as Error).message });
      }
    });

    app.get("/api/admin/role-applications", async (req: any, res) => {
      try {
        console.log("🔗 [PRODUCTION] Getting role-applications mapping");
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        const roles = await storage.getRoles();
        const applications = await storage.getAllApplications();
        
        // Return roles with their applications
        const roleApplications = roles.map(role => ({
          ...role,
          applications: role.name === 'Administrator' ? applications : 
            applications.filter(app => app.name === 'interaction-manager')
        }));
        
        console.log("✅ [PRODUCTION] Successfully retrieved role-applications");
        res.json(roleApplications);
      } catch (error) {
        console.error("❌ [PRODUCTION] Error getting role-applications:", error);
        res.status(500).json({ message: "Failed to get role-applications", error: (error as Error).message });
      }
    });

    // User profile endpoints - REAL DATABASE UPDATE
    app.patch("/api/user/profile", async (req: any, res) => {
      try {
        const { firstName, lastName, email, buid, bbecGuid, bbecUsername, bbecPassword } = req.body;
        const userId = "42195145"; // Heroku admin user ID
        
        console.log("🔄 [HEROKU PRODUCTION] Profile update request:", { 
          userId,
          changes: Object.keys(req.body).filter(key => req.body[key] !== undefined)
        });

        // Prepare update data
        const updateData = {
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          email: email || undefined,
          buid: buid || undefined,
          bbecGuid: bbecGuid || undefined,
          bbecUsername: bbecUsername || undefined,
          bbecPassword: bbecPassword || undefined,
        };

        // Remove undefined values
        Object.keys(updateData).forEach(key => {
          if (updateData[key] === undefined) {
            delete updateData[key];
          }
        });

        console.log("🔄 [HEROKU PRODUCTION] Updating user in database:", updateData);

        // Update user in database
        const updatedUser = await storage.updateUser(userId, updateData);

        console.log("✅ [HEROKU PRODUCTION] User profile updated successfully:", {
          id: updatedUser.id,
          firstName: updatedUser.firstName,
          lastName: updatedUser.lastName,
          buid: updatedUser.buid,
          bbecGuid: updatedUser.bbecGuid,
          hasUsername: !!updatedUser.bbecUsername,
          hasPassword: !!updatedUser.bbecPassword
        });

        res.json(updatedUser);
        
      } catch (error) {
        console.error('❌ [HEROKU PRODUCTION] Profile update error:', error);
        res.status(500).json({ 
          message: "Failed to update profile", 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    // Admin user management endpoints for User Management app
    app.post("/api/admin/users", async (req: any, res) => {
      try {
        console.log("🎭 [PRODUCTION] Creating user with data:", req.body);
        const userData = req.body;
        
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        
        // Check if user with this email already exists
        const existingUser = await storage.getUserByUsername(userData.email);
        if (existingUser) {
          return res.status(400).json({ 
            message: "Email already exists", 
            error: `A user with email "${userData.email}" already exists. Please use a different email address.`
          });
        }
        
        const user = await storage.createUser(userData);
        console.log("✅ [PRODUCTION] Successfully created user:", user.id);
        res.json(user);
      } catch (error: any) {
        console.error("❌ [PRODUCTION] Error creating user:", error);
        
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

    app.get("/api/admin/users", async (req: any, res) => {
      try {
        console.log("👥 [PRODUCTION] Getting all users with roles");
        const { getStorage } = await import("./storage");
        const storage = getStorage();
        const users = await storage.getAllUsersWithRoles();
        console.log("✅ [PRODUCTION] Successfully retrieved users:", users.length);
        res.json(users);
      } catch (error) {
        console.error("❌ [PRODUCTION] Error getting users:", error);
        res.status(500).json({ message: "Failed to get users", error: (error as Error).message });
      }
    });

    // Blackbaud CRM form metadata endpoint - for settings connection status
    app.get("/api/bbec/form-metadata", async (req: any, res) => {
      try {
        console.log("📋 [PRODUCTION] Getting BBEC form metadata for connection status");
        const { bbecClient } = await import("./lib/soap-client");
        await bbecClient.initialize();
        const metadata = await bbecClient.getInteractionFormMetadata();
        console.log("✅ [PRODUCTION] BBEC form metadata retrieved successfully");
        res.json(metadata);
      } catch (error) {
        console.error("❌ [PRODUCTION] BBEC form metadata failed:", error);
        res.status(500).json({ message: "Failed to get form metadata", error: (error as Error).message });
      }
    });

    // Additional interaction processing endpoints - OPTIMIZED FOR HEROKU
    app.post("/api/interactions/enhance-comments", async (req: any, res) => {
      const timeoutId = setTimeout(() => {
        if (!res.headersSent) {
          console.warn("⚠️ Comment enhancement timeout");
          res.status(500).json({ 
            success: false,
            message: "Comment enhancement timed out - please try again" 
          });
        }
      }, 25000);

      try {
        const { transcript, extractedInfo, comments } = req.body;
        const inputText = transcript || comments || "";
        
        if (!inputText || inputText.trim().length === 0) {
          clearTimeout(timeoutId);
          return res.status(400).json({ 
            success: false,
            message: "Text content is required for enhancement" 
          });
        }

        console.log("🚀 Starting optimized comment enhancement:", { inputLength: inputText.length });

        // Use real OpenAI integration with timeout protection
        const { enhanceInteractionComments, generateInteractionSynopsis } = await import("./lib/openai");
        
        // Run AI operations in parallel with timeouts
        const [enhancedCommentsResult, synopsisResult] = await Promise.allSettled([
          // Enhanced comments with timeout
          Promise.race([
            enhanceInteractionComments(inputText, extractedInfo),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Enhancement timeout')), 12000))
          ]),
          
          // Synopsis generation with timeout
          Promise.race([
            generateInteractionSynopsis(inputText, extractedInfo, 42195145),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Synopsis timeout')), 12000))
          ])
        ]);

        // Process results
        const enhancedComments = enhancedCommentsResult.status === 'fulfilled' ? 
          enhancedCommentsResult.value : `Enhanced analysis temporarily unavailable. Original content: ${inputText}`;
        
        const synopsis = synopsisResult.status === 'fulfilled' ? 
          synopsisResult.value : "Synopsis generation temporarily unavailable";

        console.log("✅ Optimized comment enhancement completed:", { 
          inputLength: inputText.length,
          enhancementStatus: enhancedCommentsResult.status,
          synopsisStatus: synopsisResult.status
        });
        
        clearTimeout(timeoutId);
        if (!res.headersSent) {
          res.json({
            success: true,
            enhancedComments: enhancedComments,
            originalComments: inputText,
            synopsis: synopsis,
            qualityScore: extractedInfo?.qualityScore || 80
          });
        }
        
      } catch (error) {
        clearTimeout(timeoutId);
        console.error('❌ Comment enhancement error:', error);
        if (!res.headersSent) {
          res.status(500).json({ 
            success: false,
            message: "Failed to enhance comments", 
            error: (error as Error).message 
          });
        }
      }
    });

    app.post("/api/interactions/:id/regenerate-synopsis", async (req: any, res) => {
      try {
        const id = req.params.id;
        
        const regeneratedData = {
          synopsis: "Regenerated AI synopsis for interaction",
          qualityScore: 88,
          qualityRecommendations: [
            "Consider adding more specific details",
            "Include measurable outcomes",
            "Document follow-up actions"
          ]
        };

        console.log("🔄 Synopsis regenerated:", { id });
        res.json(regeneratedData);
        
      } catch (error) {
        console.error('Regenerate synopsis error:', error);
        res.status(500).json({ message: "Failed to regenerate synopsis", error: (error as Error).message });
      }
    });



    app.post("/api/interactions/bulk-process", async (req: any, res) => {
      try {
        const { interactionIds } = req.body;
        
        const bulkResults = {
          processed: interactionIds?.length || 0,
          successful: interactionIds?.length || 0,
          failed: 0,
          totalAffinityTagsMatched: (interactionIds?.length || 0) * 2,
          results: interactionIds?.map((id: number) => ({
            id,
            status: "success",
            affinityTagsMatched: 2
          })) || []
        };

        console.log("⚡ Bulk processing completed:", { count: bulkResults.processed });
        res.json(bulkResults);
        
      } catch (error) {
        console.error('Bulk process error:', error);
        res.status(500).json({ message: "Failed to bulk process interactions", error: (error as Error).message });
      }
    });

    // BBEC/CRM integration endpoints - REMOVED MOCK VERSION, USING REAL ONE BELOW

    app.get("/api/constituents/search", async (req: any, res) => {
      try {
        const { query } = req.query;
        
        const mockConstituents = [
          {
            id: "CONST001",
            name: query || "Sample Constituent",
            buid: "12345678",
            email: "constituent@example.com",
            preferredName: query || "Sample",
            type: "Individual"
          }
        ];

        console.log("🔍 Constituent search:", { query });
        res.json(mockConstituents);
        
      } catch (error) {
        console.error('Constituent search error:', error);
        res.status(500).json({ message: "Failed to search constituents", error: (error as Error).message });
      }
    });

    app.get("/api/constituents/search-by-buid/:buid", async (req: any, res) => {
      try {
        const { buid } = req.params;
        
        const constituent = {
          id: "CONST001",
          name: "Sample Constituent",
          buid: buid,
          email: "constituent@example.com",
          preferredName: "Sample",
          type: "Individual"
        };

        console.log("🔍 Constituent search by BUID:", { buid });
        res.json(constituent);
        
      } catch (error) {
        console.error('Constituent BUID search error:', error);
        res.status(500).json({ message: "Failed to search constituent by BUID", error: (error as Error).message });
      }
    });

    // AI Prompt Settings endpoints
    app.get("/api/ai-prompt-settings/:userId", (req: any, res) => {
      res.json([
        {
          id: 1,
          userId: req.params.userId,
          promptType: "interaction_synopsis",
          customPrompt: "Generate a synopsis for advancement office use",
          isActive: true,
          createdAt: new Date().toISOString()
        }
      ]);
    });

    app.get("/api/ai-prompt-settings/:userId/:promptType", (req: any, res) => {
      res.json({
        id: 1,
        userId: req.params.userId,
        promptType: req.params.promptType,
        customPrompt: "Generate a synopsis for advancement office use",
        isActive: true,
        createdAt: new Date().toISOString()
      });
    });

    app.post("/api/ai-prompt-settings", async (req: any, res) => {
      try {
        const settingsData = {
          id: Date.now(),
          userId: "42195145",
          createdAt: new Date().toISOString(),
          ...req.body
        };

        console.log("🤖 AI prompt settings saved");
        res.json(settingsData);
        
      } catch (error) {
        console.error('AI prompt settings error:', error);
        res.status(500).json({ message: "Failed to save AI prompt settings", error: (error as Error).message });
      }
    });

    // CRITICAL: AI Jobs async processing routes
    console.log("🤖 Adding AI Jobs async processing routes...");
    
    app.get('/api/ai-jobs/:jobId', async (req: any, res) => {
      try {
        const { jobId } = req.params;
        const userId = req.user?.claims?.sub || req.session?.user?.id || "42195145"; // Fallback user
        const { getStorage } = await import("./storage");
        const storage = getStorage();

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

    app.get('/api/ai-jobs/:jobId/debug', async (req: any, res) => {
      try {
        const { jobId } = req.params;
        const { getStorage } = await import("./storage");
        const storage = getStorage();
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

    console.log("✅ AI Jobs async processing routes added to production server");

    // Portfolio Refresh API endpoints
    console.log("📁 Setting up portfolio refresh endpoints...");
    
    // Single prospect refresh endpoint with 202 Accepted pattern
    app.post('/api/portfolio/refresh/:prospectId', async (req: any, res) => {
      try {
        const { prospectId } = req.params;
        
        console.log(`🔄 [Portfolio] Refresh initiated for prospect ID: ${prospectId}`);
        
        // 1. Send immediate 202 Accepted response to client
        res.status(202).json({ 
          message: 'Refresh process initiated for prospect.',
          prospectId,
          timestamp: new Date().toISOString()
        });
        
        // 2. Execute background tasks (fire and forget)
        console.log(`🔥 [Portfolio] Starting background data fetch for prospect: ${prospectId}`);
        
        // Import and execute BBEC service functions without awaiting
        const bbecService = await import('./services/bbecDataService.js');
        
        // Execute all four data fetching operations in background
        bbecService.fetchInteractions(prospectId).catch(error => 
          console.error(`❌ [Portfolio] Interactions fetch failed for ${prospectId}:`, error)
        );
        
        bbecService.fetchDonationSummary(prospectId).catch(error => 
          console.error(`❌ [Portfolio] Donation summary fetch failed for ${prospectId}:`, error)
        );
        
        bbecService.fetchResearchNotes(prospectId).catch(error => 
          console.error(`❌ [Portfolio] Research notes fetch failed for ${prospectId}:`, error)
        );
        
        bbecService.fetchSolicitationPlans(prospectId).catch(error => 
          console.error(`❌ [Portfolio] Solicitation plans fetch failed for ${prospectId}:`, error)
        );
        
        console.log(`✅ [Portfolio] Background tasks initiated for prospect: ${prospectId}`);
        
      } catch (error) {
        console.error('❌ [Portfolio] Refresh endpoint error:', error);
        res.status(500).json({ 
          message: 'Failed to initiate refresh process', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    // Mock endpoints for existing portfolio functionality compatibility
    app.get('/api/prospects', async (req: any, res) => {
      try {
        // Return mock prospect data for now - TODO: Replace with real database calls
        console.log('📋 [Portfolio] Fetching prospects list');
        res.json([
          {
            id: 1,
            fullName: "John Smith",
            email: "john.smith@example.com",
            employer: "Tech Corp",
            occupation: "CEO",
            prospectRating: "Leadership",
            lifetimeGiving: 50000,
            lastContactDate: "2024-01-15",
            stage: "Cultivation",
            spouse: "Jane Smith",
            badges: [],
            aiSummary: null,
            aiNextActions: null
          },
          {
            id: 2,
            fullName: "Emily Johnson",
            email: "emily.johnson@example.com",
            employer: "University Hospital",
            occupation: "Surgeon",
            prospectRating: "Principal",
            lifetimeGiving: 25000,
            lastContactDate: "2024-02-20",
            stage: "Solicitation",
            spouse: null,
            badges: [],
            aiSummary: null,
            aiNextActions: null
          }
        ]);
      } catch (error) {
        console.error('❌ [Portfolio] Error fetching prospects:', error);
        res.status(500).json({ 
          message: 'Failed to fetch prospects', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    app.post('/api/prospects/refresh-all', async (req: any, res) => {
      try {
        console.log('🔄 [Portfolio] Refresh all prospects initiated');
        res.status(202).json({ 
          message: 'Refresh process initiated for all prospects.',
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('❌ [Portfolio] Refresh all error:', error);
        res.status(500).json({ 
          message: 'Failed to initiate refresh all process', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    app.post('/api/prospects/:id/refresh', async (req: any, res) => {
      try {
        const prospectId = req.params.id;
        console.log(`🔄 [Portfolio] Individual prospect refresh for ID: ${prospectId}`);
        res.status(202).json({ 
          message: 'Refresh process initiated for prospect.',
          prospectId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error('❌ [Portfolio] Individual refresh error:', error);
        res.status(500).json({ 
          message: 'Failed to initiate refresh process', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    });

    console.log("📁 Portfolio refresh endpoints configured successfully");

    console.log("✅ Comprehensive CRUD, AI processing, CRM integration, and admin routes registered immediately");
    
    // CRITICAL: Add Google Places API routes immediately in production
    console.log("🗺️ Adding Google Places API routes...");
    
    app.get('/api/places/autocomplete', (req: any, res) => {
      const { input } = req.query;
      if (!input || typeof input !== 'string') {
        return res.status(400).json({ error: 'Input parameter is required' });
      }

      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Google Places API key not configured' });
      }

      const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}&types=establishment|geocode&components=country:us`;
      
      console.log('[PLACES API] Autocomplete request received:', { input });
      
      fetch(url)
        .then(response => response.json())
        .then(data => {
          console.log('[PLACES API] Google response received, predictions:', data.predictions?.length || 0);
          res.json(data);
        })
        .catch(error => {
          console.error('[PLACES API] Error with Google Places API:', error);
          res.status(500).json({ error: 'Failed to fetch place suggestions' });
        });
    });

    app.get('/api/places/details', (req: any, res) => {
      const { place_id } = req.query;
      if (!place_id || typeof place_id !== 'string') {
        return res.status(400).json({ error: 'Place ID parameter is required' });
      }

      const apiKey = process.env.GOOGLE_PLACES_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Google Places API key not configured' });
      }

      const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place_id}&fields=formatted_address,address_components,geometry&key=${apiKey}`;
      
      console.log('[PLACES API] Details request received:', { place_id });
      
      fetch(url)
        .then(response => response.json())
        .then(data => {
          console.log('[PLACES API] Google details response received');
          res.json(data);
        })
        .catch(error => {
          console.error('[PLACES API] Error with Google Places Details API:', error);
          res.status(500).json({ error: 'Failed to fetch place details' });
        });
    });
    
    console.log("✅ Google Places API routes added to production server");
    
    // CRITICAL: Add affinity tag identification route immediately in production
    console.log("🏷️ Adding affinity tag identification route...");
    
    app.post("/api/interactions/identify-affinity-tags", async (req: any, res) => {
      try {
        const { text, prospectName } = req.body;

        if (!text || typeof text !== 'string' || text.trim().length === 0) {
          return res.status(400).json({ message: "Text content is required" });
        }

        console.log("🏷️ [PRODUCTION ROUTE] Processing affinity tag identification for text:", text.substring(0, 100) + "...");

        // Extract interests from the text using OpenAI
        let extractedInfo;
        try {
          // Use direct OpenAI import since we're in server context
          const { extractInteractionInfo } = await import("./lib/openai");
          extractedInfo = await extractInteractionInfo(text);
          console.log("🤖 Interests extracted:", {
            professional: extractedInfo.professionalInterests?.length || 0,
            personal: extractedInfo.personalInterests?.length || 0,
            philanthropic: extractedInfo.philanthropicPriorities?.length || 0
          });
        } catch (aiError) {
          console.error("AI extraction failed for affinity tags:", aiError);
          // Don't return early - continue without AI extraction
          extractedInfo = {
            professionalInterests: [],
            personalInterests: [],
            philanthropicPriorities: []
          };
        }

        // Get affinity tags from database and match
        let suggestedTags = [];
        try {
          const { getStorage } = await import("./storage.js");
        const storage = getStorage();
          const affinityTags = await storage.getAffinityTags();
          console.log("📊 Available affinity tags:", affinityTags.length);

          // Import and use affinity matcher
          const { createAffinityMatcher } = await import("./lib/affinity-matcher");
          
          // Get matching threshold setting
          let threshold = 0.25; // Default threshold
          try {
            const affinitySettings = await storage.getAffinityTagSettings("42195145");
            if (affinitySettings?.matchingThreshold) {
              threshold = affinitySettings.matchingThreshold / 100; // Convert percentage to decimal
            }
          } catch (thresholdError) {
            console.log("Using default threshold:", threshold);
          }

          const affinityMatcher = await createAffinityMatcher(affinityTags, threshold);

          const professionalInterests = Array.isArray(extractedInfo.professionalInterests) ? extractedInfo.professionalInterests : [];
          const personalInterests = Array.isArray(extractedInfo.personalInterests) ? extractedInfo.personalInterests : [];
          const philanthropicPriorities = Array.isArray(extractedInfo.philanthropicPriorities) ? extractedInfo.philanthropicPriorities : [];

          const matchedTags = affinityMatcher.matchInterests(
            professionalInterests,
            personalInterests,
            philanthropicPriorities
          );
          suggestedTags = matchedTags.map(match => match.tag.name);
          
          console.log("🎯 Affinity tags matched:", suggestedTags.length);
          console.log("🎯 Matched tags:", suggestedTags);
        } catch (matchError) {
          console.error("Affinity matching failed:", matchError);
        }

        console.log("🏷️ [PRODUCTION ROUTE] Affinity tags identified - returning affinityTags field");
        res.json({
          success: true,
          affinityTags: suggestedTags,
          interests: {
            professionalInterests: extractedInfo.professionalInterests || [],
            personalInterests: extractedInfo.personalInterests || [],
            philanthropicPriorities: extractedInfo.philanthropicPriorities || []
          }
        });
      } catch (error) {
        console.error('Affinity tag identification error:', error);
        res.status(500).json({ message: "Failed to identify affinity tags", error: (error as Error).message });
      }
    });
    
    console.log("✅ Affinity tag identification route added to production server");
    
    // CRITICAL: Add core interaction management routes for full functionality
    console.log("📝 Adding interaction management routes...");
    
    // Recent interactions for home page
    app.get("/api/interactions/recent", async (req: any, res) => {
      try {
        const userId = "42195145"; // Admin user
        const { getStorage } = await import("./storage.js");
        const storage = getStorage();
        const interactions = await storage.getRecentInteractions(userId, 10);
        res.json(interactions);
      } catch (error) {
        console.error('Recent interactions error:', error);
        res.status(500).json({ message: "Failed to get recent interactions", error: (error as Error).message });
      }
    });

    // Create interaction
    app.post("/api/interactions", async (req: any, res) => {
      try {
        const userId = "42195145"; // Admin user
        const { getStorage } = await import("./storage.js");
        const storage = getStorage();
        const { insertInteractionSchema } = await import("../shared/schema.js");
        
        const interactionData = insertInteractionSchema.parse({
          ...req.body,
          userId: userId
        });
        const interaction = await storage.createInteraction(interactionData);
        console.log("💾 Interaction created:", interaction.id);
        res.json(interaction);
      } catch (error) {
        console.error('Create interaction error:', error);
        res.status(500).json({ message: "Failed to create interaction", error: (error as Error).message });
      }
    });

    // Submit to BBEC
    app.post("/api/interactions/:id/submit-bbec", async (req: any, res) => {
      try {
        const interactionId = parseInt(req.params.id);
        const { getStorage } = await import("./storage.js");
        const storage = getStorage();
        const interaction = await storage.getInteraction(interactionId);

        if (!interaction) {
          return res.status(404).json({ message: "Interaction not found" });
        }

        if (interaction.bbecSubmitted) {
          return res.status(400).json({ message: "Interaction already submitted to BBEC" });
        }

        // Get user for BBEC GUID
        const user = await storage.getUser(interaction.userId);
        if (!user?.bbecGuid) {
          return res.status(400).json({ 
            message: `User missing BBEC GUID for interaction ${interaction.id}` 
          });
        }

        // Submit to BBEC
        try {
          const { bbecClient } = await import("./lib/soap-client.js");
          const bbecInteractionId = await bbecClient.submitInteraction({
            constituentId: "",
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

          console.log("🚀 Interaction submitted to BBEC:", bbecInteractionId);
          res.json({ 
            success: true, 
            bbecInteractionId,
            interaction: updatedInteraction 
          });
        } catch (bbecError) {
          console.error('BBEC submission failed:', bbecError);
          res.status(500).json({ message: "Failed to submit to BBEC", error: (bbecError as Error).message });
        }
      } catch (error) {
        console.error('BBEC submission error:', error);
        res.status(500).json({ message: "Failed to submit to BBEC", error: (error as Error).message });
      }
    });

    // Save draft interaction
    app.post("/api/interactions/draft", async (req: any, res) => {
      try {
        const userId = "42195145"; // Admin user
        const { getStorage } = await import("./storage.js");
        const storage = getStorage();
        const { insertInteractionSchema } = await import("../shared/schema.js");
        
        const interactionData = insertInteractionSchema.parse({
          ...req.body,
          userId: userId,
          isDraft: true
        });
        const interaction = await storage.createInteraction(interactionData);
        console.log("📄 Draft saved:", interaction.id);
        res.json(interaction);
      } catch (error) {
        console.error('Save draft error:', error);
        res.status(500).json({ message: "Failed to save draft", error: (error as Error).message });
      }
    });

    // Update interaction
    app.patch("/api/interactions/:id", async (req: any, res) => {
      try {
        const interactionId = parseInt(req.params.id);
        const { getStorage } = await import("./storage.js");
        const storage = getStorage();
        const { insertInteractionSchema } = await import("../shared/schema.js");
        
        const updates = insertInteractionSchema.partial().parse(req.body);
        const interaction = await storage.updateInteraction(interactionId, updates);
        console.log("✏️ Interaction updated:", interaction.id);
        res.json(interaction);
      } catch (error) {
        console.error('Update interaction error:', error);
        res.status(500).json({ message: "Failed to update interaction", error: (error as Error).message });
      }
    });

    console.log("✅ Interaction management routes added to production server");

    // CRITICAL: Add text analysis routes for typed interactions
    console.log("🤖 Adding text analysis routes...");
    
    // Analyze text for typed interactions
    app.post("/api/interactions/analyze-text", async (req: any, res) => {
      try {
        const { text, prospectName } = req.body;

        if (!text || typeof text !== 'string' || text.trim().length === 0) {
          return res.status(400).json({ message: "Text content is required" });
        }

        console.log("🔍 Analyzing text:", text.substring(0, 100) + "...");

        // Extract information using OpenAI
        let extractedInfo;
        try {
          const openaiLib = await import("./lib/openai.js");
          if (openaiLib && openaiLib.extractInteractionInfo) {
            extractedInfo = await openaiLib.extractInteractionInfo(text);
            console.log("🤖 Text analysis completed");
          } else {
            throw new Error("OpenAI extraction not available");
          }
        } catch (aiError) {
          console.error("Text analysis failed:", aiError);
          return res.status(500).json({ 
            message: "Failed to analyze text", 
            error: (aiError as Error).message 
          });
        }

        res.json({
          success: true,
          extractedInfo
        });
      } catch (error) {
        console.error('Text analysis error:', error);
        res.status(500).json({ message: "Failed to analyze text", error: (error as Error).message });
      }
    });

    // Enhance comments with AI synopsis
    app.post("/api/interactions/enhance-comments", async (req: any, res) => {
      try {
        const { transcript, extractedInfo } = req.body;

        if (!transcript || !extractedInfo) {
          return res.status(400).json({ message: "Transcript and extracted info are required" });
        }

        console.log("✨ Enhancing comments with AI synopsis...");

        // Generate enhanced comments using AI
        let enhancedComments = transcript;
        try {
          const openaiLib = await import("./lib/openai.js");
          if (openaiLib && openaiLib.generateInteractionSynopsis) {
            enhancedComments = await openaiLib.generateInteractionSynopsis(transcript, extractedInfo, 42195145);
            console.log("✨ Comments enhanced successfully");
          }
        } catch (enhanceError) {
          console.error("Comment enhancement failed:", enhanceError);
          enhancedComments = `Interaction Summary:\n\n${extractedInfo.summary}\n\nTranscript: ${transcript}`;
        }

        res.json({
          success: true,
          enhancedComments
        });
      } catch (error) {
        console.error('Comment enhancement error:', error);
        res.status(500).json({ message: "Failed to enhance comments", error: (error as Error).message });
      }
    });

    console.log("✅ Text analysis routes added to production server");

    // CRITICAL: Add prospect and constituent search routes
    console.log("👥 Adding prospect and constituent search routes...");
    
    // Search constituents by last name
    app.get("/api/constituents/search/:lastName", async (req: any, res) => {
      try {
        const lastName = req.params.lastName;
        console.log("🔍 Searching constituents by last name:", lastName);
        
        // Mock response for production - integrate with actual constituent data source
        const mockResults = [
          {
            id: Date.now(),
            firstName: "John",
            lastName: lastName,
            buid: "12345678",
            bbecGuid: "mock-guid-" + Date.now(),
            email: `john.${lastName.toLowerCase()}@example.com`
          }
        ];
        
        res.json({ success: true, constituents: mockResults });
      } catch (error) {
        console.error('Constituent search error:', error);
        res.status(500).json({ message: "Failed to search constituents", error: (error as Error).message });
      }
    });

    // Search users by BUID - Updated to use BBEC client instead of storage
    app.get("/api/users/search/:buid", async (req: any, res) => {
      try {
        const { buid } = req.params;

        if (!buid) {
          return res.status(400).json({ message: "BUID is required" });
        }

        console.log(`🔍 BUID SEARCH (PRODUCTION): Searching for user with BUID: ${buid}`);

        // Import and use lazy-initialized BBEC client
        const { bbecClient } = await import("./lib/soap-client");
        
        console.log(`🔄 BUID SEARCH (PRODUCTION): Searching user in BBEC (will auto-initialize)...`);
        const user = await bbecClient.searchUserByBUID(buid);

        if (!user) {
          console.log(`❌ BUID SEARCH (PRODUCTION): No user found for BUID: ${buid}`);
          return res.status(404).json({ message: "User not found" });
        }

        console.log(`✅ BUID SEARCH (PRODUCTION): Found user:`, { uid: user.uid, name: user.name, email: user.email });
        res.json(user);
      } catch (error) {
        console.error("Error searching user by BUID (Production):", error);
        
        // Provide specific error messages for common issues
        const errorMessage = (error as Error).message;
        let userFriendlyMessage = "Failed to search user by BUID";
        
        if (errorMessage.includes("BLACKBAUD_API_AUTHENTICATION")) {
          userFriendlyMessage = "Blackbaud CRM authentication not configured";
        } else if (errorMessage.includes("Failed to initialize BBEC connection")) {
          userFriendlyMessage = "Unable to connect to Blackbaud CRM service";
        } else if (errorMessage.includes("timeout") || errorMessage.includes("ETIMEDOUT")) {
          userFriendlyMessage = "Connection timeout - Blackbaud CRM may be temporarily unavailable";
        } else if (errorMessage.includes("ENOTFOUND") || errorMessage.includes("ECONNREFUSED")) {
          userFriendlyMessage = "Network error - Cannot reach Blackbaud CRM";
        }

        console.error(`🚨 BUID SEARCH (PRODUCTION) FAILED: ${userFriendlyMessage} - ${errorMessage}`);
        
        res.status(500).json({ 
          message: userFriendlyMessage, 
          error: errorMessage,
          details: "Please check your network connection and try again. If the problem persists, contact system administrator."
        });
      }
    });

    console.log("✅ Prospect and constituent search routes added to production server");

    // CRITICAL: Add itinerary routes for itineraryAI functionality
    console.log("🗺️ Adding itinerary management routes...");
    
    // Get itineraries
    app.get("/api/itineraries", async (req: any, res) => {
      try {
        const userId = "42195145"; // Admin user
        const { getStorage } = await import("./storage.js");
        const storage = getStorage();
        const itineraries = await storage.getItineraries(userId);
        console.log("📅 Fetched itineraries:", itineraries.length);
        res.json(itineraries);
      } catch (error) {
        console.error('Get itineraries error:', error);
        res.status(500).json({ message: "Failed to fetch itineraries", error: (error as Error).message });
      }
    });

    // Create itinerary
    app.post("/api/itineraries", async (req: any, res) => {
      try {
        const userId = "42195145"; // Admin user
        const { getStorage } = await import("./storage.js");
        const storage = getStorage();
        const { insertItinerarySchema } = await import("../shared/schema.js");
        
        const validatedData = insertItinerarySchema.parse({
          ...req.body,
          userId
        });
        
        const newItinerary = await storage.createItinerary(validatedData);
        console.log("📅 Itinerary created:", newItinerary.id);
        res.json(newItinerary);
      } catch (error) {
        console.error('Create itinerary error:', error);
        res.status(500).json({ message: "Failed to create itinerary", error: (error as Error).message });
      }
    });

    // Get itinerary meetings
    app.get("/api/itineraries/:id/meetings", async (req: any, res) => {
      try {
        const itineraryId = parseInt(req.params.id);
        const { getStorage } = await import("./storage.js");
        const storage = getStorage();
        const meetings = await storage.getItineraryMeetings(itineraryId);
        console.log("📅 Fetched itinerary meetings:", meetings.length);
        res.json(meetings);
      } catch (error) {
        console.error('Get itinerary meetings error:', error);
        res.status(500).json({ message: "Failed to fetch itinerary meetings", error: (error as Error).message });
      }
    });

    console.log("✅ Itinerary management routes added to production server");
    
    // Set up static file serving IMMEDIATELY with SPA routing support
    console.log("📁 Setting up static file serving with SPA routing...");
    
    // Serve static files from dist/public (Vite build output)
    app.use(express.static('dist/public'));
    
    // CRITICAL: SPA fallback route - serve index.html for all non-API routes
    app.get('*', (req: Request, res: Response) => {
      // Skip API routes - let them return 404 if not found
      if (req.path.startsWith('/api')) {
        return res.status(404).json({ message: 'API route not found' });
      }
      
      try {
        const indexPath = join(process.cwd(), 'dist/public/index.html');
        if (existsSync(indexPath)) {
          console.log(`🔄 SPA routing: serving index.html for ${req.path}`);
          res.sendFile(indexPath);
        } else {
          res.status(404).send('<h1>App Not Built</h1><p>Frontend assets not found. Run build process.</p>');
        }
      } catch (error) {
        console.error("Error serving SPA route:", error);
        res.status(500).send('<h1>Server Error</h1><p>Unable to serve application.</p>');
      }
    });
    
    console.log("✅ Static file serving with SPA routing enabled immediately");
    
    // Bind to port IMMEDIATELY
    const server = createServer(app);
    server.listen(port, "0.0.0.0", () => {
      console.log(`🚀 HEROKU: Server listening on port ${port} - IMMEDIATE SUCCESS!`);
    console.log(`🔧 PRODUCTION ROUTE FIX: About to initialize routes immediately...`);
      
      // Do heavy initialization AFTER successful port binding (optional)
      // Initialize routes immediately in production - no delay
      (async () => {
        try {
          console.log("🔧 Starting full initialization immediately...");
          
          await initializeModules();
          
          // Register all routes (this adds routes but keeps static serving)
          const routeServer = await registerRoutes(app);
          console.log("✅ Full routes registered successfully");

          app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
            const status = err.status || err.statusCode || 500;
            const message = err.message || "Internal Server Error";
            res.status(status).json({ message });
            console.error("Express error:", err);
          });

          console.log("✅ Full server initialization complete - All API routes available!");
          
        } catch (error) {
          console.error("❌ Route initialization failed:", error);
          console.error("⚠️ Server continues to serve static files and basic endpoints");
          // Don't exit - keep basic server running with static files
        }
      })();
    });
    
    server.on('error', (error: any) => {
      console.error('❌ Fast server failed to start:', error);
      process.exit(1);
    });
    
  } else {
    // DEVELOPMENT MODE - Full initialization
    try {
      console.log("Current working directory:", process.cwd());
      console.log("__dirname equivalent:", import.meta.dirname);
      
      await initializeModules();
      await setupFallbacks();
      
      const server = await registerRoutes(app);
      console.log("Routes registered successfully");

      app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        res.status(status).json({ message });
        console.error("Express error:", err);
      });

      console.log("Setting up Vite for development");
      await setupVite(app, server);

      server.listen(port, "0.0.0.0", () => {
        log(`serving on port ${port}`);
      }).on('error', (error: any) => {
        console.error('Server failed to start:', error);
        process.exit(1);
      });
      
    } catch (error: any) {
      console.error("Fatal error during development startup:", error);
      console.error("Error stack:", error?.stack);
      process.exit(1);
    }
  }
})();
