// ABOUTME: Main export file for lib modules providing clean import interface
// ABOUTME: Re-exports auth, config, API client, and type definitions for easy consumption

export { authenticate, checkAuth, getAccessToken, clearAuth } from './auth.js';
export {
  getBackendUrl,
  getSupabaseUrl,
  getSupabaseAnonKey,
  setAuth,
  getAuth,
  getConfig,
  getConfigPath,
} from './config.js';
export {
  uploadFiles,
  processFiles,
  generateOutline,
  generateSection,
  compileDraft,
  regenerateOutline,
  refineBlog,
  generateSocialContent,
  getProjectStatus,
  resumeProject,
  listProjects,
} from './api.js';
export type {
  StoredAuth,
  AuthStatus,
  QuiboConfig,
  OAuthCallbackParams,
  UploadFilesResponse,
  ProcessFilesResponse,
  GenerateOutlineResponse,
  GenerateSectionResponse,
  CompileDraftResponse,
  RefineBlogResponse,
  GenerateSocialContentResponse,
  ProjectStatus,
  ProjectListItem,
  ResumeProjectResponse,
  GenerateOutlineParams,
  TitleConfig,
  SocialConfig,
} from './types.js';
