import type { Express, RequestHandler } from "express";
import passport from "passport";
import { Strategy as OIDCStrategy } from "passport-openid-connect";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

// Shared session configuration
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
    secret: process.env.SESSION_SECRET!,
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

interface EntraUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  tenantId: string;
  roles?: string[];
}

// Helper function to extract user info from Entra claims
function extractUserFromClaims(claims: any, tenantId: string): EntraUser {
  return {
    id: claims.sub || claims.oid, // Use sub or oid (object identifier)
    email: claims.email || claims.preferred_username || claims.upn,
    firstName: claims.given_name || claims.name?.split(' ')[0] || 'Unknown',
    lastName: claims.family_name || claims.name?.split(' ').slice(1).join(' ') || 'User',
    profileImageUrl: claims.picture,
    tenantId: tenantId,
    roles: claims.roles || []
  };
}

// Helper function to map Entra roles to internal roles
function mapEntraRolesToInternal(entraRoles: string[]): string[] {
  const roleMapping: Record<string, string> = {
    'admin': 'Administrator',
    'administrator': 'Administrator',
    'user': 'User',
    'staff': 'User',
    'faculty': 'User',
    'student': 'User'
  };

  const mappedRoles = entraRoles
    .map(role => roleMapping[role.toLowerCase()] || 'User')
    .filter((role, index, arr) => arr.indexOf(role) === index); // Remove duplicates

  // Ensure at least User role is assigned
  if (mappedRoles.length === 0) {
    mappedRoles.push('User');
  }

  return mappedRoles;
}

export async function setupEntraAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // Get all configured SSO providers from database
  const ssoConfigs = await storage.getSSOConfigurations();
  
  for (const config of ssoConfigs) {
    if (config.provider === 'entra' && config.isActive) {
      const strategy = new OIDCStrategy({
        name: `entra-${config.tenantId}`,
        issuer: `https://login.microsoftonline.com/${config.tenantId}/v2.0`,
        clientID: config.clientId,
        clientSecret: config.clientSecret,
        callbackURL: `${process.env.BASE_URL || 'https://localhost:5000'}/api/auth/callback/${config.tenantId}`,
        scope: ['openid', 'profile', 'email'],
        skipUserProfile: false
      }, async (req: any, issuer: string, profile: any, context: any, idToken: any, accessToken: any, refreshToken: any, params: any, verified: any) => {
        try {
          console.log('🔐 [ENTRA AUTH] Processing login for tenant:', config.tenantId);
          
          const entraUser = extractUserFromClaims(idToken.claims, config.tenantId);
          console.log('👤 [ENTRA AUTH] Extracted user:', { 
            id: entraUser.id, 
            email: entraUser.email, 
            tenantId: entraUser.tenantId 
          });

          // Map Entra roles to internal roles
          const internalRoles = mapEntraRolesToInternal(entraUser.roles || []);
          
          // Upsert user in our system
          await storage.upsertUser({
            id: entraUser.id,
            email: entraUser.email,
            firstName: entraUser.firstName,
            lastName: entraUser.lastName,
            profileImageUrl: entraUser.profileImageUrl || null,
          });

          // Ensure user has appropriate roles
          await storage.ensureUserRoles(entraUser.id, internalRoles);

          const user = {
            claims: {
              sub: entraUser.id,
              email: entraUser.email,
              first_name: entraUser.firstName,
              last_name: entraUser.lastName,
              tenant_id: entraUser.tenantId
            },
            access_token: accessToken,
            refresh_token: refreshToken,
            expires_at: Math.floor(Date.now() / 1000) + (params.expires_in || 3600)
          };

          console.log('✅ [ENTRA AUTH] User authenticated successfully');
          return verified(null, user);
        } catch (error) {
          console.error('🚨 [ENTRA AUTH] Authentication error:', error);
          return verified(error, null);
        }
      });

      passport.use(strategy);
      console.log(`🔧 [ENTRA AUTH] Configured strategy for tenant: ${config.tenantId}`);
    }
  }

  // Passport serialization
  passport.serializeUser((user: any, cb) => cb(null, user));
  passport.deserializeUser((user: any, cb) => cb(null, user));

  // Dynamic login route for different tenants
  app.get("/api/auth/login/:tenantId", async (req, res, next) => {
    const { tenantId } = req.params;
    
    try {
      const config = await storage.getSSOConfiguration(tenantId);
      if (!config || !config.isActive) {
        return res.status(404).json({ error: 'SSO configuration not found or inactive' });
      }

      passport.authenticate(`entra-${tenantId}`, {
        prompt: 'select_account',
        scope: ['openid', 'profile', 'email']
      })(req, res, next);
    } catch (error) {
      console.error('🚨 [ENTRA AUTH] Login error:', error);
      res.status(500).json({ error: 'Authentication configuration error' });
    }
  });

  // Dynamic callback route for different tenants
  app.get("/api/auth/callback/:tenantId", async (req, res, next) => {
    const { tenantId } = req.params;
    
    passport.authenticate(`entra-${tenantId}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: `/auth/error?tenant=${tenantId}`,
    })(req, res, next);
  });

  // SSO provider discovery endpoint
  app.get("/api/auth/providers", async (req, res) => {
    try {
      const configs = await storage.getSSOConfigurations();
      const activeProviders = configs
        .filter(config => config.isActive)
        .map(config => ({
          tenantId: config.tenantId,
          provider: config.provider,
          displayName: config.displayName,
          loginUrl: `/api/auth/login/${config.tenantId}`
        }));
      
      res.json(activeProviders);
    } catch (error) {
      console.error('🚨 [ENTRA AUTH] Provider discovery error:', error);
      res.status(500).json({ error: 'Failed to retrieve SSO providers' });
    }
  });

  // Logout route
  app.get("/api/auth/logout", (req: any, res) => {
    const tenantId = req.user?.claims?.tenant_id;
    
    req.logout((err: any) => {
      if (err) {
        console.error('🚨 [ENTRA AUTH] Logout error:', err);
        return res.redirect("/");
      }
      
      // If user came from Entra, redirect to Entra logout
      if (tenantId) {
        const logoutUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/logout?post_logout_redirect_uri=${encodeURIComponent(req.protocol + '://' + req.get('host'))}`;
        return res.redirect(logoutUrl);
      }
      
      res.redirect("/");
    });
  });

  // Error handling route
  app.get("/auth/error", (req, res) => {
    const tenant = req.query.tenant;
    res.status(401).json({ 
      error: 'Authentication failed', 
      tenant,
      message: 'Please contact your administrator if this issue persists.',
      timestamp: new Date().toISOString()
    });
  });
}

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  const user = req.user as any;

  if (!req.isAuthenticated() || !user?.claims?.sub) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Check if token is expired
  if (user.expires_at && user.expires_at < Math.floor(Date.now() / 1000)) {
    // For Entra tokens, we might want to attempt refresh
    if (user.refresh_token && user.claims.tenant_id) {
      try {
        // Token refresh logic would go here
        // For now, we'll require re-authentication
        console.log('🔄 [ENTRA AUTH] Token expired, requiring re-authentication');
        return res.status(401).json({ message: "Token expired" });
      } catch (error) {
        console.error('🚨 [ENTRA AUTH] Token refresh failed:', error);
        return res.status(401).json({ message: "Token refresh failed" });
      }
    } else {
      return res.status(401).json({ message: "Token expired" });
    }
  }

  next();
};