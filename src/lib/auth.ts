// ABOUTME: Authentication module using Supabase with Google OAuth browser redirect flow
// ABOUTME: Handles sign-in via browser, local callback server, and token management

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'http';
import { parse as parseUrl } from 'url';
import open from 'open';
import {
  getSupabaseUrl,
  getSupabaseAnonKey,
  setAuth as saveAuth,
  getAuth,
  clearAuth as clearStoredAuth,
} from './config.js';
import type { AuthStatus, StoredAuth, OAuthCallbackParams } from './types.js';

let supabaseClient: SupabaseClient | null = null;

/**
 * Get or create Supabase client instance
 */
function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: {
        flowType: 'pkce',
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }
  return supabaseClient;
}

/**
 * Find an available port for the OAuth callback server
 */
async function findAvailablePort(startPort: number = 54321): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.listen(startPort, () => {
      const port = (server.address() as any).port;
      server.close(() => resolve(port));
    });
    server.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        resolve(findAvailablePort(startPort + 1));
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Start local HTTP server to handle OAuth callback
 */
async function startCallbackServer(port: number): Promise<OAuthCallbackParams> {
  return new Promise((resolve, reject) => {
    let server: Server | null = null;
    const timeout = setTimeout(() => {
      if (server) {
        server.close();
      }
      reject(new Error('OAuth callback timeout after 5 minutes'));
    }, 5 * 60 * 1000); // 5 minute timeout

    server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = parseUrl(req.url || '', true);

      // Handle the callback
      if (url.pathname === '/callback') {
        const params = url.query as OAuthCallbackParams;

        // Send success response to browser
        res.writeHead(200, { 'Content-Type': 'text/html' });
        if (params.error) {
          res.end(`
            <html>
              <head><title>Authentication Failed</title></head>
              <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1>Authentication Failed</h1>
                <p>${params.error_description || params.error}</p>
                <p>You can close this window.</p>
              </body>
            </html>
          `);
        } else {
          res.end(`
            <html>
              <head><title>Authentication Successful</title></head>
              <body style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1>Authentication Successful!</h1>
                <p>You can close this window and return to the terminal.</p>
              </body>
            </html>
          `);
        }

        // Close server and resolve
        clearTimeout(timeout);
        server?.close();
        resolve(params);
      } else {
        // Handle other requests
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(port, () => {
      console.log(`OAuth callback server listening on http://localhost:${port}`);
    });

    server.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Open browser for Google sign-in via Supabase and handle OAuth callback
 * @throws {Error} If authentication fails or times out
 */
export async function authenticate(): Promise<void> {
  const supabase = getSupabaseClient();

  // Find available port for callback server
  const port = await findAvailablePort();
  const redirectUrl = `http://localhost:${port}/callback`;

  // Generate OAuth URL
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    throw new Error(`Failed to generate OAuth URL: ${error?.message || 'Unknown error'}`);
  }

  console.log('Opening browser for Google sign-in...');
  console.log('If the browser does not open, visit this URL:');
  console.log(data.url);

  // Open browser and start callback server
  const [callbackParams] = await Promise.all([
    startCallbackServer(port),
    open(data.url).catch((err) => {
      console.warn('Failed to open browser automatically:', err.message);
    }),
  ]);

  // Check for OAuth errors
  if (callbackParams.error) {
    throw new Error(
      `OAuth authentication failed: ${callbackParams.error_description || callbackParams.error}`
    );
  }

  // Extract tokens from callback
  const accessToken = callbackParams.access_token;
  const refreshToken = callbackParams.refresh_token;
  const expiresIn = parseInt(callbackParams.expires_in || '3600', 10);

  if (!accessToken || !refreshToken) {
    throw new Error('Missing access_token or refresh_token in OAuth callback');
  }

  // Exchange tokens for session to get user info
  const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError || !sessionData.user) {
    throw new Error(`Failed to establish session: ${sessionError?.message || 'Unknown error'}`);
  }

  // Store tokens
  const auth: StoredAuth = {
    accessToken,
    refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
    user: {
      email: sessionData.user.email || '',
      id: sessionData.user.id,
    },
  };

  saveAuth(auth);
  console.log(`Successfully authenticated as ${auth.user.email}`);
}

/**
 * Check authentication status
 */
export function checkAuth(): AuthStatus {
  const auth = getAuth();

  if (!auth) {
    return {
      authenticated: false,
      isExpired: true,
    };
  }

  const now = Math.floor(Date.now() / 1000);
  const isExpired = now >= auth.expiresAt;

  return {
    authenticated: !isExpired,
    email: auth.user.email,
    expiresAt: auth.expiresAt,
    isExpired,
  };
}

/**
 * Get current access token
 * @throws {Error} If not authenticated or token is expired (fail-fast)
 */
export function getAccessToken(): string {
  const auth = getAuth();

  if (!auth) {
    throw new Error('Not authenticated. Please run authentication first.');
  }

  const now = Math.floor(Date.now() / 1000);
  if (now >= auth.expiresAt) {
    throw new Error('Access token has expired. Please re-authenticate.');
  }

  return auth.accessToken;
}

/**
 * Clear stored authentication tokens (logout)
 */
export function clearAuth(): void {
  clearStoredAuth();
  console.log('Authentication cleared successfully');
}
