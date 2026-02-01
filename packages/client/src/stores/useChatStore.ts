import { create } from "zustand";
import type { ChatMessage, ChatAttachment, KimiPluginToolCall } from "@kimi-excel/shared";
import { storage } from "../lib/storage.js";
import { api } from "../api/client.js";

interface PendingAttachment {
  fileId: string;
  filename: string;
}

interface ChatState {
  messages: Map<string, ChatMessage[]>;
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
  messages: new Map(),
  isStreaming: false,
  pendingAttachments: [],
  error: null,
  abortController: null,

  loadMessages: (conversationId: string) => {
    const { messages } = get();
    if (messages.has(conversationId)) {
      return messages.get(conversationId)!;
    }

    const loaded = storage.getMessages(conversationId);
    const updated = new Map(messages);
    updated.set(conversationId, loaded);
    set({ messages: updated });
    return loaded;
  },

  sendMessage: (conversationId, content, attachments, fileIds, options = {}) => {
    // Abort any ongoing stream
    get().abortStream();

    const { messages } = get();
    const conversationMessages = messages.get(conversationId) ?? [];

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
    const updated = new Map(messages);
    updated.set(conversationId, updatedMessages);

    set({
      messages: updated,
      isStreaming: true,
      error: null,
      pendingAttachments: [],
    });

    // Save user message immediately
    storage.saveMessages(conversationId, [...conversationMessages, userMessage]);

    // Build conversation history for context
    const historyMessages = conversationMessages
      .filter((m) => !m.isStreaming)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

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
          const { messages } = get();
          const convMessages = messages.get(conversationId) ?? [];
          const lastIdx = convMessages.length - 1;
          if (lastIdx >= 0 && convMessages[lastIdx].role === "assistant") {
            const updatedMsg = {
              ...convMessages[lastIdx],
              content: convMessages[lastIdx].content + chunk,
            };
            const newMessages = [...convMessages.slice(0, lastIdx), updatedMsg];
            const newMap = new Map(messages);
            newMap.set(conversationId, newMessages);
            set({ messages: newMap });
          }
        },
        onToolCall: (toolCall: KimiPluginToolCall) => {
          const { messages } = get();
          const convMessages = messages.get(conversationId) ?? [];
          const lastIdx = convMessages.length - 1;
          if (lastIdx >= 0 && convMessages[lastIdx].role === "assistant") {
            const lastMsg = convMessages[lastIdx];
            const updatedMsg = {
              ...lastMsg,
              toolCalls: [...(lastMsg.toolCalls ?? []), toolCall],
            };
            const newMessages = [...convMessages.slice(0, lastIdx), updatedMsg];
            const newMap = new Map(messages);
            newMap.set(conversationId, newMessages);
            set({ messages: newMap });
          }
        },
        onDone: (event) => {
          const { messages } = get();
          const convMessages = messages.get(conversationId) ?? [];
          const lastIdx = convMessages.length - 1;
          if (lastIdx >= 0 && convMessages[lastIdx].role === "assistant") {
            const updatedMsg = {
              ...convMessages[lastIdx],
              content: event.content,
              toolCalls: event.toolCalls.length > 0 ? event.toolCalls : undefined,
              isStreaming: false,
            };
            const newMessages = [...convMessages.slice(0, lastIdx), updatedMsg];
            const newMap = new Map(messages);
            newMap.set(conversationId, newMessages);
            set({ messages: newMap, isStreaming: false, abortController: null });
            storage.saveMessages(conversationId, newMessages);
          }
        },
        onError: (message) => {
          const { messages } = get();
          const convMessages = messages.get(conversationId) ?? [];
          // Remove the streaming assistant message on error
          const withoutStreaming = convMessages.filter((m) => !m.isStreaming);
          const newMap = new Map(messages);
          newMap.set(conversationId, withoutStreaming);
          set({
            messages: newMap,
            isStreaming: false,
            error: message,
            abortController: null,
          });
          storage.saveMessages(conversationId, withoutStreaming);
        },
      }
    );

    set({ abortController: controller });
  },

  abortStream: (conversationId?: string) => {
    const { abortController, messages } = get();
    if (abortController) {
      abortController.abort();

      // Preserve partial content if we have a conversationId
      if (conversationId) {
        const convMessages = messages.get(conversationId) ?? [];
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
            const newMap = new Map(messages);
            newMap.set(conversationId, newMessages);
            set({ messages: newMap });
            storage.saveMessages(conversationId, newMessages);
          } else {
            // Remove empty streaming message
            const newMessages = convMessages.slice(0, lastIdx);
            const newMap = new Map(messages);
            newMap.set(conversationId, newMessages);
            set({ messages: newMap });
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
