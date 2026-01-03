// ABOUTME: Configuration management using conf package for secure token storage
// ABOUTME: Handles backend URL, Supabase credentials, and auth token persistence

import Conf from 'conf';
import type { QuiboConfig, StoredAuth } from './types.js';

/**
 * Configuration store using conf package
 * Data stored in ~/.config/quibo-mcp/config.json
 */
// Quibo's Supabase project credentials (public - safe to hardcode)
const QUIBO_SUPABASE_URL = 'https://bjqnndhxnapjhlkljsdj.supabase.co';
const QUIBO_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqcW5uZGh4bmFwamhsa2xqc2RqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQwMTM0MjcsImV4cCI6MjA3OTU4OTQyN30.txgB66gZhjgtCzukovalPVHPgb_DLDuFzqXtVwvIZ7w';

// Production Quibo backend URL
const QUIBO_PRODUCTION_URL = 'https://quibo-backend-870041009851.us-central1.run.app';

const store = new Conf<QuiboConfig>({
  projectName: 'quibo-mcp',
  defaults: {
    backendUrl: process.env.QUIBO_BACKEND_URL || QUIBO_PRODUCTION_URL,
    supabaseUrl: QUIBO_SUPABASE_URL,
    supabaseAnonKey: QUIBO_SUPABASE_ANON_KEY,
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
