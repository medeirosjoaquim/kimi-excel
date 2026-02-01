import type { ChatMessage } from "@kimi-excel/shared";

// Strip timestamp prefix from server-generated filenames
function getDisplayName(filename: string): string {
  const match = filename.match(/^\d+-\d+-(.+)$/);
  return match ? match[1] : filename;
}

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isStreaming = message.isStreaming;

  return (
    <div className={`message-bubble ${isUser ? "user" : "assistant"}`}>
      <div className="message-avatar">
        {isUser ? "U" : "K"}
      </div>
      <div className="message-content-wrapper">
        {message.attachments && message.attachments.length > 0 && (
          <div className="message-attachments">
            {message.attachments.map((att) => (
              <span key={att.fileId} className="attachment-badge" title={getDisplayName(att.filename)}>
                {getDisplayName(att.filename)}
              </span>
            ))}
          </div>
        )}
        <div className={`message-content ${isStreaming ? "streaming" : ""}`}>
          {message.content || (isStreaming && <span className="typing-indicator">Thinking...</span>)}
        </div>
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="message-tool-calls">
            <details>
              <summary>Tool calls ({message.toolCalls.length})</summary>
              <ul>
                {message.toolCalls.map((tc, idx) => (
                  <li key={tc.id || idx}>
                    <strong>{tc._plugin.name}</strong>
                    <code>{tc._plugin.arguments}</code>
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
