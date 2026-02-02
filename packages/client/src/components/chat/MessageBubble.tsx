import type { ChatMessage } from "@kimi-excel/shared";
import Markdown from "react-markdown";

// Strip timestamp prefix from server-generated filenames
function getDisplayName(filename: string): string {
  const match = filename.match(/^\d+-\d+-(.+)$/);
  return match ? match[1] : filename;
}

// Humanize tool function names for display
function humanizeToolName(name: string): string {
  // Known tool mappings for better labels
  const toolLabels: Record<string, string> = {
    // Excel export
    "excel_export.export_to_excel": "Exporting to Excel",
    "excel_export.export_conversation": "Exporting conversation",
    "excel_export.export_analysis_result": "Exporting analysis",
    "excel_export.export_file_data": "Exporting file data",
    // GitHub
    "github.list_repos": "Fetching repositories",
    "github.get_repo": "Fetching repository details",
    "github.list_issues": "Fetching issues",
    "github.get_issue": "Fetching issue details",
    "github.list_pulls": "Fetching pull requests",
    "github.get_pull": "Fetching PR details",
    "github.list_commits": "Fetching commits",
    "github.list_branches": "Fetching branches",
    "github.list_contents": "Browsing repository",
    "github.get_file_content": "Reading file",
    // Linear
    "linear.list_teams": "Fetching teams",
    "linear.list_team_members": "Fetching team members",
    "linear.list_issues": "Fetching issues",
    "linear.get_issue": "Fetching issue details",
    "linear.search_issues": "Searching issues",
    "linear.update_issue_status": "Updating issue status",
    // Timezone
    "timezone.get_current_time": "Getting current time",
    "timezone.convert_time": "Converting time",
    "timezone.list_timezones": "Listing timezones",
  };

  // Check for exact match
  if (toolLabels[name]) {
    return toolLabels[name];
  }

  // Fallback: humanize the function name
  // Remove plugin prefix (e.g., "excel_export.export_to_excel" -> "export_to_excel")
  const baseName = name.includes(".") ? name.split(".").pop() || name : name;

  // Convert snake_case to Title Case
  return baseName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

interface MessageBubbleProps {
  message: ChatMessage;
  isLast?: boolean;
}

export function MessageBubble({ message, isLast }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isStreaming = message.isStreaming;
  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;
  const isProcessingTool = isStreaming && hasToolCalls;

  const ariaLabel = isUser
    ? "Your message"
    : isProcessingTool
      ? "Assistant is working"
      : isStreaming
        ? "Assistant is typing"
        : "Assistant message";

  return (
    <div 
      className={`message-bubble ${isUser ? "user" : "assistant"}`}
      role="article"
      aria-label={ariaLabel}
      aria-current={isLast ? "true" : undefined}
    >
      <div 
        className="message-avatar"
        aria-label={isUser ? "You" : "Kimi Assistant"}
        aria-hidden="true"
      >
        {isUser ? "U" : "K"}
      </div>
      <div className="message-content-wrapper">
        {message.attachments && message.attachments.length > 0 && (
          <div 
            className="message-attachments"
            aria-label={`Attached files: ${message.attachments.length}`}
          >
            {message.attachments.map((att) => (
              <span 
                key={att.fileId} 
                className="attachment-badge" 
                title={getDisplayName(att.filename)}
              >
                {getDisplayName(att.filename)}
              </span>
            ))}
          </div>
        )}
        <div
          className={`message-content ${isStreaming ? "streaming" : ""}`}
          aria-live={isStreaming ? "polite" : undefined}
          aria-atomic="true"
        >
          {message.content ? (
            <Markdown
              components={{
                a: ({ href, children }) => {
                  // Internal API links (downloads) - same tab
                  const isApiLink = href?.startsWith("/api/");
                  return (
                    <a
                      href={href}
                      target={isApiLink ? "_self" : "_blank"}
                      rel={isApiLink ? undefined : "noopener noreferrer"}
                      className="message-link"
                    >
                      {children}
                    </a>
                  );
                },
              }}
            >
              {message.content}
            </Markdown>
          ) : (
            isStreaming && (
              <span className="typing-indicator" role="status" aria-label="Thinking">
                Thinking...
              </span>
            )
          )}
          {isProcessingTool && (
            <span className="processing-indicator" role="status" aria-label="Working">
              Working...
            </span>
          )}
        </div>
        {hasToolCalls && (
          <div className="message-tool-calls">
            <details open={isProcessingTool}>
              <summary aria-label={`Actions: ${message.toolCalls!.length}`}>
                {isProcessingTool ? "Running" : "Actions"} ({message.toolCalls!.length})
              </summary>
              <ul aria-label="Action details">
                {message.toolCalls!.map((tc, idx) => (
                  <li key={tc.id || idx} className="tool-call-item">
                    <span className="tool-call-label">
                      {humanizeToolName(tc._plugin.name)}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
