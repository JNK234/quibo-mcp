// ABOUTME: TypeScript type definitions for authentication and configuration
// ABOUTME: Provides shared types used across auth, config, and API modules

import type { User } from '@supabase/supabase-js';

/**
 * Stored authentication tokens from Supabase session
 */
export interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp in seconds
  user: {
    email: string;
    id: string;
  };
}

/**
 * Authentication status returned by checkAuth()
 */
export interface AuthStatus {
  authenticated: boolean;
  email?: string;
  expiresAt?: number;
  isExpired: boolean;
}

/**
 * Configuration settings for the MCP server
 */
export interface QuiboConfig {
  backendUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  auth?: StoredAuth;
}

/**
 * OAuth callback parameters received from Supabase
 */
export interface OAuthCallbackParams {
  access_token?: string;
  refresh_token?: string;
  expires_in?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

// ==================== API Request/Response Types ====================

/**
 * Parameters for uploading files to a project
 */
export interface UploadFilesParams {
  projectName: string;
  files: File[];
  modelName: string;
  persona?: string;
}

/**
 * Parameters for processing uploaded files
 */
export interface ProcessFilesParams {
  projectName: string;
  modelName: string;
  filePaths: string[];
}

/**
 * Parameters for generating blog outline
 */
export interface GenerateOutlineParams {
  projectName: string;
  modelName?: string;
  structureType?: string;
  targetAudience?: string;
  tone?: string;
  keyPoints?: string[];
}

/**
 * Parameters for generating a blog section
 */
export interface GenerateSectionParams {
  projectName: string;
  sectionIndex: number;
  maxIterations?: number;
  qualityThreshold?: number;
}

/**
 * Parameters for compiling blog draft
 */
export interface CompileDraftParams {
  projectName: string;
  jobId: string;
}

/**
 * Parameters for regenerating outline with feedback
 */
export interface RegenerateOutlineParams {
  projectName: string;
  feedback: string;
  focusArea?: string;
}

/**
 * Title configuration for blog refinement
 */
export interface TitleConfig {
  style?: string;
  includeSubtitle?: boolean;
  maxLength?: number;
}

/**
 * Social media configuration for content generation
 */
export interface SocialConfig {
  platforms?: string[];
  tone?: string;
  includeHashtags?: boolean;
}

/**
 * Parameters for refining the blog post
 */
export interface RefineBlogParams {
  projectName: string;
  jobId: string;
  compiledDraft: string;
  titleConfig?: TitleConfig;
  socialConfig?: SocialConfig;
}

/**
 * Project status response
 */
export interface ProjectStatus {
  projectId: string;
  status: string;
  progress?: number;
  message?: string;
  [key: string]: any;
}

/**
 * Project list item
 */
export interface ProjectListItem {
  projectId: string;
  name: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

/**
 * Response from uploading files
 */
export interface UploadFilesResponse {
  message: string;
  projectId?: string;
  uploadedFiles?: string[];
  [key: string]: any;
}

/**
 * Response from processing files
 */
export interface ProcessFilesResponse {
  message: string;
  processedCount?: number;
  [key: string]: any;
}

/**
 * Response from generating outline
 */
export interface GenerateOutlineResponse {
  outline: any;
  jobId?: string;
  [key: string]: any;
}

/**
 * Response from generating a section
 */
export interface GenerateSectionResponse {
  section: any;
  sectionIndex: number;
  quality?: number;
  iterations?: number;
  [key: string]: any;
}

/**
 * Response from compiling draft
 */
export interface CompileDraftResponse {
  draft: string;
  jobId: string;
  [key: string]: any;
}

/**
 * Response from refining blog
 */
export interface RefineBlogResponse {
  refinedBlog: string;
  title?: string;
  socialContent?: any;
  [key: string]: any;
}

/**
 * Response from generating social content
 */
export interface GenerateSocialContentResponse {
  socialContent: any;
  platforms?: string[];
  [key: string]: any;
}

/**
 * Response from resuming a project
 */
export interface ResumeProjectResponse {
  projectId: string;
  status: string;
  data?: any;
  [key: string]: any;
}
