import { create } from "zustand";
import type { ChatMessage, ChatAttachment, KimiPluginToolCall } from "@kimi-excel/shared";
import { storage } from "../lib/storage.js";
import { api } from "../api/client.js";
import logger from "../lib/logger.js";

interface PendingAttachment {
  fileId: string;
  filename: string;
}

interface ChatState {
  messages: Record<string, ChatMessage[]>;
  isStreaming: boolean;
  pendingAttachments: PendingAttachment[];
  error: string | null;
  abortController: { abort: () => void } | null;
}

interface ChatActions {
  loadMessages: (conversationId: string) => ChatMessage[];
  sendMessage: (
    conversationId: string,
    content: string,
    attachments: ChatAttachment[],
    fileIds: string[],
    options?: { model?: string; usePlugin?: boolean }
  ) => void;
  abortStream: (conversationId?: string) => void;
  addAttachment: (attachment: PendingAttachment) => void;
  removeAttachment: (fileId: string) => void;
  clearAttachments: () => void;
  clearError: () => void;
  updateConversationTitle: (conversationId: string, title: string) => void;
}

type ChatStore = ChatState & ChatActions;

function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: {},
  isStreaming: false,
  pendingAttachments: [],
  error: null,
  abortController: null,

  loadMessages: (conversationId: string) => {
    const { messages } = get();
    if (messages[conversationId]) {
      return messages[conversationId];
    }

    const loaded = storage.getMessages(conversationId);
    set({ messages: { ...messages, [conversationId]: loaded } });
    return loaded;
  },

  sendMessage: (conversationId, content, attachments, fileIds, options = {}) => {
    logger.info("ChatStore", "sendMessage called", {
      conversationId,
      contentLength: content.length,
      attachmentCount: attachments.length,
      fileIds,
      options,
    });

    // Abort any ongoing stream
    get().abortStream();

    const { messages } = get();
    const conversationMessages = messages[conversationId] ?? [];

    // Create user message
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      conversationId,
      role: "user",
      content,
      attachments: attachments.length > 0 ? attachments : undefined,
      createdAt: Date.now(),
    };

    // Create placeholder assistant message
    const assistantMessage: ChatMessage = {
      id: generateMessageId(),
      conversationId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      isStreaming: true,
    };

    const updatedMessages = [...conversationMessages, userMessage, assistantMessage];

    logger.debug("ChatStore", "Setting state with messages", {
      updatedMessagesCount: updatedMessages.length,
    });

    set({
      messages: { ...messages, [conversationId]: updatedMessages },
      isStreaming: true,
      error: null,
      pendingAttachments: [],
    });

    // Save user message immediately
    storage.saveMessages(conversationId, [...conversationMessages, userMessage]);
    logger.debug("ChatStore", "User message saved to storage");

    // Build conversation history for context
    const historyMessages = conversationMessages
      .filter((m) => !m.isStreaming)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    logger.debug("ChatStore", "Calling api.chatStream", {
      historyMessagesCount: historyMessages.length,
    });

    try {
      const controller = api.chatStream(
        {
          conversationId,
          message: content,
          fileIds,
          history: historyMessages,
          ...options,
        },
        {
          onChunk: (chunk) => {
            logger.debug("ChatStore", "onChunk received", {
              chunkLength: chunk.length,
              chunkPreview: chunk.substring(0, 50),
            });
            const { messages } = get();
            const convMessages = messages[conversationId] ?? [];
            const lastIdx = convMessages.length - 1;
            if (lastIdx >= 0 && convMessages[lastIdx].role === "assistant") {
              const updatedMsg = {
                ...convMessages[lastIdx],
                content: convMessages[lastIdx].content + chunk,
              };
              const newMessages = [...convMessages.slice(0, lastIdx), updatedMsg];
              set({ messages: { ...messages, [conversationId]: newMessages } });
            }
          },
          onToolCall: (toolCall: KimiPluginToolCall) => {
            logger.info("ChatStore", "onToolCall received", { toolCall });
            const { messages } = get();
            const convMessages = messages[conversationId] ?? [];
            const lastIdx = convMessages.length - 1;
            if (lastIdx >= 0 && convMessages[lastIdx].role === "assistant") {
              const lastMsg = convMessages[lastIdx];
              const updatedMsg = {
                ...lastMsg,
                toolCalls: [...(lastMsg.toolCalls ?? []), toolCall],
              };
              const newMessages = [...convMessages.slice(0, lastIdx), updatedMsg];
              set({ messages: { ...messages, [conversationId]: newMessages } });
            }
          },
          onDone: (event) => {
            logger.info("ChatStore", "onDone received", {
              contentLength: event.content.length,
              contentPreview: event.content.substring(0, 100),
              toolCallsCount: event.toolCalls.length,
            });
            const { messages } = get();
            const convMessages = messages[conversationId] ?? [];
            const lastIdx = convMessages.length - 1;
            if (lastIdx >= 0 && convMessages[lastIdx].role === "assistant") {
              const updatedMsg = {
                ...convMessages[lastIdx],
                content: event.content,
                toolCalls: event.toolCalls.length > 0 ? event.toolCalls : undefined,
                isStreaming: false,
              };
              const newMessages = [...convMessages.slice(0, lastIdx), updatedMsg];
              set({
                messages: { ...messages, [conversationId]: newMessages },
                isStreaming: false,
                abortController: null,
              });
              storage.saveMessages(conversationId, newMessages);
            }
          },
          onError: (message) => {
            logger.error("ChatStore", "onError received", { errorMessage: message });
            const { messages } = get();
            const convMessages = messages[conversationId] ?? [];
            // Remove the streaming assistant message on error
            const withoutStreaming = convMessages.filter((m) => !m.isStreaming);
            set({
              messages: { ...messages, [conversationId]: withoutStreaming },
              isStreaming: false,
              error: message,
              abortController: null,
            });
            storage.saveMessages(conversationId, withoutStreaming);
          },
        }
      );

      logger.debug("ChatStore", "api.chatStream returned controller");
      set({ abortController: controller });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error("ChatStore", "Synchronous error in sendMessage", {
        message: error.message,
        stack: error.stack,
      });
      
      // Handle synchronous errors (e.g., network failure before request starts)
      const { messages } = get();
      const convMessages = messages[conversationId] ?? [];
      const withoutStreaming = convMessages.filter((m) => !m.isStreaming);
      set({
        messages: { ...messages, [conversationId]: withoutStreaming },
        isStreaming: false,
        error: error.message,
        abortController: null,
      });
      storage.saveMessages(conversationId, withoutStreaming);
    }
  },

  abortStream: (conversationId?: string) => {
    const { abortController, messages } = get();
    if (abortController) {
      abortController.abort();

      // Preserve partial content if we have a conversationId
      if (conversationId) {
        const convMessages = messages[conversationId] ?? [];
        const lastIdx = convMessages.length - 1;
        if (lastIdx >= 0 && convMessages[lastIdx].isStreaming) {
          const lastMsg = convMessages[lastIdx];
          // Only keep the message if it has content
          if (lastMsg.content.trim()) {
            const updatedMsg = {
              ...lastMsg,
              isStreaming: false,
              content: lastMsg.content + "\n\n[Generation stopped]",
            };
            const newMessages = [...convMessages.slice(0, lastIdx), updatedMsg];
            set({ messages: { ...messages, [conversationId]: newMessages } });
            storage.saveMessages(conversationId, newMessages);
          } else {
            // Remove empty streaming message
            const newMessages = convMessages.slice(0, lastIdx);
            set({ messages: { ...messages, [conversationId]: newMessages } });
            storage.saveMessages(conversationId, newMessages);
          }
        }
      }

      set({ abortController: null, isStreaming: false });
    }
  },

  addAttachment: (attachment) => {
    const { pendingAttachments } = get();
    if (!pendingAttachments.some((a) => a.fileId === attachment.fileId)) {
      set({ pendingAttachments: [...pendingAttachments, attachment] });
    }
  },

  removeAttachment: (fileId) => {
    const { pendingAttachments } = get();
    set({
      pendingAttachments: pendingAttachments.filter((a) => a.fileId !== fileId),
    });
  },

  clearAttachments: () => {
    set({ pendingAttachments: [] });
  },

  clearError: () => {
    set({ error: null });
  },

  updateConversationTitle: (conversationId, title) => {
    // This is just a helper - the actual update happens in conversationStore
    // This is here for triggering re-renders if needed
  },
}));
