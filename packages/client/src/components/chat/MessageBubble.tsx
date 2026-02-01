import type { ChatMessage } from "@kimi-excel/shared";

// Strip timestamp prefix from server-generated filenames
function getDisplayName(filename: string): string {
  const match = filename.match(/^\d+-\d+-(.+)$/);
  return match ? match[1] : filename;
}

interface MessageBubbleProps {
  message: ChatMessage;
  isLast?: boolean;
}

export function MessageBubble({ message, isLast }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isStreaming = message.isStreaming;

  const ariaLabel = isUser 
    ? "Your message" 
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
          {message.content || (isStreaming && (
            <span className="typing-indicator" role="status" aria-label="Thinking">
              Thinking...
            </span>
          ))}
        </div>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="message-tool-calls">
            <details>
              <summary aria-label={`Tool calls: ${message.toolCalls.length}`}>
                Tool calls ({message.toolCalls.length})
              </summary>
              <ul aria-label="Tool call details">
                {message.toolCalls.map((tc, idx) => (
                  <li key={tc.id || idx}>
                    <strong>{tc._plugin.name}</strong>
                    <code aria-label="Arguments">{tc._plugin.arguments}</code>
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
