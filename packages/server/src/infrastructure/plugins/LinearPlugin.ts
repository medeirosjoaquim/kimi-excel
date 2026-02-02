import type { UtilityPluginTool } from "@kimi-excel/shared";
import type { KimiUtilityPlugin } from "../../domain/interfaces/KimiUtilityPlugin.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("LinearPlugin");

const LINEAR_API_URL = "https://api.linear.app/graphql";

/**
 * Get the Linear API key from environment
 */
function getLinearApiKey(): string | undefined {
  return process.env.LINEAR_API_KEY || undefined;
}

/**
 * Make a Linear GraphQL API request
 */
async function linearQuery(
  query: string,
  variables: Record<string, unknown> = {}
): Promise<{ data: unknown; error?: string }> {
  const apiKey = getLinearApiKey();

  if (!apiKey) {
    return {
      data: null,
      error: "LINEAR_API_KEY environment variable is not set",
    };
  }

  try {
    const response = await fetch(LINEAR_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      log.warn("Linear API error", {
        status: response.status,
        body: errorBody.slice(0, 200),
      });
      return {
        data: null,
        error: `Linear API error: ${response.status} - ${response.statusText}`,
      };
    }

    const result = (await response.json()) as {
      data?: unknown;
      errors?: Array<{ message: string }>;
    };

    if (result.errors && result.errors.length > 0) {
      return {
        data: null,
        error: result.errors.map((e) => e.message).join(", "),
      };
    }

    return { data: result.data };
  } catch (error) {
    log.error("Linear fetch error", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      data: null,
      error: `Failed to fetch from Linear: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Execute Linear tool functions
 */
export async function executeLinearFunction(
  functionName: string,
  args: Record<string, unknown>
): Promise<string> {
  log.debug("Executing Linear function", { functionName, args });

  switch (functionName) {
    case "list_teams": {
      log.info("Listing Linear teams");
      const query = `
        query {
          teams {
            nodes {
              id
              key
              name
              description
            }
          }
        }
      `;

      const result = await linearQuery(query);

      if (result.error) {
        return JSON.stringify({ error: result.error });
      }

      const data = result.data as {
        teams: {
          nodes: Array<{
            id: string;
            key: string;
            name: string;
            description: string | null;
          }>;
        };
      };

      return JSON.stringify({
        count: data.teams.nodes.length,
        teams: data.teams.nodes.map((t) => ({
          id: t.id,
          key: t.key,
          name: t.name,
          description: t.description,
        })),
      });
    }

    case "list_team_members": {
      // Accept both team_key and team as parameter names
      const teamKey = (args.team_key || args.team) as string;

      if (!teamKey) {
        return JSON.stringify({ error: "team_key is required" });
      }

      log.info("Listing team members", { teamKey });

      const query = `
        query($teamKey: String!) {
          teams(filter: { key: { eq: $teamKey } }) {
            nodes {
              id
              key
              name
              members {
                nodes {
                  id
                  name
                  email
                  displayName
                  avatarUrl
                  active
                }
              }
            }
          }
        }
      `;

      const result = await linearQuery(query, { teamKey: teamKey.toUpperCase() });

      if (result.error) {
        return JSON.stringify({ error: result.error });
      }

      const data = result.data as {
        teams: {
          nodes: Array<{
            id: string;
            key: string;
            name: string;
            members: {
              nodes: Array<{
                id: string;
                name: string;
                email: string;
                displayName: string;
                avatarUrl: string | null;
                active: boolean;
              }>;
            };
          }>;
        };
      };

      const team = data.teams?.nodes?.[0];
      if (!team) {
        return JSON.stringify({ error: `Team not found: ${teamKey}` });
      }

      return JSON.stringify({
        team: {
          key: team.key,
          name: team.name,
        },
        count: team.members.nodes.length,
        members: team.members.nodes.map((m) => ({
          id: m.id,
          name: m.name,
          email: m.email,
          displayName: m.displayName,
          avatarUrl: m.avatarUrl,
          active: m.active,
        })),
      });
    }

    case "list_issues": {
      // Accept both team_key and team as parameter names
      const teamKey = (args.team_key || args.team) as string;
      const assignee = args.assignee as string | undefined;
      const state = (args.state || args.status) as string | undefined;
      const limit = Math.min((args.limit as number) || 20, 50);

      if (!teamKey) {
        return JSON.stringify({ error: "team_key is required" });
      }

      log.info("Listing issues", { teamKey, assignee, state, limit });

      // Build filter
      const filterParts: string[] = [`team: { key: { eq: "${teamKey.toUpperCase()}" } }`];

      if (assignee === "unassigned") {
        filterParts.push("assignee: { null: true }");
      } else if (assignee) {
        filterParts.push(
          `assignee: { or: [{ name: { containsIgnoreCase: "${assignee}" } }, { email: { containsIgnoreCase: "${assignee}" } }, { displayName: { containsIgnoreCase: "${assignee}" } }] }`
        );
      }

      if (state) {
        filterParts.push(`state: { name: { eqIgnoreCase: "${state}" } }`);
      }

      const query = `
        query($limit: Int!) {
          issues(
            first: $limit
            filter: { ${filterParts.join(", ")} }
            orderBy: updatedAt
          ) {
            nodes {
              id
              identifier
              title
              state { name }
              assignee { name }
              priority
              updatedAt
            }
          }
        }
      `;

      const result = await linearQuery(query, { limit });

      if (result.error) {
        return JSON.stringify({ error: result.error });
      }

      const data = result.data as {
        issues: {
          nodes: Array<{
            id: string;
            identifier: string;
            title: string;
            state: { name: string } | null;
            assignee: { name: string } | null;
            priority: number;
            updatedAt: string;
          }>;
        };
      };

      return JSON.stringify({
        team: teamKey.toUpperCase(),
        filters: {
          assignee: assignee || "all",
          state: state || "all",
        },
        count: data.issues.nodes.length,
        issues: data.issues.nodes.map((i) => ({
          id: i.id,
          identifier: i.identifier,
          title: i.title,
          status: i.state?.name || null,
          assignee: i.assignee?.name || null,
          priority: i.priority,
          updatedAt: i.updatedAt,
        })),
      });
    }

    case "get_issue": {
      const identifier = args.identifier as string;

      if (!identifier) {
        return JSON.stringify({ error: "identifier is required (e.g., TEAM-123)" });
      }

      // Parse identifier (e.g., "ENG-123" -> team: "ENG", number: 123)
      const match = identifier.toUpperCase().match(/^([A-Z]+)-(\d+)$/);
      if (!match) {
        return JSON.stringify({
          error: `Invalid identifier format: ${identifier}. Expected format: TEAM-123`,
        });
      }
      const [, teamKey, numberStr] = match;
      const issueNumber = parseInt(numberStr, 10);

      log.info("Fetching issue", { identifier, teamKey, issueNumber });

      // Query by team key and issue number
      const lookupQuery = `
        query($teamKey: String!, $number: Float!) {
          issues(
            filter: {
              team: { key: { eq: $teamKey } }
              number: { eq: $number }
            }
            first: 1
          ) {
            nodes {
              id
              identifier
              title
              description
              state { name }
              assignee { name email }
              priority
              labels { nodes { name } }
              createdAt
              updatedAt
              completedAt
              comments {
                nodes {
                  id
                  body
                  createdAt
                  user { name email }
                }
              }
              relations {
                nodes {
                  type
                  relatedIssue {
                    id
                    identifier
                    title
                  }
                }
              }
              parent {
                id
                identifier
                title
              }
              children {
                nodes {
                  id
                  identifier
                  title
                  state { name }
                }
              }
            }
          }
        }
      `;

      const result = await linearQuery(lookupQuery, { teamKey, number: issueNumber });

      if (result.error) {
        return JSON.stringify({ error: result.error });
      }

      const data = result.data as {
        issues: {
          nodes: Array<{
            id: string;
            identifier: string;
            title: string;
            description: string | null;
            state: { name: string } | null;
            assignee: { name: string; email: string } | null;
            priority: number;
            labels: { nodes: Array<{ name: string }> };
            createdAt: string;
            updatedAt: string;
            completedAt: string | null;
            comments: {
              nodes: Array<{
                id: string;
                body: string;
                createdAt: string;
                user: { name: string; email: string } | null;
              }>;
            };
            relations: {
              nodes: Array<{
                type: string;
                relatedIssue: {
                  id: string;
                  identifier: string;
                  title: string;
                };
              }>;
            };
            parent: {
              id: string;
              identifier: string;
              title: string;
            } | null;
            children: {
              nodes: Array<{
                id: string;
                identifier: string;
                title: string;
                state: { name: string } | null;
              }>;
            };
          }>;
        };
      };

      const issue = data.issues?.nodes?.[0];

      if (!issue) {
        return JSON.stringify({ error: `Issue not found: ${identifier}` });
      }

      return JSON.stringify({
        id: issue.id,
        identifier: issue.identifier,
        title: issue.title,
        description: issue.description,
        status: issue.state?.name || null,
        assignee: issue.assignee?.name || null,
        assignee_email: issue.assignee?.email || null,
        priority: issue.priority,
        labels: issue.labels.nodes.map((l) => l.name),
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        completedAt: issue.completedAt,
        comments: issue.comments.nodes.map((c) => ({
          id: c.id,
          body: c.body,
          createdAt: c.createdAt,
          author: c.user?.name || c.user?.email || null,
        })),
        relations: issue.relations.nodes.map((r) => ({
          type: r.type,
          issue: {
            identifier: r.relatedIssue.identifier,
            title: r.relatedIssue.title,
          },
        })),
        parent: issue.parent
          ? {
              identifier: issue.parent.identifier,
              title: issue.parent.title,
            }
          : null,
        children: issue.children.nodes.map((c) => ({
          identifier: c.identifier,
          title: c.title,
          status: c.state?.name || null,
        })),
      });
    }

    case "search_issues": {
      const searchText = args.query as string;
      const limit = Math.min((args.limit as number) || 20, 50);

      if (!searchText) {
        return JSON.stringify({ error: "query is required" });
      }

      log.debug("Searching issues", { searchText, limit });

      // Use filter with title/description contains instead of deprecated query param
      const query = `
        query($limit: Int!) {
          issues(
            first: $limit
            orderBy: updatedAt
          ) {
            nodes {
              id
              identifier
              title
              description
              state { name }
              assignee { name }
              team { key name }
              priority
              updatedAt
            }
          }
        }
      `;

      const result = await linearQuery(query, { limit: 100 }); // Fetch more for client-side filter

      if (result.error) {
        return JSON.stringify({ error: result.error });
      }

      const data = result.data as {
        issues: {
          nodes: Array<{
            id: string;
            identifier: string;
            title: string;
            description: string | null;
            state: { name: string } | null;
            assignee: { name: string } | null;
            team: { key: string; name: string };
            priority: number;
            updatedAt: string;
          }>;
        };
      };

      // Client-side filter since Linear API search is deprecated
      const searchLower = searchText.toLowerCase();
      const filtered = data.issues.nodes
        .filter(
          (i) =>
            i.title.toLowerCase().includes(searchLower) ||
            i.identifier.toLowerCase().includes(searchLower) ||
            (i.description && i.description.toLowerCase().includes(searchLower))
        )
        .slice(0, limit);

      log.debug("Search complete", { found: filtered.length });

      return JSON.stringify({
        query: searchText,
        count: filtered.length,
        issues: filtered.map((i) => ({
          identifier: i.identifier,
          title: i.title,
          status: i.state?.name || null,
          assignee: i.assignee?.name || null,
          team: i.team.key,
          priority: i.priority,
          updatedAt: i.updatedAt,
        })),
      });
    }

    case "update_issue_status": {
      const identifier = args.identifier as string;
      const status = args.status as string;

      if (!identifier || !status) {
        return JSON.stringify({ error: "identifier and status are required" });
      }

      log.info("Updating issue status", { identifier, status });

      // Parse identifier
      const match = identifier.toUpperCase().match(/^([A-Z]+)-(\d+)$/);
      if (!match) {
        return JSON.stringify({
          error: `Invalid identifier format: ${identifier}. Expected format: TEAM-123`,
        });
      }
      const [, teamKey, numberStr] = match;
      const issueNumber = parseInt(numberStr, 10);

      // First, find the issue to get its ID
      const findQuery = `
        query($teamKey: String!, $number: Float!) {
          issues(
            filter: {
              team: { key: { eq: $teamKey } }
              number: { eq: $number }
            }
            first: 1
          ) {
            nodes {
              id
              team {
                id
                states { nodes { id name } }
              }
            }
          }
        }
      `;

      const findResult = await linearQuery(findQuery, { teamKey, number: issueNumber });

      if (findResult.error) {
        return JSON.stringify({ error: findResult.error });
      }

      const findData = findResult.data as {
        issues: {
          nodes: Array<{
            id: string;
            team: {
              id: string;
              states: { nodes: Array<{ id: string; name: string }> };
            };
          }>;
        };
      };

      const issue = findData.issues?.nodes?.[0];
      if (!issue) {
        return JSON.stringify({ error: `Issue not found: ${identifier}` });
      }

      // Find the matching state
      const targetState = issue.team.states.nodes.find(
        (s) => s.name.toLowerCase() === status.toLowerCase()
      );

      if (!targetState) {
        const availableStates = issue.team.states.nodes.map((s) => s.name);
        return JSON.stringify({
          error: `Status "${status}" not found. Available: ${availableStates.join(", ")}`,
        });
      }

      // Update the issue
      const updateQuery = `
        mutation($issueId: String!, $stateId: String!) {
          issueUpdate(id: $issueId, input: { stateId: $stateId }) {
            success
            issue {
              id
              identifier
              title
              state { name }
            }
          }
        }
      `;

      const updateResult = await linearQuery(updateQuery, {
        issueId: issue.id,
        stateId: targetState.id,
      });

      if (updateResult.error) {
        return JSON.stringify({ error: updateResult.error });
      }

      const updateData = updateResult.data as {
        issueUpdate: {
          success: boolean;
          issue: {
            id: string;
            identifier: string;
            title: string;
            state: { name: string };
          };
        };
      };

      return JSON.stringify({
        success: updateData.issueUpdate.success,
        issue: {
          identifier: updateData.issueUpdate.issue.identifier,
          title: updateData.issueUpdate.issue.title,
          status: updateData.issueUpdate.issue.state.name,
        },
      });
    }

    default:
      return JSON.stringify({ error: `Unknown function: ${functionName}` });
  }
}

/**
 * Linear Plugin for Kimi
 *
 * Provides access to Linear issues, teams, and project management data.
 * Requires LINEAR_API_KEY environment variable.
 */
export class LinearPlugin implements KimiUtilityPlugin {
  readonly name = "linear";
  readonly description =
    "A utility tool for accessing Linear project management data including teams, issues, comments, and status updates. " +
    "Can list teams, browse issues by team/assignee, get full issue details with comments, search across all issues, and update issue status.";

  readonly autoInclude = true;

  private readonly functions = [
    "list_teams",
    "list_team_members",
    "list_issues",
    "get_issue",
    "search_issues",
    "update_issue_status",
  ];

  /**
   * Check if this plugin can handle the given function name
   */
  canHandle(functionName: string): boolean {
    // If function has a prefix, only handle if it's our prefix
    if (functionName.includes(".")) {
      const [prefix, baseName] = functionName.split(".");
      if (prefix !== this.name) {
        return false; // Different plugin's function
      }
      return this.functions.includes(baseName);
    }
    // No prefix - check if it's one of our functions
    return this.functions.includes(functionName);
  }

  /**
   * Execute a function from this plugin
   */
  async execute(
    functionName: string,
    args: Record<string, unknown>
  ): Promise<string> {
    // Strip plugin prefix if present
    const baseName = functionName.includes(".")
      ? functionName.split(".").pop() ?? functionName
      : functionName;
    return executeLinearFunction(baseName, args);
  }

  getToolDefinition(): UtilityPluginTool {
    return {
      type: "_plugin",
      _plugin: {
        name: this.name,
        description: this.description,
        functions: [
          {
            name: "list_teams",
            description:
              "List all Linear teams accessible to the authenticated user. " +
              "Returns team keys (like 'ENG'), names, and descriptions.",
            parameters: {
              type: "object",
              properties: {},
              required: [],
            },
          },
          {
            name: "list_team_members",
            description:
              "List all members of a Linear team. " +
              "Returns member names, emails, and active status.",
            parameters: {
              type: "object",
              properties: {
                team: {
                  type: "string",
                  description: "Team key/identifier (e.g., 'ENG', 'PROD', 'COC'). Case-insensitive.",
                },
              },
              required: ["team"],
            },
          },
          {
            name: "list_issues",
            description:
              "List issues for a team with optional filters. " +
              "Returns issue identifiers, titles, status, assignee, and priority. " +
              "Use this to browse recent issues or filter by assignee/state.",
            parameters: {
              type: "object",
              properties: {
                team: {
                  type: "string",
                  description: "Team key/identifier (e.g., 'ENG', 'COC'). Case-insensitive.",
                },
                assignee: {
                  type: "string",
                  description:
                    "Filter by assignee name/email, or 'unassigned' for unassigned issues. " +
                    "Partial match supported.",
                },
                status: {
                  type: "string",
                  description:
                    "Filter by issue status (e.g., 'In Progress', 'Todo', 'Done').",
                },
                limit: {
                  type: "number",
                  description: "Number of issues to return (max 50). Defaults to 20.",
                },
              },
              required: ["team"],
            },
          },
          {
            name: "get_issue",
            description:
              "Get complete details for a specific issue including description, " +
              "comments, labels, relations (blocks/blocked-by), parent/children, and history. " +
              "Use this when you need full context about an issue.",
            parameters: {
              type: "object",
              properties: {
                identifier: {
                  type: "string",
                  description: "Issue identifier (e.g., 'ENG-123', 'PROD-456'). Case-insensitive.",
                },
              },
              required: ["identifier"],
            },
          },
          {
            name: "search_issues",
            description:
              "Search for issues across all teams using text search. " +
              "Searches issue titles, descriptions, and comments.",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Search query text.",
                },
                limit: {
                  type: "number",
                  description: "Number of results to return (max 50). Defaults to 20.",
                },
              },
              required: ["query"],
            },
          },
          {
            name: "update_issue_status",
            description:
              "Update the status/state of an issue. " +
              "Use this to move issues through workflow states like 'Todo', 'In Progress', 'Done'.",
            parameters: {
              type: "object",
              properties: {
                identifier: {
                  type: "string",
                  description: "Issue identifier (e.g., 'ENG-123').",
                },
                status: {
                  type: "string",
                  description:
                    "New status name. Common values: 'Todo', 'In Progress', 'QA Testing', 'Done'. " +
                    "Case-insensitive. Must match an existing workflow state.",
                },
              },
              required: ["identifier", "status"],
            },
          },
        ],
      },
    };
  }

  getSystemPromptAddition(): string {
    const hasApiKey = !!getLinearApiKey();
    return (
      "You have access to a Linear utility for project management. " +
      (hasApiKey
        ? "A Linear API key is configured, so you can access teams, issues, and update status. "
        : "No Linear API key is configured. The linear tools will not work until LINEAR_API_KEY is set. ") +
      "Use the linear plugin tools to fetch real-time data from Linear. " +
      "Issue identifiers are in 'TEAM-123' format (e.g., 'ENG-456', 'PROD-789'). " +
      "When the user mentions a Linear issue or asks about project status, use the appropriate function."
    );
  }
}
