import { useEffect } from "react";
import { useConversationStore } from "../../stores/useConversationStore.js";
import { useChatStore } from "../../stores/useChatStore.js";
import { WelcomeScreen } from "./WelcomeScreen.js";
import { MessageList } from "./MessageList.js";
import { ChatInput } from "./ChatInput.js";

export function ChatArea() {
  const activeId = useConversationStore((s) => s.activeId);
  const getActive = useConversationStore((s) => s.getActive);

  // Subscribe to the entire messages Map to trigger re-renders
  const messagesMap = useChatStore((s) => s.messages);
  const loadMessages = useChatStore((s) => s.loadMessages);
  const isStreaming = useChatStore((s) => s.isStreaming);

  const activeConversation = getActive();

  // Load messages on mount or when activeId changes
  useEffect(() => {
    if (activeId) {
      loadMessages(activeId);
    }
  }, [activeId, loadMessages]);

  // Get messages for active conversation
  const messages = activeId ? (messagesMap[activeId] ?? []) : [];
  const hasMessages = messages.length > 0;

  return (
    <main className="chat-area">
      {!activeId || (!hasMessages && !isStreaming) ? (
        <WelcomeScreen />
      ) : (
        <div className="chat-messages-container">
          <MessageList messages={messages} />
        </div>
      )}
      <ChatInput
        conversationId={activeId}
        fileIds={activeConversation?.fileIds ?? []}
      />
    </main>
  );
}
