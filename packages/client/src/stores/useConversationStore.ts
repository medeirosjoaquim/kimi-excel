import { create } from "zustand";
import type { Conversation } from "@kimi-excel/shared";
import { storage } from "../lib/storage.js";
import logger from "../lib/logger.js";

interface ConversationState {
  conversations: Conversation[];
  activeId: string | null;
  isLoading: boolean;
}

interface ConversationActions {
  load: () => void;
  create: (fileIds?: string[]) => Conversation;
  select: (id: string | null) => void;
  rename: (id: string, title: string) => void;
  delete: (id: string) => void;
  addFile: (id: string, fileId: string) => void;
  removeFile: (id: string, fileId: string) => void;
  updateTimestamp: (id: string) => void;
  getActive: () => Conversation | null;
}

type ConversationStore = ConversationState & ConversationActions;

function generateId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function generateTitle(): string {
  return `New Chat`;
}

export const useConversationStore = create<ConversationStore>((set, get) => ({
  conversations: [],
  activeId: null,
  isLoading: true,

  load: () => {
    const conversations = storage.getConversations();
    // Sort by updatedAt descending
    conversations.sort((a, b) => b.updatedAt - a.updatedAt);
    set({ conversations, isLoading: false });
  },

  create: (fileIds = []) => {
    const now = Date.now();
    const conversation: Conversation = {
      id: generateId(),
      title: generateTitle(),
      createdAt: now,
      updatedAt: now,
      fileIds,
    };

    logger.info("ConversationStore", "Creating new conversation", {
      conversationId: conversation.id,
      fileIds,
    });

    const { conversations } = get();
    const updated = [conversation, ...conversations];
    storage.saveConversations(updated);
    set({ conversations: updated, activeId: conversation.id });

    logger.info("ConversationStore", "Conversation created and set as active", {
      conversationId: conversation.id,
    });

    return conversation;
  },

  select: (id: string | null) => {
    set({ activeId: id });
  },

  rename: (id: string, title: string) => {
    const { conversations } = get();
    const updated = conversations.map((c) =>
      c.id === id ? { ...c, title, updatedAt: Date.now() } : c
    );
    storage.saveConversations(updated);
    set({ conversations: updated });
  },

  delete: (id: string) => {
    storage.deleteConversation(id);
    const { conversations, activeId } = get();
    const updated = conversations.filter((c) => c.id !== id);
    set({
      conversations: updated,
      activeId: activeId === id ? null : activeId,
    });
  },

  addFile: (id: string, fileId: string) => {
    const { conversations } = get();
    const updated = conversations.map((c) => {
      if (c.id === id && !c.fileIds.includes(fileId)) {
        return {
          ...c,
          fileIds: [...c.fileIds, fileId],
          updatedAt: Date.now(),
        };
      }
      return c;
    });
    storage.saveConversations(updated);
    set({ conversations: updated });
  },

  removeFile: (id: string, fileId: string) => {
    const { conversations } = get();
    const updated = conversations.map((c) => {
      if (c.id === id) {
        return {
          ...c,
          fileIds: c.fileIds.filter((fid) => fid !== fileId),
          updatedAt: Date.now(),
        };
      }
      return c;
    });
    storage.saveConversations(updated);
    set({ conversations: updated });
  },

  updateTimestamp: (id: string) => {
    const { conversations } = get();
    const updated = conversations.map((c) =>
      c.id === id ? { ...c, updatedAt: Date.now() } : c
    );
    // Re-sort after updating timestamp
    updated.sort((a, b) => b.updatedAt - a.updatedAt);
    storage.saveConversations(updated);
    set({ conversations: updated });
  },

  getActive: () => {
    const { conversations, activeId } = get();
    return conversations.find((c) => c.id === activeId) ?? null;
  },
}));
