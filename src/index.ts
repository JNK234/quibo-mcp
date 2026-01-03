#!/usr/bin/env node
// ABOUTME: Main MCP server entry point for Quibo blogging assistant
// ABOUTME: Defines tools and resources for blog project management via MCP protocol

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { readFile } from 'fs/promises';
import {
  authenticate,
  checkAuth,
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
} from './lib/index.js';
import {
  readProjectsList as readProjectsListImpl,
  readProjectDetails as readProjectDetailsImpl,
  readProjectOutline as readProjectOutlineImpl,
  readProjectDraft as readProjectDraftImpl,
} from './resource-handlers.js';

/**
 * Main MCP server class for Quibo blogging assistant
 */
class QuiboMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: "quibo-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupResourceHandlers();
    this.setupErrorHandling();
  }

  /**
   * Define and register all MCP tool handlers
   */
  private setupToolHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "setup_project",
          description: "Upload and process files to create a new blog project. Processes .ipynb, .md, .py files and creates vector embeddings for content.",
          inputSchema: {
            type: "object",
            properties: {
              project_name: {
                type: "string",
                description: "Unique project identifier (e.g., 'my-ai-blog-post')",
              },
              file_paths: {
                type: "array",
                items: { type: "string" },
                description: "Absolute paths to files to process (.ipynb, .md, .py)",
              },
              model_name: {
                type: "string",
                enum: ["gpt-4", "gpt-4-turbo", "claude-3-opus", "claude-3-sonnet", "gemini-pro", "deepseek-chat"],
                description: "LLM provider to use for content generation",
              },
              persona: {
                type: "string",
                description: "Writing persona/style (default: neuraforge)",
                default: "neuraforge",
              },
            },
            required: ["project_name", "file_paths", "model_name"],
          },
        },
        {
          name: "generate_content",
          description: "Generate blog content including outline, sections, and compile final draft. Supports step-by-step or full generation.",
          inputSchema: {
            type: "object",
            properties: {
              project_name: {
                type: "string",
                description: "Project identifier from setup_project",
              },
              operation: {
                type: "string",
                enum: ["outline", "sections", "compile", "full"],
                description: "Generation operation: outline only, sections only, compile only, or full workflow",
              },
              specific_sections: {
                type: "array",
                items: { type: "string" },
                description: "Optional: specific section titles to generate (for 'sections' operation)",
              },
            },
            required: ["project_name", "operation"],
          },
        },
        {
          name: "finalize_blog",
          description: "Refine the blog draft and generate social media content (Twitter/X and LinkedIn posts).",
          inputSchema: {
            type: "object",
            properties: {
              project_name: {
                type: "string",
                description: "Project identifier",
              },
              refinement_instructions: {
                type: "string",
                description: "Optional instructions for refining the blog draft",
              },
              generate_social: {
                type: "boolean",
                description: "Whether to generate social media content",
                default: true,
              },
            },
            required: ["project_name"],
          },
        },
        {
          name: "get_project_status",
          description: "Get current state and progress of a blog project including outline, sections, and metadata.",
          inputSchema: {
            type: "object",
            properties: {
              project_name: {
                type: "string",
                description: "Project identifier",
              },
            },
            required: ["project_name"],
          },
        },
        {
          name: "list_projects",
          description: "List all available blog projects with their current status and metadata.",
          inputSchema: {
            type: "object",
            properties: {
              include_archived: {
                type: "boolean",
                description: "Include archived projects in the list",
                default: false,
              },
            },
          },
        },
        {
          name: "resume_project",
          description: "Restore and resume a previously created project from cached state.",
          inputSchema: {
            type: "object",
            properties: {
              project_name: {
                type: "string",
                description: "Project identifier to resume",
              },
            },
            required: ["project_name"],
          },
        },
        {
          name: "regenerate_outline",
          description: "Regenerate blog outline with user feedback and modification instructions.",
          inputSchema: {
            type: "object",
            properties: {
              project_name: {
                type: "string",
                description: "Project identifier",
              },
              feedback: {
                type: "string",
                description: "User feedback for outline improvement (e.g., 'Add more technical details', 'Simplify introduction')",
              },
            },
            required: ["project_name", "feedback"],
          },
        },
        {
          name: "authenticate",
          description: "Start Google OAuth authentication flow to access Quibo backend. Returns authorization URL to visit.",
          inputSchema: {
            type: "object",
            properties: {
              redirect_uri: {
                type: "string",
                description: "OAuth redirect URI (default: http://localhost:8501)",
                default: "http://localhost:8501",
              },
            },
          },
        },
        {
          name: "check_auth",
          description: "Verify current authentication status and token validity.",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
      ],
    }));

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "setup_project":
            return await this.handleSetupProject(args);

          case "generate_content":
            return await this.handleGenerateContent(args);

          case "finalize_blog":
            return await this.handleFinalizeBlog(args);

          case "get_project_status":
            return await this.handleGetProjectStatus(args);

          case "list_projects":
            return await this.handleListProjects(args);

          case "resume_project":
            return await this.handleResumeProject(args);

          case "regenerate_outline":
            return await this.handleRegenerateOutline(args);

          case "authenticate":
            return await this.handleAuthenticate(args);

          case "check_auth":
            return await this.handleCheckAuth(args);

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          content: [
            {
              type: "text",
              text: `Error executing ${name}: ${errorMessage}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  /**
   * Define and register all MCP resource handlers
   */
  private setupResourceHandlers(): void {
    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: "quibo://projects",
          mimeType: "application/json",
          name: "All Projects",
          description: "List of all blog projects",
        },
        {
          uri: "quibo://projects/{project_id}",
          mimeType: "application/json",
          name: "Project Details",
          description: "Detailed information about a specific project",
        },
        {
          uri: "quibo://projects/{project_id}/outline",
          mimeType: "text/markdown",
          name: "Project Outline",
          description: "Blog outline for a specific project",
        },
        {
          uri: "quibo://projects/{project_id}/draft",
          mimeType: "text/markdown",
          name: "Project Draft",
          description: "Complete blog draft for a specific project",
        },
      ],
    }));

    // Handle resource reading
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;

      try {
        if (uri === "quibo://projects") {
          return await this.readProjectsList();
        }

        if (uri.match(/^quibo:\/\/projects\/[^/]+$/)) {
          const projectId = uri.split("/").pop()!;
          return await this.readProjectDetails(projectId);
        }

        if (uri.match(/^quibo:\/\/projects\/[^/]+\/outline$/)) {
          const projectId = uri.split("/")[3];
          return await this.readProjectOutline(projectId);
        }

        if (uri.match(/^quibo:\/\/projects\/[^/]+\/draft$/)) {
          const projectId = uri.split("/")[3];
          return await this.readProjectDraft(projectId);
        }

        throw new Error(`Unknown resource URI: ${uri}`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        return {
          contents: [
            {
              uri,
              mimeType: "text/plain",
              text: `Error reading resource: ${errorMessage}`,
            },
          ],
        };
      }
    });
  }

  /**
   * Setup error handling for the server
   */
  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error("[MCP Error]", error);
    };

    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  // ============================================================================
  // Tool Handler Implementations (TODO)
  // ============================================================================

  private async handleSetupProject(args: any) {
    const { project_name, file_paths, model_name, persona } = args;

    try {
      // Read all files and create File objects
      const files: File[] = [];
      const uploadedPaths: string[] = [];

      for (const filePath of file_paths) {
        try {
          const content = await readFile(filePath);
          const fileName = filePath.split('/').pop() || 'unknown';

          // Create File object from buffer
          const file = new File([content], fileName, {
            type: this.getMimeType(fileName),
          });

          files.push(file);
          uploadedPaths.push(filePath);
        } catch (error) {
          throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Upload files to backend
      const uploadResult = await uploadFiles(project_name, files, model_name, persona);

      // Process the uploaded files
      const processResult = await processFiles(project_name, model_name, uploadedPaths);

      // Get final project status
      const status = await getProjectStatus(project_name);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                projectId: project_name,
                uploadedFiles: uploadedPaths.length,
                status: status.status,
                message: `Project setup complete. Uploaded and processed ${uploadedPaths.length} file(s).`,
                details: {
                  upload: uploadResult,
                  process: processResult,
                  status,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to setup project: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Determine MIME type from file extension
   */
  private getMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ipynb':
        return 'application/x-ipynb+json';
      case 'md':
        return 'text/markdown';
      case 'py':
        return 'text/x-python';
      case 'txt':
        return 'text/plain';
      default:
        return 'application/octet-stream';
    }
  }

  private async handleGenerateContent(args: any) {
    const { project_name, operation, specific_sections } = args;

    try {
      let result: any = {};

      if (operation === 'outline' || operation === 'full') {
        // Generate outline
        const outlineResult = await generateOutline(project_name, {
          modelName: 'gpt-4', // Use default or get from project
        });
        result.outline = outlineResult;

        if (operation === 'outline') {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    operation: 'outline',
                    outline: outlineResult.outline,
                    jobId: outlineResult.jobId,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      }

      if (operation === 'sections' || operation === 'full') {
        // Get project status to determine section count
        const status = await getProjectStatus(project_name);
        const sectionCount = status.outline?.sections?.length || 0;

        if (sectionCount === 0) {
          throw new Error('No sections found in outline. Generate outline first.');
        }

        const sections: any[] = [];

        // Generate each section
        for (let i = 0; i < sectionCount; i++) {
          // Check if we should generate this specific section
          if (specific_sections && specific_sections.length > 0) {
            const sectionTitle = status.outline.sections[i]?.title;
            if (!specific_sections.includes(sectionTitle)) {
              continue;
            }
          }

          const sectionResult = await generateSection(project_name, i);
          sections.push(sectionResult);
        }

        result.sections = sections;

        if (operation === 'sections') {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    operation: 'sections',
                    sectionsGenerated: sections.length,
                    sections,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }
      }

      if (operation === 'compile' || operation === 'full') {
        // Get job ID from previous steps or project status
        const status = await getProjectStatus(project_name);
        const jobId = result.outline?.jobId || status.jobId || 'default';

        const compileResult = await compileDraft(project_name, jobId);
        result.draft = compileResult;

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  operation,
                  draft: compileResult.draft,
                  jobId: compileResult.jobId,
                  ...(operation === 'full' && {
                    outline: result.outline,
                    sections: result.sections,
                  }),
                },
                null,
                2
              ),
            },
          ],
        };
      }

      throw new Error(`Unknown operation: ${operation}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to generate content: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleFinalizeBlog(args: any) {
    const { project_name, refinement_instructions, generate_social = true } = args;

    try {
      // Get current project status to retrieve compiled draft
      const status = await getProjectStatus(project_name);

      if (!status.compiledDraft) {
        throw new Error('No compiled draft found. Generate and compile sections first.');
      }

      const jobId = status.jobId || 'default';

      // Refine the blog draft
      const refineResult = await refineBlog(
        project_name,
        jobId,
        status.compiledDraft,
        undefined, // titleConfig
        generate_social ? { platforms: ['twitter', 'linkedin'] } : undefined
      );

      let socialContent = null;

      // Generate social media content if requested
      if (generate_social && !refineResult.socialContent) {
        try {
          const socialResult = await generateSocialContent(project_name);
          socialContent = socialResult.socialContent;
        } catch (error) {
          console.error('Failed to generate social content:', error);
        }
      } else if (refineResult.socialContent) {
        socialContent = refineResult.socialContent;
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                refinedBlog: refineResult.refinedBlog,
                title: refineResult.title,
                socialContent,
                message: 'Blog finalized successfully.',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to finalize blog: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleGetProjectStatus(args: any) {
    const { project_name } = args;

    try {
      const status = await getProjectStatus(project_name);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                ...status,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to get project status: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleListProjects(args: any) {
    const { include_archived = false } = args;

    try {
      const projects = await listProjects(include_archived ? 'archived' : undefined);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                projectCount: projects.length,
                projects,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to list projects: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleResumeProject(args: any) {
    const { project_name } = args;

    try {
      const result = await resumeProject(project_name);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                projectId: result.projectId,
                status: result.status,
                data: result.data,
                message: `Project ${project_name} resumed successfully.`,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to resume project: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleRegenerateOutline(args: any) {
    const { project_name, feedback } = args;

    try {
      const result = await regenerateOutline(project_name, feedback);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                outline: result.outline,
                jobId: result.jobId,
                message: 'Outline regenerated successfully based on feedback.',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to regenerate outline: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleAuthenticate(args: any) {
    try {
      await authenticate();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                message: 'Authentication successful. You are now signed in to Quibo.',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Authentication failed: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async handleCheckAuth(args: any) {
    try {
      const authStatus = checkAuth();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ...authStatus,
                message: authStatus.authenticated
                  ? `Authenticated as ${authStatus.email}`
                  : 'Not authenticated. Please run the authenticate tool.',
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `Failed to check authentication: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }

  // ============================================================================
  // Resource Handler Implementations
  // ============================================================================

  private async readProjectsList() {
    return readProjectsListImpl();
  }

  private async readProjectDetails(projectId: string) {
    return readProjectDetailsImpl(projectId);
  }

  private async readProjectOutline(projectId: string) {
    return readProjectOutlineImpl(projectId);
  }

  private async readProjectDraft(projectId: string) {
    return readProjectDraftImpl(projectId);
  }

  // ============================================================================
  // Server Lifecycle
  // ============================================================================

  /**
   * Start the MCP server
   */
  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Quibo MCP server running on stdio");
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

const server = new QuiboMCPServer();
server.run().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
