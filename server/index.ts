import express, { type Request, Response, NextFunction } from "express";
import { createServer } from "http";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";

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
  try {
    console.log("Starting application initialization...");
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("Current working directory:", process.cwd());
    console.log("__dirname equivalent:", import.meta.dirname);
    
    // Initialize modules
    await initializeModules();
    
    // Setup fallbacks if needed
    await setupFallbacks();
    
    const server = await registerRoutes(app);
    console.log("Routes registered successfully");

    app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
      const status = err.status || err.statusCode || 500;
      const message = err.message || "Internal Server Error";

      res.status(status).json({ message });
      console.error("Express error:", err);
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      console.log("Setting up Vite for development");
      await setupVite(app, server);
    } else {
      console.log("Setting up static file serving for production");
      serveStatic(app);
    }

    // Use Heroku's dynamic port or fallback to 5000
    const port = process.env.PORT || 5000;
    console.log(`Starting server on port ${port}, NODE_ENV=${process.env.NODE_ENV}`);

    server.listen(port, "0.0.0.0", () => {
      log(`serving on port ${port}`);
    }).on('error', (error: any) => {
      console.error('Server failed to start:', error);
      console.error('Port:', port);
      console.error('Environment:', process.env.NODE_ENV);
      process.exit(1);
    });
  } catch (error: any) {
    console.error("Fatal error during application startup:", error);
    console.error("Error stack:", error?.stack);
    process.exit(1);
  }
})();
