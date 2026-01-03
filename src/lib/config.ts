// ABOUTME: Configuration management using conf package for secure token storage
// ABOUTME: Handles backend URL, Supabase credentials, and auth token persistence

import Conf from 'conf';
import type { QuiboConfig, StoredAuth } from './types.js';

/**
 * Configuration store using conf package
 * Data stored in ~/.config/quibo-mcp/config.json
 */
const store = new Conf<QuiboConfig>({
  projectName: 'quibo-mcp',
  defaults: {
    backendUrl: process.env.QUIBO_BACKEND_URL || 'http://localhost:8000',
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  },
});

/**
 * Get backend URL (configurable via QUIBO_BACKEND_URL env var)
 */
export function getBackendUrl(): string {
  return store.get('backendUrl');
}

/**
 * Get Supabase URL from config or environment
 * @throws {Error} If SUPABASE_URL is not configured
 */
export function getSupabaseUrl(): string {
  const url = store.get('supabaseUrl');
  if (!url) {
    throw new Error('SUPABASE_URL environment variable is required');
  }
  return url;
}

/**
 * Get Supabase anonymous key from config or environment
 * @throws {Error} If SUPABASE_ANON_KEY is not configured
 */
export function getSupabaseAnonKey(): string {
  const key = store.get('supabaseAnonKey');
  if (!key) {
    throw new Error('SUPABASE_ANON_KEY environment variable is required');
  }
  return key;
}

/**
 * Store authentication tokens securely
 */
export function setAuth(auth: StoredAuth): void {
  store.set('auth', auth);
}

/**
 * Retrieve stored authentication tokens
 */
export function getAuth(): StoredAuth | undefined {
  return store.get('auth');
}

/**
 * Clear stored authentication tokens
 */
export function clearAuth(): void {
  store.delete('auth');
}

/**
 * Get the full configuration object
 */
export function getConfig(): QuiboConfig {
  return store.store;
}

/**
 * Get the config file path for debugging
 */
export function getConfigPath(): string {
  return store.path;
}
