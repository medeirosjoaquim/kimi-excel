import { useConversationStore } from "../../stores/useConversationStore.js";
import { useChatStore } from "../../stores/useChatStore.js";
import { WelcomeScreen } from "./WelcomeScreen.js";
import { MessageList } from "./MessageList.js";
import { ChatInput } from "./ChatInput.js";

export function ChatArea() {
  const activeId = useConversationStore((s) => s.activeId);
  const getActive = useConversationStore((s) => s.getActive);
  const loadMessages = useChatStore((s) => s.loadMessages);

  const activeConversation = getActive();
  const messages = activeId ? loadMessages(activeId) : [];

  const hasMessages = messages.length > 0;

  return (
    <main className="chat-area">
      {!activeId || !hasMessages ? (
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
