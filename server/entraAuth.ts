import type { Express, RequestHandler } from "express";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { nanoid } from "nanoid";
import crypto from "crypto";
import fetch from "node-fetch";

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

interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  id_token: string;
  refresh_token?: string;
}

// Helper function to extract user info from Entra claims
function extractUserFromIdToken(idToken: string, tenantId: string): EntraUser {
  // Decode JWT payload (basic decoding without verification for demo)
  const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString());
  
  return {
    id: payload.sub || payload.oid, // Use sub or oid (object identifier)
    email: payload.email || payload.preferred_username || payload.upn,
    firstName: payload.given_name || payload.name?.split(' ')[0] || 'Unknown',
    lastName: payload.family_name || payload.name?.split(' ').slice(1).join(' ') || 'User',
    profileImageUrl: payload.picture,
    tenantId: tenantId,
    roles: payload.roles || []
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

// Generate PKCE challenge
function generatePKCEChallenge() {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

// Exchange authorization code for tokens
async function exchangeCodeForTokens(
  code: string, 
  codeVerifier: string, 
  tenantId: string, 
  clientId: string, 
  clientSecret: string,
  redirectUri: string
): Promise<TokenResponse> {
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code: code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
    code_verifier: codeVerifier,
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }

  return await response.json() as TokenResponse;
}

export async function setupEntraAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Get all configured SSO providers from database
  const ssoConfigs = await storage.getSSOConfigurations();
  
  console.log(`🔧 [ENTRA AUTH] Found ${ssoConfigs.length} SSO configurations`);

  // Dynamic login route for different tenants
  app.get("/api/auth/login/:tenantId", async (req: any, res) => {
    const { tenantId } = req.params;
    
    try {
      const config = await storage.getSSOConfiguration(tenantId);
      if (!config || !config.isActive) {
        return res.status(404).json({ error: 'SSO configuration not found or inactive' });
      }

      // Generate PKCE challenge
      const { codeVerifier, codeChallenge } = generatePKCEChallenge();
      const state = nanoid();

      // Store PKCE and state in session
      req.session.pkceCodeVerifier = codeVerifier;
      req.session.oauthState = state;
      req.session.tenantId = tenantId;

      // Build authorization URL
      const authUrl = new URL(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`);
      authUrl.searchParams.set('client_id', config.clientId);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('redirect_uri', `${process.env.BASE_URL || req.protocol + '://' + req.get('host')}/api/auth/callback/${tenantId}`);
      authUrl.searchParams.set('scope', 'openid profile email');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');
      authUrl.searchParams.set('prompt', 'select_account');

      console.log(`🔐 [ENTRA AUTH] Redirecting to: ${authUrl.toString()}`);
      res.redirect(authUrl.toString());
    } catch (error) {
      console.error('🚨 [ENTRA AUTH] Login error:', error);
      res.status(500).json({ error: 'Authentication configuration error' });
    }
  });

  // Dynamic callback route for different tenants
  app.get("/api/auth/callback/:tenantId", async (req: any, res) => {
    const { tenantId } = req.params;
    const { code, state } = req.query;

    try {
      // Verify state parameter
      if (state !== req.session.oauthState) {
        throw new Error('Invalid state parameter');
      }

      if (!code) {
        throw new Error('Authorization code not provided');
      }

      const config = await storage.getSSOConfiguration(tenantId);
      if (!config || !config.isActive) {
        throw new Error('SSO configuration not found or inactive');
      }

      // Exchange code for tokens
      const redirectUri = `${process.env.BASE_URL || req.protocol + '://' + req.get('host')}/api/auth/callback/${tenantId}`;
      const tokens = await exchangeCodeForTokens(
        code as string,
        req.session.pkceCodeVerifier,
        tenantId,
        config.clientId,
        config.clientSecret,
        redirectUri
      );

      // Extract user info from ID token
      const entraUser = extractUserFromIdToken(tokens.id_token, tenantId);
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

      // Create SSO session
      await storage.createSSOSession({
        userId: entraUser.id,
        tenantId: tenantId,
        provider: 'entra',
        providerUserId: entraUser.id,
        sessionData: {
          claims: {
            sub: entraUser.id,
            email: entraUser.email,
            name: `${entraUser.firstName} ${entraUser.lastName}`,
            roles: entraUser.roles
          },
          tokens: {
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in
          }
        },
        expiresAt: new Date(Date.now() + tokens.expires_in * 1000)
      });

      // Set user session
      req.session.user = {
        claims: {
          sub: entraUser.id,
          email: entraUser.email,
          first_name: entraUser.firstName,
          last_name: entraUser.lastName,
          tenant_id: tenantId
        },
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Math.floor(Date.now() / 1000) + tokens.expires_in
      };

      // Clear temporary session data
      delete req.session.pkceCodeVerifier;
      delete req.session.oauthState;
      delete req.session.tenantId;

      console.log('✅ [ENTRA AUTH] User authenticated successfully');
      res.redirect("/");
    } catch (error) {
      console.error('🚨 [ENTRA AUTH] Callback error:', error);
      res.redirect(`/auth/error?tenant=${tenantId}&error=${encodeURIComponent(error instanceof Error ? error.message : 'Authentication failed')}`);
    }
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
          loginUrl: `/api/auth/login/${config.tenantId}`,
          buttonColor: config.buttonColor,
          logoUrl: config.logoUrl,
          loginHint: config.loginHint
        }));
      
      res.json(activeProviders);
    } catch (error) {
      console.error('🚨 [ENTRA AUTH] Provider discovery error:', error);
      res.status(500).json({ error: 'Failed to retrieve SSO providers' });
    }
  });

  // Logout route
  app.get("/api/auth/logout", (req: any, res) => {
    const tenantId = req.session.user?.claims?.tenant_id;
    
    // Destroy session
    req.session.destroy((err: any) => {
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
    const { tenant, error } = req.query;
    res.status(401).json({ 
      error: 'Authentication failed', 
      details: error || 'Unknown error',
      tenant,
      message: 'Please contact your administrator if this issue persists.',
      timestamp: new Date().toISOString()
    });
  });
}

export const isAuthenticated: RequestHandler = async (req: any, res, next) => {
  const user = req.session?.user;

  if (!user?.claims?.sub) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // Check if token is expired
  if (user.expires_at && user.expires_at < Math.floor(Date.now() / 1000)) {
    console.log('🔄 [ENTRA AUTH] Token expired, requiring re-authentication');
    return res.status(401).json({ message: "Token expired" });
  }

  // Mock req.user for compatibility with existing code
  req.user = user;
  req.isAuthenticated = () => true;

  next();
};

// Export alias for compatibility with dynamic import
export const setupAuth = setupEntraAuth;