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
  app.use(getSession());

  // Create admin user if it doesn't exist
  try {
    await storage.upsertUser(HEROKU_ADMIN_USER);
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
  // For Heroku, auto-authenticate as admin if no session exists
  if (!req.session.user) {
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

  req.isAuthenticated = () => true;
  
  next();
};