// ABOUTME: HTTP client for Quibo backend API with comprehensive error handling
// ABOUTME: Provides methods for project setup, content generation, and finalization workflows

import { getAccessToken } from './auth.js';
import { getBackendUrl } from './config.js';
import type {
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

/**
 * Custom error class for API errors with status code
 */
class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public responseBody?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Make an authenticated API request
 */
async function makeRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const backendUrl = getBackendUrl();
  const url = `${backendUrl}${endpoint}`;

  try {
    const token = getAccessToken();

    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });

    // Handle authentication errors
    if (response.status === 401) {
      throw new ApiError(
        'Your session has expired. Please re-authenticate using the authenticate tool.',
        401
      );
    }

    // Handle not found errors
    if (response.status === 404) {
      const text = await response.text();
      let resourceName = 'Resource';

      // Try to extract resource name from endpoint
      if (endpoint.includes('/projects/')) {
        resourceName = 'Project';
      } else if (endpoint.includes('/outline/')) {
        resourceName = 'Outline';
      } else if (endpoint.includes('/section/')) {
        resourceName = 'Section';
      }

      throw new ApiError(
        `${resourceName} not found. ${text || 'The requested resource does not exist.'}`,
        404,
        text
      );
    }

    // Handle other HTTP errors
    if (!response.ok) {
      const text = await response.text();
      let errorMessage = `API request failed with status ${response.status}`;

      try {
        const json = JSON.parse(text);
        if (json.detail) {
          errorMessage += `: ${json.detail}`;
        } else if (json.message) {
          errorMessage += `: ${json.message}`;
        }
      } catch {
        if (text) {
          errorMessage += `: ${text}`;
        }
      }

      throw new ApiError(errorMessage, response.status, text);
    }

    // Parse JSON response
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return (await response.json()) as T;
    }

    // Return text response as-is
    return (await response.text()) as any;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error(
        `Failed to connect to Quibo backend at ${backendUrl}. Please check your network connection and backend URL.`
      );
    }

    // Re-throw other errors
    throw error;
  }
}

// ==================== Project Setup ====================

/**
 * Upload files to a new or existing project
 */
export async function uploadFiles(
  projectName: string,
  files: File[],
  modelName: string,
  persona?: string
): Promise<UploadFilesResponse> {
  const formData = new FormData();

  // Add files to form data
  files.forEach((file) => {
    formData.append('files', file);
  });

  // Add model name
  formData.append('model_name', modelName);

  // Add optional persona
  if (persona) {
    formData.append('persona', persona);
  }

  return makeRequest<UploadFilesResponse>(
    `/upload/${encodeURIComponent(projectName)}`,
    {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - browser will set it with boundary
    }
  );
}

/**
 * Process uploaded files for a project
 */
export async function processFiles(
  projectName: string,
  modelName: string,
  filePaths: string[]
): Promise<ProcessFilesResponse> {
  return makeRequest<ProcessFilesResponse>(
    `/process_files/${encodeURIComponent(projectName)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_name: modelName,
        file_paths: filePaths,
      }),
    }
  );
}

// ==================== Content Generation ====================

/**
 * Generate blog outline from processed content
 */
export async function generateOutline(
  projectName: string,
  params: Omit<GenerateOutlineParams, 'projectName'>
): Promise<GenerateOutlineResponse> {
  return makeRequest<GenerateOutlineResponse>(
    `/generate_outline/${encodeURIComponent(projectName)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_name: params.modelName,
        structure_type: params.structureType,
        target_audience: params.targetAudience,
        tone: params.tone,
        key_points: params.keyPoints,
      }),
    }
  );
}

/**
 * Generate a specific section of the blog draft
 */
export async function generateSection(
  projectName: string,
  sectionIndex: number,
  maxIterations?: number,
  qualityThreshold?: number
): Promise<GenerateSectionResponse> {
  const params: Record<string, any> = {
    section_index: sectionIndex,
  };

  if (maxIterations !== undefined) {
    params.max_iterations = maxIterations;
  }

  if (qualityThreshold !== undefined) {
    params.quality_threshold = qualityThreshold;
  }

  return makeRequest<GenerateSectionResponse>(
    `/generate_section/${encodeURIComponent(projectName)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    }
  );
}

/**
 * Compile all generated sections into a complete draft
 */
export async function compileDraft(
  projectName: string,
  jobId: string
): Promise<CompileDraftResponse> {
  return makeRequest<CompileDraftResponse>(
    `/compile_draft/${encodeURIComponent(projectName)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        job_id: jobId,
      }),
    }
  );
}

/**
 * Regenerate outline based on user feedback
 */
export async function regenerateOutline(
  projectName: string,
  feedback: string,
  focusArea?: string
): Promise<GenerateOutlineResponse> {
  return makeRequest<GenerateOutlineResponse>(
    `/api/v2/projects/${encodeURIComponent(projectName)}/outline/regenerate`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        feedback,
        focus_area: focusArea,
      }),
    }
  );
}

// ==================== Finalization ====================

/**
 * Refine the compiled blog draft with title and social content generation
 */
export async function refineBlog(
  projectName: string,
  jobId: string,
  compiledDraft: string,
  titleConfig?: TitleConfig,
  socialConfig?: SocialConfig
): Promise<RefineBlogResponse> {
  return makeRequest<RefineBlogResponse>(
    `/refine_blog/${encodeURIComponent(projectName)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        job_id: jobId,
        compiled_draft: compiledDraft,
        title_config: titleConfig,
        social_config: socialConfig,
      }),
    }
  );
}

/**
 * Generate social media content for the blog post
 */
export async function generateSocialContent(
  projectName: string
): Promise<GenerateSocialContentResponse> {
  return makeRequest<GenerateSocialContentResponse>(
    `/generate_social_content/${encodeURIComponent(projectName)}`,
    {
      method: 'POST',
    }
  );
}

// ==================== Utility ====================

/**
 * Get the current status of a project
 */
export async function getProjectStatus(projectId: string): Promise<ProjectStatus> {
  return makeRequest<ProjectStatus>(`/project_status/${encodeURIComponent(projectId)}`);
}

/**
 * Resume a project and get its current state
 */
export async function resumeProject(projectId: string): Promise<ResumeProjectResponse> {
  return makeRequest<ResumeProjectResponse>(`/resume/${encodeURIComponent(projectId)}`);
}

/**
 * List all projects, optionally filtered by status
 */
export async function listProjects(status?: string): Promise<ProjectListItem[]> {
  const params = new URLSearchParams();
  if (status) {
    params.append('status', status);
  }

  const queryString = params.toString();
  const endpoint = queryString ? `/projects?${queryString}` : '/projects';

  return makeRequest<ProjectListItem[]>(endpoint);
}
