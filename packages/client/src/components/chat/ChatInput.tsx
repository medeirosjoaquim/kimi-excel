import { useState, useRef, type FormEvent, type KeyboardEvent } from "react";
import { Mic, MicOff } from "lucide-react";
import { useChatStore } from "../../stores/useChatStore.js";
import { useConversationStore } from "../../stores/useConversationStore.js";
import { useVoiceInput } from "../../hooks/useVoiceInput.js";
import logger from "../../lib/logger.js";
import { AttachmentButton } from "./AttachmentButton.js";
import { AttachmentPreview } from "./AttachmentPreview.js";

interface ChatInputProps {
  conversationId: string | null;
  fileIds: string[];
}

export function ChatInput({ conversationId, fileIds }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
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

  const voiceError = useRef<string | null>(null);
  const [voiceErrorDisplay, setVoiceErrorDisplay] = useState<string | null>(null);

  const {
    isSupported: isVoiceSupported,
    isRecording,
    error: voiceInputError,
    startRecording,
    stopRecording,
    clearError: clearVoiceError,
  } = useVoiceInput({
    onTranscript: (transcript, isFinal) => {
      logger.debug("ChatInput", `Voice transcript: ${transcript.substring(0, 30)}..., final=${isFinal}`);

      if (isFinal) {
        // Append final transcript to message, clear interim
        setMessage((prev) => {
          const newMessage = prev.trim() + (prev.trim() ? " " : "") + transcript;
          return newMessage;
        });
        setInterimTranscript("");
      } else {
        // Show interim results without modifying final message
        setInterimTranscript(transcript);
      }
    },
    onError: (error) => {
      logger.warn("ChatInput", `Voice input error: ${error}`);
      voiceError.current = error;
      setVoiceErrorDisplay(error);
    },
  });

  const handleVoiceToggle = () => {
    logger.debug("ChatInput", `Voice toggle: ${isRecording ? "stop" : "start"}`);

    if (isRecording) {
      logger.info("ChatInput", "Stopping voice recording");
      stopRecording();
    } else {
      logger.info("ChatInput", "Starting voice recording");
      clearVoiceError();
      setVoiceErrorDisplay(null);
      startRecording();
    }
  };

  const handleVoiceErrorDismiss = () => {
    setVoiceErrorDisplay(null);
    clearVoiceError();
  };

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();

    const trimmedMessage = message.trim();
    logger.debug("ChatInput", `handleSubmit called: "${trimmedMessage.substring(0, 30)}...", streaming=${isStreaming}, conv=${conversationId}`);

    if (!trimmedMessage || isStreaming) {
      logger.debug("ChatInput", `Submit blocked: ${!trimmedMessage ? "empty message" : "streaming"}`);
      return;
    }

    try {
      // Create conversation if needed
      let activeConvId = conversationId;
      if (!activeConvId) {
        logger.debug("ChatInput", "Creating new conversation");
        const newConv = createConversation(pendingAttachments.map((a) => a.fileId));
        activeConvId = newConv.id;
        logger.info("ChatInput", `New conversation created: ${activeConvId}`);
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

      logger.info("ChatInput", `Sending message to ${activeConvId}: ${trimmedMessage.length} chars, ${attachments.length} attachments`);

      sendMessage(
        activeConvId,
        trimmedMessage,
        attachments,
        conversationFileIds,
        { usePlugin: false }
      );

      logger.debug("ChatInput", "Message sent successfully");
      setMessage("");
      clearAttachments();
      clearError();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("ChatInput", `Error submitting message: ${error.message}`);
      throw err;
    }
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
      {/* Live region for status announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isStreaming ? "AI is generating a response..." : ""}
        {error ? `Error: ${error}` : ""}
      </div>

      {error && (
        <div
          className="chat-input-error"
          role="alert"
          aria-live="assertive"
        >
          <span>{error}</span>
          <button
            onClick={clearError}
            aria-label="Dismiss error"
          >
            Dismiss
          </button>
        </div>
      )}

      {voiceErrorDisplay && (
        <div
          className="chat-input-voice-error"
          role="alert"
          aria-live="assertive"
        >
          <span>{voiceErrorDisplay}</span>
          <button
            onClick={handleVoiceErrorDismiss}
            aria-label="Dismiss voice error"
          >
            Dismiss
          </button>
        </div>
      )}

      <AttachmentPreview />

      <form 
        className={`chat-input-form ${isStreaming ? "generating" : ""}`} 
        onSubmit={handleSubmit}
        aria-label="Send a message"
      >
        <AttachmentButton />

        {isVoiceSupported && (
          <button
            type="button"
            className={`chat-input-voice ${isRecording ? "recording" : ""}`}
            onClick={handleVoiceToggle}
            disabled={isStreaming}
            aria-label={isRecording ? "Stop recording" : "Start voice input"}
            title={isRecording ? "Stop recording" : "Start voice input"}
          >
            {isRecording ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
        )}

        <div className="chat-input-wrapper">
          <label htmlFor="chat-message-input" className="sr-only">
            Message
          </label>
          <textarea
            id="chat-message-input"
            ref={textareaRef}
            className="chat-input-textarea"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your Excel files... (or use voice)"
            disabled={isStreaming}
            rows={1}
            aria-label="Type your message"
            aria-describedby="message-hint"
            aria-disabled={isStreaming}
          />
          {isRecording && interimTranscript && (
            <div className="chat-input-interim" aria-live="polite">
              {interimTranscript}
            </div>
          )}
          <p id="message-hint" className="sr-only">
            Press Enter to send, Shift+Enter for a new line
          </p>
          {isStreaming && (
            <div 
              className="chat-input-generating"
              role="status"
              aria-live="polite"
            >
              Generating...
            </div>
          )}
        </div>

        {isStreaming ? (
          <button
            type="button"
            className="chat-input-stop"
            onClick={handleStop}
            aria-label="Stop generating response"
            title="Stop generating"
          >
            Stop
          </button>
        ) : (
          <button
            type="submit"
            className="chat-input-send"
            disabled={!message.trim()}
            aria-label="Send message"
            title="Send message"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}
