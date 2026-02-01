import { useState, useRef, type FormEvent, type KeyboardEvent } from "react";
import { useChatStore } from "../../stores/useChatStore.js";
import { useConversationStore } from "../../stores/useConversationStore.js";
import { AttachmentButton } from "./AttachmentButton.js";
import { AttachmentPreview } from "./AttachmentPreview.js";

interface ChatInputProps {
  conversationId: string | null;
  fileIds: string[];
}

export function ChatInput({ conversationId, fileIds }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendMessage = useChatStore((s) => s.sendMessage);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const abortStream = useChatStore((s) => s.abortStream);
  const pendingAttachments = useChatStore((s) => s.pendingAttachments);
  const clearAttachments = useChatStore((s) => s.clearAttachments);
  const error = useChatStore((s) => s.error);
  const clearError = useChatStore((s) => s.clearError);

  const createConversation = useConversationStore((s) => s.create);
  const addFile = useConversationStore((s) => s.addFile);
  const updateTimestamp = useConversationStore((s) => s.updateTimestamp);
  const rename = useConversationStore((s) => s.rename);

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();

    const trimmedMessage = message.trim();
    if (!trimmedMessage || isStreaming) return;

    // Create conversation if needed
    let activeConvId = conversationId;
    if (!activeConvId) {
      const newConv = createConversation(pendingAttachments.map((a) => a.fileId));
      activeConvId = newConv.id;
    } else {
      // Add pending attachments to conversation
      for (const att of pendingAttachments) {
        addFile(activeConvId, att.fileId);
      }
    }

    // Generate title from first message if it's a new conversation
    const conversationFileIds = [
      ...fileIds,
      ...pendingAttachments.map((a) => a.fileId),
    ];

    // Update conversation timestamp
    updateTimestamp(activeConvId);

    // Generate a title from the first message
    const isFirstMessage = !conversationId;
    if (isFirstMessage) {
      const title =
        trimmedMessage.length > 30
          ? trimmedMessage.slice(0, 30) + "..."
          : trimmedMessage;
      rename(activeConvId, title);
    }

    const attachments = pendingAttachments.map((a) => ({
      fileId: a.fileId,
      filename: a.filename,
    }));

    sendMessage(
      activeConvId,
      trimmedMessage,
      attachments,
      conversationFileIds,
      { usePlugin: false }
    );

    setMessage("");
    clearAttachments();
    clearError();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleStop = () => {
    abortStream(conversationId ?? undefined);
  };

  return (
    <div className="chat-input-container">
      {error && (
        <div className="chat-input-error">
          {error}
          <button onClick={clearError}>Dismiss</button>
        </div>
      )}

      <AttachmentPreview />

      <form className={`chat-input-form ${isStreaming ? "generating" : ""}`} onSubmit={handleSubmit}>
        <AttachmentButton />

        <div className="chat-input-wrapper">
          <textarea
            ref={textareaRef}
            className="chat-input-textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your Excel files..."
            disabled={isStreaming}
            rows={1}
          />
          {isStreaming && (
            <div className="chat-input-generating">Generating...</div>
          )}
        </div>

        {isStreaming ? (
          <button
            type="button"
            className="chat-input-stop"
            onClick={handleStop}
            title="Stop generating"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            className="chat-input-send"
            disabled={!message.trim()}
            title="Send message"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}
