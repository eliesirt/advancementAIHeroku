import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    host: '0.0.0.0',
    allowedHosts: 'all',
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: {
      ...viteConfig.server,
      ...serverOptions,
    },
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  console.log("Setting up static file serving...");
  console.log("Current working directory:", process.cwd());
  console.log("__dirname equivalent:", import.meta.dirname);

  // Try multiple possible dist paths for Heroku compatibility
  const possiblePaths = [
    path.resolve(import.meta.dirname, "public"),
    path.resolve(import.meta.dirname, "..", "dist", "public"),
    path.resolve(process.cwd(), "dist", "public"),
    path.resolve(process.cwd(), "dist"),
    path.resolve(process.cwd(), "client", "dist")
  ];

  console.log("Checking possible static file paths:", possiblePaths);

  let distPath: string | null = null;
  for (const testPath of possiblePaths) {
    console.log(`Checking path: ${testPath}, exists: ${fs.existsSync(testPath)}`);
    if (fs.existsSync(testPath)) {
      // Check if it has index.html
      const indexPath = path.join(testPath, "index.html");
      if (fs.existsSync(indexPath)) {
        distPath = testPath;
        console.log(`Found valid static files directory: ${distPath}`);
        break;
      }
    }
  }

  if (!distPath) {
    console.error("Tried these paths for static files:", possiblePaths);
    console.error("Available files in current directory:", fs.readdirSync(process.cwd()));

    // Try to create a minimal fallback
    distPath = process.cwd();
    console.log("Using fallback path:", distPath);
  }

  console.log(`Serving static files from: ${distPath}`);

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("Application not found - build may have failed");
    }
  });
}