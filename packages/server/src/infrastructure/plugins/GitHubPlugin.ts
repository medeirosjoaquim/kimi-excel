import type { UtilityPluginTool } from "@kimi-excel/shared";
import type { KimiUtilityPlugin } from "../../domain/interfaces/KimiUtilityPlugin.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("GitHubPlugin");

const GITHUB_API_BASE = "https://api.github.com";

/**
 * Make a GitHub API request
 */
async function githubFetch(
  endpoint: string,
  token?: string
): Promise<{ data: unknown; error?: string }> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "kimi-excel-github-plugin",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${GITHUB_API_BASE}${endpoint}`, { headers });

    if (!response.ok) {
      const errorBody = await response.text();
      log.warn("GitHub API error", {
        endpoint,
        status: response.status,
        body: errorBody.slice(0, 200),
      });
      return {
        data: null,
        error: `GitHub API error: ${response.status} - ${response.statusText}`,
      };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    log.error("GitHub fetch error", {
      endpoint,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      data: null,
      error: `Failed to fetch from GitHub: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Get the GitHub token from environment
 */
function getGitHubToken(): string | undefined {
  return process.env.GITHUB_TOKEN || undefined;
}

/**
 * Execute GitHub tool functions
 */
export async function executeGitHubFunction(
  functionName: string,
  args: Record<string, unknown>
): Promise<string> {
  const token = getGitHubToken();

  switch (functionName) {
    case "list_repos": {
      const owner = args.owner as string;
      const type = (args.type as string) || "all";
      const perPage = Math.min((args.per_page as number) || 30, 100);

      if (!owner) {
        return JSON.stringify({ error: "owner is required" });
      }

      // Try as user first, then as org
      let result = await githubFetch(
        `/users/${owner}/repos?type=${type}&per_page=${perPage}&sort=updated`,
        token
      );

      if (result.error?.includes("404")) {
        result = await githubFetch(
          `/orgs/${owner}/repos?type=${type}&per_page=${perPage}&sort=updated`,
          token
        );
      }

      if (result.error) {
        return JSON.stringify({ error: result.error });
      }

      const repos = result.data as Array<{
        name: string;
        full_name: string;
        description: string | null;
        private: boolean;
        html_url: string;
        language: string | null;
        stargazers_count: number;
        forks_count: number;
        updated_at: string;
        default_branch: string;
      }>;

      return JSON.stringify({
        owner,
        count: repos.length,
        repositories: repos.map((r) => ({
          name: r.name,
          full_name: r.full_name,
          description: r.description,
          private: r.private,
          url: r.html_url,
          language: r.language,
          stars: r.stargazers_count,
          forks: r.forks_count,
          updated_at: r.updated_at,
          default_branch: r.default_branch,
        })),
      });
    }

    case "get_repo": {
      const owner = args.owner as string;
      const repo = args.repo as string;

      if (!owner || !repo) {
        return JSON.stringify({ error: "owner and repo are required" });
      }

      const result = await githubFetch(`/repos/${owner}/${repo}`, token);

      if (result.error) {
        return JSON.stringify({ error: result.error });
      }

      const r = result.data as {
        name: string;
        full_name: string;
        description: string | null;
        private: boolean;
        html_url: string;
        language: string | null;
        stargazers_count: number;
        forks_count: number;
        open_issues_count: number;
        created_at: string;
        updated_at: string;
        pushed_at: string;
        default_branch: string;
        topics: string[];
        license: { name: string } | null;
      };

      return JSON.stringify({
        name: r.name,
        full_name: r.full_name,
        description: r.description,
        private: r.private,
        url: r.html_url,
        language: r.language,
        stars: r.stargazers_count,
        forks: r.forks_count,
        open_issues: r.open_issues_count,
        created_at: r.created_at,
        updated_at: r.updated_at,
        pushed_at: r.pushed_at,
        default_branch: r.default_branch,
        topics: r.topics,
        license: r.license?.name,
      });
    }

    case "list_contents": {
      const owner = args.owner as string;
      const repo = args.repo as string;
      const path = (args.path as string) || "";
      const ref = args.ref as string | undefined;

      if (!owner || !repo) {
        return JSON.stringify({ error: "owner and repo are required" });
      }

      const endpoint = ref
        ? `/repos/${owner}/${repo}/contents/${path}?ref=${ref}`
        : `/repos/${owner}/${repo}/contents/${path}`;

      const result = await githubFetch(endpoint, token);

      if (result.error) {
        return JSON.stringify({ error: result.error });
      }

      const contents = Array.isArray(result.data) ? result.data : [result.data];

      return JSON.stringify({
        owner,
        repo,
        path: path || "/",
        ref: ref || "default branch",
        contents: (
          contents as Array<{
            name: string;
            path: string;
            type: string;
            size: number;
            sha: string;
          }>
        ).map((c) => ({
          name: c.name,
          path: c.path,
          type: c.type,
          size: c.size,
        })),
      });
    }

    case "get_file_content": {
      const owner = args.owner as string;
      const repo = args.repo as string;
      const path = args.path as string;
      const ref = args.ref as string | undefined;

      if (!owner || !repo || !path) {
        return JSON.stringify({ error: "owner, repo, and path are required" });
      }

      const endpoint = ref
        ? `/repos/${owner}/${repo}/contents/${path}?ref=${ref}`
        : `/repos/${owner}/${repo}/contents/${path}`;

      const result = await githubFetch(endpoint, token);

      if (result.error) {
        return JSON.stringify({ error: result.error });
      }

      const file = result.data as {
        name: string;
        path: string;
        size: number;
        content?: string;
        encoding?: string;
        type: string;
      };

      if (file.type !== "file") {
        return JSON.stringify({
          error: `Path is a ${file.type}, not a file. Use list_contents for directories.`,
        });
      }

      let content = "";
      if (file.content && file.encoding === "base64") {
        content = Buffer.from(file.content, "base64").toString("utf-8");
      }

      // Truncate large files
      const maxSize = 50000;
      const truncated = content.length > maxSize;
      if (truncated) {
        content = content.slice(0, maxSize) + "\n\n[... content truncated ...]";
      }

      return JSON.stringify({
        name: file.name,
        path: file.path,
        size: file.size,
        truncated,
        content,
      });
    }

    case "list_issues": {
      const owner = args.owner as string;
      const repo = args.repo as string;
      const state = (args.state as string) || "open";
      const perPage = Math.min((args.per_page as number) || 30, 100);

      if (!owner || !repo) {
        return JSON.stringify({ error: "owner and repo are required" });
      }

      const result = await githubFetch(
        `/repos/${owner}/${repo}/issues?state=${state}&per_page=${perPage}&sort=updated`,
        token
      );

      if (result.error) {
        return JSON.stringify({ error: result.error });
      }

      const issues = result.data as Array<{
        number: number;
        title: string;
        state: string;
        user: { login: string };
        labels: Array<{ name: string }>;
        assignees: Array<{ login: string }>;
        created_at: string;
        updated_at: string;
        comments: number;
        pull_request?: unknown;
      }>;

      // Filter out PRs (they appear in issues endpoint)
      const realIssues = issues.filter((i) => !i.pull_request);

      return JSON.stringify({
        owner,
        repo,
        state,
        count: realIssues.length,
        issues: realIssues.map((i) => ({
          number: i.number,
          title: i.title,
          state: i.state,
          author: i.user.login,
          labels: i.labels.map((l) => l.name),
          assignees: i.assignees.map((a) => a.login),
          created_at: i.created_at,
          updated_at: i.updated_at,
          comments: i.comments,
        })),
      });
    }

    case "get_issue": {
      const owner = args.owner as string;
      const repo = args.repo as string;
      const issueNumber = args.issue_number as number;

      if (!owner || !repo || !issueNumber) {
        return JSON.stringify({
          error: "owner, repo, and issue_number are required",
        });
      }

      const [issueResult, commentsResult] = await Promise.all([
        githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}`, token),
        githubFetch(
          `/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=50`,
          token
        ),
      ]);

      if (issueResult.error) {
        return JSON.stringify({ error: issueResult.error });
      }

      const issue = issueResult.data as {
        number: number;
        title: string;
        body: string | null;
        state: string;
        user: { login: string };
        labels: Array<{ name: string }>;
        assignees: Array<{ login: string }>;
        created_at: string;
        updated_at: string;
        closed_at: string | null;
        comments: number;
      };

      const comments = commentsResult.error
        ? []
        : (
            commentsResult.data as Array<{
              user: { login: string };
              body: string;
              created_at: string;
            }>
          ).map((c) => ({
            author: c.user.login,
            body: c.body,
            created_at: c.created_at,
          }));

      return JSON.stringify({
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        author: issue.user.login,
        labels: issue.labels.map((l) => l.name),
        assignees: issue.assignees.map((a) => a.login),
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        closed_at: issue.closed_at,
        comment_count: issue.comments,
        comments,
      });
    }

    case "list_pulls": {
      const owner = args.owner as string;
      const repo = args.repo as string;
      const state = (args.state as string) || "open";
      const perPage = Math.min((args.per_page as number) || 30, 100);

      if (!owner || !repo) {
        return JSON.stringify({ error: "owner and repo are required" });
      }

      const result = await githubFetch(
        `/repos/${owner}/${repo}/pulls?state=${state}&per_page=${perPage}&sort=updated`,
        token
      );

      if (result.error) {
        return JSON.stringify({ error: result.error });
      }

      const pulls = result.data as Array<{
        number: number;
        title: string;
        state: string;
        user: { login: string };
        head: { ref: string };
        base: { ref: string };
        created_at: string;
        updated_at: string;
        merged_at: string | null;
        draft: boolean;
      }>;

      return JSON.stringify({
        owner,
        repo,
        state,
        count: pulls.length,
        pull_requests: pulls.map((p) => ({
          number: p.number,
          title: p.title,
          state: p.state,
          author: p.user.login,
          head_branch: p.head.ref,
          base_branch: p.base.ref,
          created_at: p.created_at,
          updated_at: p.updated_at,
          merged_at: p.merged_at,
          draft: p.draft,
        })),
      });
    }

    case "get_pull": {
      const owner = args.owner as string;
      const repo = args.repo as string;
      const pullNumber = args.pull_number as number;

      if (!owner || !repo || !pullNumber) {
        return JSON.stringify({
          error: "owner, repo, and pull_number are required",
        });
      }

      const [prResult, commentsResult] = await Promise.all([
        githubFetch(`/repos/${owner}/${repo}/pulls/${pullNumber}`, token),
        githubFetch(
          `/repos/${owner}/${repo}/issues/${pullNumber}/comments?per_page=50`,
          token
        ),
      ]);

      if (prResult.error) {
        return JSON.stringify({ error: prResult.error });
      }

      const pr = prResult.data as {
        number: number;
        title: string;
        body: string | null;
        state: string;
        user: { login: string };
        head: { ref: string; sha: string };
        base: { ref: string };
        created_at: string;
        updated_at: string;
        merged_at: string | null;
        closed_at: string | null;
        draft: boolean;
        mergeable: boolean | null;
        additions: number;
        deletions: number;
        changed_files: number;
        comments: number;
        review_comments: number;
      };

      const comments = commentsResult.error
        ? []
        : (
            commentsResult.data as Array<{
              user: { login: string };
              body: string;
              created_at: string;
            }>
          ).map((c) => ({
            author: c.user.login,
            body: c.body,
            created_at: c.created_at,
          }));

      return JSON.stringify({
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        author: pr.user.login,
        head_branch: pr.head.ref,
        head_sha: pr.head.sha,
        base_branch: pr.base.ref,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        merged_at: pr.merged_at,
        closed_at: pr.closed_at,
        draft: pr.draft,
        mergeable: pr.mergeable,
        additions: pr.additions,
        deletions: pr.deletions,
        changed_files: pr.changed_files,
        comment_count: pr.comments + pr.review_comments,
        comments,
      });
    }

    case "list_commits": {
      const owner = args.owner as string;
      const repo = args.repo as string;
      const sha = args.sha as string | undefined;
      const perPage = Math.min((args.per_page as number) || 30, 100);

      if (!owner || !repo) {
        return JSON.stringify({ error: "owner and repo are required" });
      }

      const endpoint = sha
        ? `/repos/${owner}/${repo}/commits?sha=${sha}&per_page=${perPage}`
        : `/repos/${owner}/${repo}/commits?per_page=${perPage}`;

      const result = await githubFetch(endpoint, token);

      if (result.error) {
        return JSON.stringify({ error: result.error });
      }

      const commits = result.data as Array<{
        sha: string;
        commit: {
          message: string;
          author: { name: string; date: string };
        };
        author: { login: string } | null;
      }>;

      return JSON.stringify({
        owner,
        repo,
        branch: sha || "default",
        count: commits.length,
        commits: commits.map((c) => ({
          sha: c.sha.slice(0, 7),
          full_sha: c.sha,
          message: c.commit.message.split("\n")[0], // First line only
          author: c.author?.login || c.commit.author.name,
          date: c.commit.author.date,
        })),
      });
    }

    case "list_branches": {
      const owner = args.owner as string;
      const repo = args.repo as string;
      const perPage = Math.min((args.per_page as number) || 30, 100);

      if (!owner || !repo) {
        return JSON.stringify({ error: "owner and repo are required" });
      }

      const result = await githubFetch(
        `/repos/${owner}/${repo}/branches?per_page=${perPage}`,
        token
      );

      if (result.error) {
        return JSON.stringify({ error: result.error });
      }

      const branches = result.data as Array<{
        name: string;
        commit: { sha: string };
        protected: boolean;
      }>;

      return JSON.stringify({
        owner,
        repo,
        count: branches.length,
        branches: branches.map((b) => ({
          name: b.name,
          sha: b.commit.sha.slice(0, 7),
          protected: b.protected,
        })),
      });
    }

    default:
      return JSON.stringify({ error: `Unknown function: ${functionName}` });
  }
}

/**
 * GitHub Plugin for Kimi
 *
 * Provides read-only access to GitHub repositories, issues, PRs, and more.
 * Requires GITHUB_TOKEN environment variable for private repository access.
 */
export class GitHubPlugin implements KimiUtilityPlugin {
  readonly name = "github";
  readonly description =
    "A utility tool for accessing GitHub repositories, files, issues, pull requests, commits, and branches. " +
    "Provides read-only access to both public and private repositories (with token).";

  readonly autoInclude = true;

  private readonly functions = [
    "list_repos",
    "get_repo",
    "list_contents",
    "get_file_content",
    "list_issues",
    "get_issue",
    "list_pulls",
    "get_pull",
    "list_commits",
    "list_branches",
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
    return executeGitHubFunction(baseName, args);
  }

  getToolDefinition(): UtilityPluginTool {
    return {
      type: "_plugin",
      _plugin: {
        name: this.name,
        description: this.description,
        functions: [
          {
            name: "list_repos",
            description:
              "List repositories for a GitHub user or organization. " +
              "Returns repository names, descriptions, languages, stars, and update times.",
            parameters: {
              type: "object",
              properties: {
                owner: {
                  type: "string",
                  description: "GitHub username or organization name",
                },
                type: {
                  type: "string",
                  description:
                    "Type of repositories to list: all, owner, member. Defaults to all.",
                  enum: ["all", "owner", "member"],
                },
                per_page: {
                  type: "number",
                  description: "Number of results per page (max 100). Defaults to 30.",
                },
              },
              required: ["owner"],
            },
          },
          {
            name: "get_repo",
            description:
              "Get detailed information about a specific repository including " +
              "description, stars, forks, issues count, topics, and license.",
            parameters: {
              type: "object",
              properties: {
                owner: {
                  type: "string",
                  description: "Repository owner (username or organization)",
                },
                repo: {
                  type: "string",
                  description: "Repository name",
                },
              },
              required: ["owner", "repo"],
            },
          },
          {
            name: "list_contents",
            description:
              "List contents of a directory in a repository. " +
              "Returns file and folder names, types, and sizes.",
            parameters: {
              type: "object",
              properties: {
                owner: {
                  type: "string",
                  description: "Repository owner",
                },
                repo: {
                  type: "string",
                  description: "Repository name",
                },
                path: {
                  type: "string",
                  description:
                    "Path to directory. Empty or '/' for root. Example: 'src/components'",
                },
                ref: {
                  type: "string",
                  description:
                    "Git ref (branch, tag, or commit SHA). Defaults to default branch.",
                },
              },
              required: ["owner", "repo"],
            },
          },
          {
            name: "get_file_content",
            description:
              "Read the content of a file from a repository. " +
              "Returns the file content as text. Large files are truncated.",
            parameters: {
              type: "object",
              properties: {
                owner: {
                  type: "string",
                  description: "Repository owner",
                },
                repo: {
                  type: "string",
                  description: "Repository name",
                },
                path: {
                  type: "string",
                  description: "Path to file. Example: 'src/index.ts' or 'README.md'",
                },
                ref: {
                  type: "string",
                  description:
                    "Git ref (branch, tag, or commit SHA). Defaults to default branch.",
                },
              },
              required: ["owner", "repo", "path"],
            },
          },
          {
            name: "list_issues",
            description:
              "List issues in a repository. " +
              "Returns issue numbers, titles, states, labels, and assignees.",
            parameters: {
              type: "object",
              properties: {
                owner: {
                  type: "string",
                  description: "Repository owner",
                },
                repo: {
                  type: "string",
                  description: "Repository name",
                },
                state: {
                  type: "string",
                  description: "Issue state filter: open, closed, or all. Defaults to open.",
                  enum: ["open", "closed", "all"],
                },
                per_page: {
                  type: "number",
                  description: "Number of results per page (max 100). Defaults to 30.",
                },
              },
              required: ["owner", "repo"],
            },
          },
          {
            name: "get_issue",
            description:
              "Get detailed information about a specific issue including " +
              "body, labels, assignees, and comments.",
            parameters: {
              type: "object",
              properties: {
                owner: {
                  type: "string",
                  description: "Repository owner",
                },
                repo: {
                  type: "string",
                  description: "Repository name",
                },
                issue_number: {
                  type: "number",
                  description: "Issue number",
                },
              },
              required: ["owner", "repo", "issue_number"],
            },
          },
          {
            name: "list_pulls",
            description:
              "List pull requests in a repository. " +
              "Returns PR numbers, titles, states, branches, and authors.",
            parameters: {
              type: "object",
              properties: {
                owner: {
                  type: "string",
                  description: "Repository owner",
                },
                repo: {
                  type: "string",
                  description: "Repository name",
                },
                state: {
                  type: "string",
                  description: "PR state filter: open, closed, or all. Defaults to open.",
                  enum: ["open", "closed", "all"],
                },
                per_page: {
                  type: "number",
                  description: "Number of results per page (max 100). Defaults to 30.",
                },
              },
              required: ["owner", "repo"],
            },
          },
          {
            name: "get_pull",
            description:
              "Get detailed information about a specific pull request including " +
              "body, branches, merge status, diff stats, and comments.",
            parameters: {
              type: "object",
              properties: {
                owner: {
                  type: "string",
                  description: "Repository owner",
                },
                repo: {
                  type: "string",
                  description: "Repository name",
                },
                pull_number: {
                  type: "number",
                  description: "Pull request number",
                },
              },
              required: ["owner", "repo", "pull_number"],
            },
          },
          {
            name: "list_commits",
            description:
              "List commits in a repository. " +
              "Returns commit SHAs, messages, authors, and dates.",
            parameters: {
              type: "object",
              properties: {
                owner: {
                  type: "string",
                  description: "Repository owner",
                },
                repo: {
                  type: "string",
                  description: "Repository name",
                },
                sha: {
                  type: "string",
                  description:
                    "Branch name, tag, or commit SHA to list commits from. Defaults to default branch.",
                },
                per_page: {
                  type: "number",
                  description: "Number of results per page (max 100). Defaults to 30.",
                },
              },
              required: ["owner", "repo"],
            },
          },
          {
            name: "list_branches",
            description:
              "List branches in a repository. " +
              "Returns branch names, latest commit SHAs, and protection status.",
            parameters: {
              type: "object",
              properties: {
                owner: {
                  type: "string",
                  description: "Repository owner",
                },
                repo: {
                  type: "string",
                  description: "Repository name",
                },
                per_page: {
                  type: "number",
                  description: "Number of results per page (max 100). Defaults to 30.",
                },
              },
              required: ["owner", "repo"],
            },
          },
        ],
      },
    };
  }

  getSystemPromptAddition(): string {
    const hasToken = !!getGitHubToken();
    return (
      "You have access to a GitHub utility that can read repositories, files, issues, pull requests, commits, and branches. " +
      (hasToken
        ? "A GitHub token is configured, so you can access both public and private repositories. "
        : "No GitHub token is configured, so only public repositories are accessible. ") +
      "Use the github plugin tools to fetch real-time data from GitHub. " +
      "When the user mentions a GitHub repository, use the appropriate function to get information. " +
      "Repository references can be in 'owner/repo' format (e.g., 'facebook/react')."
    );
  }
}
