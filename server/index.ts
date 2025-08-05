import express, { type Request, Response, NextFunction } from "express";

// Handle module resolution gracefully
let registerRoutes: any;
let setupVite: any;
let serveStatic: any;
let log: any;

try {
  console.log("Node.js version:", process.version);
  console.log("Working directory:", process.cwd());
  console.log("Available files in current directory:", require('fs').readdirSync('.'));
  console.log("Available files in server directory:", require('fs').readdirSync('./server'));
  
  console.log("Importing routes module...");
  ({ registerRoutes } = await import("./routes"));
  console.log("Routes module imported successfully");
  
  console.log("Importing vite module...");
  ({ setupVite, serveStatic, log } = await import("./vite"));
  console.log("Vite module imported successfully");
} catch (error) {
  console.error("=== MODULE IMPORT FAILURE ===");
  console.error("Error message:", error.message);
  console.error("Error name:", error.name);
  console.error("Error stack:", error.stack);
  console.error("Error code:", error.code);
  console.error("Working directory:", process.cwd());
  
  // Check if TypeScript files exist
  const fs = require('fs');
  const path = require('path');
  
  try {
    const serverDir = path.join(process.cwd(), 'server');
    console.error("Server directory exists:", fs.existsSync(serverDir));
    console.error("Routes file exists:", fs.existsSync(path.join(serverDir, 'routes.ts')));
    console.error("Vite file exists:", fs.existsSync(serverDir, 'vite.ts'));
    console.error("Routes JS file exists:", fs.existsSync(path.join(serverDir, 'routes.js')));
    console.error("Vite JS file exists:", fs.existsSync(path.join(serverDir, 'vite.js')));
  } catch (fsError) {
    console.error("File system check failed:", fsError.message);
  }
  
  // Don't exit immediately, let's try to continue with a fallback
  console.error("Attempting to continue with fallback...");
}

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false }));

// Fallback functions if modules fail to load
if (!registerRoutes) {
  console.error("Routes module failed to load, using fallback");
  registerRoutes = (app) => {
    const http = require('http');
    const server = http.createServer(app);
    
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', message: 'Server running with fallback routes' });
    });
    
    return server;
  };
}

if (!setupVite || !serveStatic || !log) {
  console.error("Vite module failed to load, using fallback");
  setupVite = async () => {
    console.log("Vite setup skipped (fallback mode)");
  };
  serveStatic = (app) => {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.send('<h1>Application Error</h1><p>Static files not available</p>');
    });
  };
  log = (message) => {
    console.log(`[fallback] ${message}`);
  };
}

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
    }).on('error', (error) => {
      console.error('Server failed to start:', error);
      console.error('Port:', port);
      console.error('Environment:', process.env.NODE_ENV);
      process.exit(1);
    });
  } catch (error) {
    console.error("Fatal error during application startup:", error);
    console.error("Error stack:", error.stack);
    process.exit(1);
  }
})();
