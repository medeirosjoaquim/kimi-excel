import type { Conversation, ChatMessage } from "@kimi-excel/shared";

const KEYS = {
  CONVERSATIONS: "kimi-conversations",
  MESSAGES_PREFIX: "kimi-messages-",
} as const;

export const storage = {
  getConversations(): Conversation[] {
    try {
      const data = localStorage.getItem(KEYS.CONVERSATIONS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveConversations(conversations: Conversation[]): void {
    try {
      localStorage.setItem(KEYS.CONVERSATIONS, JSON.stringify(conversations));
    } catch (error) {
      console.error("Failed to save conversations:", error);
    }
  },

  getMessages(conversationId: string): ChatMessage[] {
    try {
      const data = localStorage.getItem(KEYS.MESSAGES_PREFIX + conversationId);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  saveMessages(conversationId: string, messages: ChatMessage[]): void {
    try {
      localStorage.setItem(
        KEYS.MESSAGES_PREFIX + conversationId,
        JSON.stringify(messages)
      );
    } catch (error) {
      console.error("Failed to save messages:", error);
    }
  },

  deleteConversation(conversationId: string): void {
    try {
      // Remove messages for this conversation
      localStorage.removeItem(KEYS.MESSAGES_PREFIX + conversationId);

      // Remove conversation from list
      const conversations = this.getConversations();
      const filtered = conversations.filter((c) => c.id !== conversationId);
      this.saveConversations(filtered);
    } catch (error) {
      console.error("Failed to delete conversation:", error);
    }
  },

  clearAll(): void {
    try {
      const conversations = this.getConversations();
      for (const conv of conversations) {
        localStorage.removeItem(KEYS.MESSAGES_PREFIX + conv.id);
      }
      localStorage.removeItem(KEYS.CONVERSATIONS);
    } catch (error) {
      console.error("Failed to clear storage:", error);
    }
  },
};
