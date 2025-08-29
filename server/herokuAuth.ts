import type { Express, RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET || 'heroku-fallback-secret',
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

// Simple mock user for Heroku deployment
const HEROKU_ADMIN_USER = {
  id: "42195145", // Using the admin ID from the logs
  email: "elsirt@gmail.com", // Admin email
  firstName: "Admin",
  lastName: "User",
  profileImageUrl: null
};

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  
  // Sessions table should be created by heroku-postbuild.mjs
  // This is just a fallback check
  console.log('ℹ️ [HEROKU AUTH] Assuming sessions table exists (created by post-build script)');
  
  app.use(getSession());

  // Create admin user if it doesn't exist
  try {
    await storage.upsertUser(HEROKU_ADMIN_USER);
    console.log('✅ [HEROKU AUTH] Admin user verified/created');
  } catch (error) {
    console.warn("Failed to create admin user:", error);
  }

  // Simple login endpoint for Heroku (auto-login as admin)
  app.get("/api/login", (req: any, res) => {
    // Auto-login as admin user for Heroku deployment
    req.session.user = HEROKU_ADMIN_USER;
    res.redirect("/");
  });

  app.get("/api/logout", (req: any, res) => {
    req.session.destroy(() => {
      res.redirect("/");
    });
  });

  // Auth status endpoint
  app.get("/api/auth/status", (req: any, res) => {
    if (req.session.user) {
      res.json({ authenticated: true, user: req.session.user });
    } else {
      res.json({ authenticated: false });
    }
  });
}

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  try {
    console.log(`🔍 [HEROKU AUTH] Authentication check for ${req.method} ${req.path}`);
    console.log(`🔍 [HEROKU AUTH] Session exists: ${!!req.session}`);
    console.log(`🔍 [HEROKU AUTH] Session user: ${JSON.stringify(req.session?.user)}`);
    
    // For Heroku, auto-authenticate as admin if no session exists
    if (!req.session?.user) {
      console.log('🔐 [HEROKU AUTH] Auto-authenticating user');
      req.session.user = HEROKU_ADMIN_USER;
    }

    // Mock the user object structure expected by the routes
    req.user = {
      claims: {
        sub: req.session.user.id,
        email: req.session.user.email,
        first_name: req.session.user.firstName,
        last_name: req.session.user.lastName,
      }
    };

    console.log(`✅ [HEROKU AUTH] User authenticated: ${req.user.claims.sub}`);
    req.isAuthenticated = () => true;
    
    next();
  } catch (error) {
    console.error('🚨 [HEROKU AUTH] Authentication error:', error);
    // For API routes, return JSON error instead of redirecting
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ 
        error: 'Authentication failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        path: req.path,
        timestamp: new Date().toISOString()
      });
    }
    // For non-API routes, redirect to login
    res.redirect('/api/login');
  }
};