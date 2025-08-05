import express, { type Request, Response, NextFunction } from "express";

// Handle module resolution gracefully
let registerRoutes: any;
let setupVite: any;
let serveStatic: any;
let log: any;

try {
  ({ registerRoutes } = await import("./routes"));
  ({ setupVite, serveStatic, log } = await import("./vite"));
} catch (error) {
  console.error("Failed to import modules:", error);
  console.error("Error details:", error);
  // Don't exit immediately, log more details
  throw error;
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

(async () => {
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
    throw err;
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
})();
