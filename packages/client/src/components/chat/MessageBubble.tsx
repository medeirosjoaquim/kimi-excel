import { useMemo } from "react";
import Markdown from "react-markdown";
import type { ChatMessage } from "@kimi-excel/shared";
import { parseMessageContent, hasBase64FileContent } from "../../lib/fileParser.js";
import { FileDownloadButton } from "./FileDownloadButton.js";

// Strip timestamp prefix from server-generated filenames
function getDisplayName(filename: string): string {
  const match = filename.match(/^\d+-\d+-(.+)$/);
  return match ? match[1] : filename;
}

// XLSX files in base64 start with PK zip header: UEsDBB
const XLSX_BASE64_MARKER = "UEsDBB";

/**
 * Filters out base64 file content from streaming text to avoid showing raw data.
 * Returns the text before any base64 content starts.
 */
function filterStreamingContent(content: string): { text: string; hasFileContent: boolean } {
  // Check if content contains base64 file data
  const markerIndex = content.indexOf(XLSX_BASE64_MARKER);

  if (markerIndex === -1) {
    return { text: content, hasFileContent: false };
  }

  // Find the start of the code block containing the base64
  // Look for ``` before the marker
  const beforeMarker = content.slice(0, markerIndex);
  const codeBlockStart = beforeMarker.lastIndexOf("```");

  if (codeBlockStart !== -1) {
    // Return text before the code block, indicate file is being generated
    return {
      text: content.slice(0, codeBlockStart).trim(),
      hasFileContent: true
    };
  }

  // No code block found, just return text before marker
  return {
    text: beforeMarker.trim(),
    hasFileContent: true
  };
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

  // Check for file content during streaming
  const streamingFileInfo = useMemo(() => {
    if (!isUser && isStreaming && message.content) {
      return filterStreamingContent(message.content);
    }
    return null;
  }, [message.content, isUser, isStreaming]);

  const isGeneratingFile = streamingFileInfo?.hasFileContent;

  // Parse message content for base64 files (only for assistant messages that aren't streaming)
  const parsedContent = useMemo(() => {
    if (isUser || isStreaming || !hasBase64FileContent(message.content)) {
      return null;
    }
    return parseMessageContent(message.content);
  }, [message.content, isUser, isStreaming]);

  const ariaLabel = isUser
    ? "Your message"
    : isProcessingTool
      ? "Assistant is working"
      : isGeneratingFile
        ? "Assistant is generating a file"
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
          {isProcessingTool ? (
            <span className="processing-indicator" role="status" aria-label="Working">
              Working...
            </span>
          ) : isGeneratingFile ? (
            <>
              {streamingFileInfo?.text && <Markdown>{streamingFileInfo.text}</Markdown>}
              <span className="generating-indicator" role="status" aria-label="Generating file">
                Generating file...
              </span>
            </>
          ) : parsedContent ? (
            <Markdown>{parsedContent.text}</Markdown>
          ) : message.content ? (
            <Markdown
              components={{
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
              }}
            >
              {message.content}
            </Markdown>
          ) : isStreaming ? (
            <span className="typing-indicator" role="status" aria-label="Thinking">
              Thinking...
            </span>
          ) : null}
        </div>
        {parsedContent && parsedContent.files.length > 0 && (
          <div className="message-files" aria-label="Generated files">
            {parsedContent.files.map((file, idx) => (
              <FileDownloadButton key={`${file.filename}-${idx}`} file={file} />
            ))}
          </div>
        )}
        {hasToolCalls && (
          <div className="message-tool-calls">
            <details open={isProcessingTool}>
              <summary aria-label={`Tool calls: ${message.toolCalls!.length}`}>
                {isProcessingTool ? "Running" : "Actions"} ({message.toolCalls!.length})
              </summary>
              <ul aria-label="Tool call details">
                {message.toolCalls!.map((tc, idx) => (
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
