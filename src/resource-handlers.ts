// ABOUTME: Resource handler implementations for MCP server
// ABOUTME: Provides methods to read project lists, details, outlines, and drafts via API client

import { listProjects, getProjectStatus, resumeProject } from './lib/index.js';
import type { ProjectListItem, ProjectStatus, ResumeProjectResponse } from './lib/index.js';

/**
 * Read list of all projects
 */
export async function readProjectsList() {
  try {
    const projects = await listProjects();

    return {
      contents: [
        {
          uri: "quibo://projects",
          mimeType: "application/json",
          text: JSON.stringify(projects, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      contents: [
        {
          uri: "quibo://projects",
          mimeType: "application/json",
          text: JSON.stringify({
            error: "Failed to list projects",
            message: errorMessage,
            projects: []
          }, null, 2),
        },
      ],
    };
  }
}

/**
 * Read detailed information about a specific project
 */
export async function readProjectDetails(projectId: string) {
  try {
    const status = await getProjectStatus(projectId);

    return {
      contents: [
        {
          uri: `quibo://projects/${projectId}`,
          mimeType: "application/json",
          text: JSON.stringify(status, null, 2),
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      contents: [
        {
          uri: `quibo://projects/${projectId}`,
          mimeType: "application/json",
          text: JSON.stringify({
            error: "Failed to get project details",
            message: errorMessage,
            projectId
          }, null, 2),
        },
      ],
    };
  }
}

/**
 * Read project outline as markdown
 */
export async function readProjectOutline(projectId: string) {
  try {
    const status = await getProjectStatus(projectId);

    // Extract outline from status
    if (!status.outline) {
      return {
        contents: [
          {
            uri: `quibo://projects/${projectId}/outline`,
            mimeType: "text/markdown",
            text: `# No Outline Available\n\nProject "${projectId}" does not have an outline yet. Generate one using the generate_content tool with operation='outline'.`,
          },
        ],
      };
    }

    // Format outline as markdown
    let markdownText = '';

    if (typeof status.outline === 'string') {
      markdownText = status.outline;
    } else if (typeof status.outline === 'object') {
      // Handle structured outline object
      markdownText = formatOutlineToMarkdown(status.outline);
    }

    return {
      contents: [
        {
          uri: `quibo://projects/${projectId}/outline`,
          mimeType: "text/markdown",
          text: markdownText,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      contents: [
        {
          uri: `quibo://projects/${projectId}/outline`,
          mimeType: "text/markdown",
          text: `# Error Loading Outline\n\nFailed to load outline for project "${projectId}".\n\nError: ${errorMessage}`,
        },
      ],
    };
  }
}

/**
 * Read complete blog draft as markdown
 */
export async function readProjectDraft(projectId: string) {
  try {
    const response = await resumeProject(projectId);

    // Extract draft from response
    if (!response.data?.draft && !response.data?.compiled_draft) {
      return {
        contents: [
          {
            uri: `quibo://projects/${projectId}/draft`,
            mimeType: "text/markdown",
            text: `# No Draft Available\n\nProject "${projectId}" does not have a compiled draft yet. Generate sections and compile using the generate_content tool.`,
          },
        ],
      };
    }

    const draftText = response.data.draft || response.data.compiled_draft || '';

    return {
      contents: [
        {
          uri: `quibo://projects/${projectId}/draft`,
          mimeType: "text/markdown",
          text: draftText,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      contents: [
        {
          uri: `quibo://projects/${projectId}/draft`,
          mimeType: "text/markdown",
          text: `# Error Loading Draft\n\nFailed to load draft for project "${projectId}".\n\nError: ${errorMessage}`,
        },
      ],
    };
  }
}

/**
 * Format outline object to markdown string
 */
function formatOutlineToMarkdown(outline: any): string {
  let markdown = '';

  // Handle title
  if (outline.title) {
    markdown += `# ${outline.title}\n\n`;
  }

  // Handle sections
  if (Array.isArray(outline.sections)) {
    outline.sections.forEach((section: any, index: number) => {
      if (typeof section === 'string') {
        markdown += `## ${index + 1}. ${section}\n\n`;
      } else if (section.title) {
        markdown += `## ${index + 1}. ${section.title}\n\n`;

        if (section.description) {
          markdown += `${section.description}\n\n`;
        }

        if (Array.isArray(section.subsections)) {
          section.subsections.forEach((subsection: any, subIndex: number) => {
            if (typeof subsection === 'string') {
              markdown += `   - ${subsection}\n`;
            } else if (subsection.title) {
              markdown += `   - ${subsection.title}\n`;
            }
          });
          markdown += '\n';
        }
      }
    });
  }

  // Handle metadata
  if (outline.metadata) {
    markdown += `---\n\n`;
    markdown += `**Metadata:**\n\n`;

    if (outline.metadata.target_audience) {
      markdown += `- **Target Audience:** ${outline.metadata.target_audience}\n`;
    }
    if (outline.metadata.tone) {
      markdown += `- **Tone:** ${outline.metadata.tone}\n`;
    }
    if (outline.metadata.structure_type) {
      markdown += `- **Structure:** ${outline.metadata.structure_type}\n`;
    }
  }

  return markdown || JSON.stringify(outline, null, 2);
}
