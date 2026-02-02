import { useEffect, useRef } from "react";
import { useConversationStore } from "../../stores/useConversationStore.js";
import { useChatStore } from "../../stores/useChatStore.js";
import logger from "../../lib/logger.js";
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
  const error = useChatStore((s) => s.error);
  const clearError = useChatStore((s) => s.clearError);

  const activeConversation = getActive();
  const prevActiveIdRef = useRef<string | null>(null);

  // Load messages on mount or when activeId changes
  useEffect(() => {
    if (activeId) {
      loadMessages(activeId);
      prevActiveIdRef.current = activeId;
    }
  }, [activeId, loadMessages]);

  // Get messages for active conversation
  const messages = activeId ? (messagesMap[activeId] ?? []) : [];
  const hasMessages = messages.length > 0;

  // Check if we just switched conversations
  const justSwitched = activeId !== prevActiveIdRef.current;

  // Log render state for debugging
  const showWelcome = !activeId || (!hasMessages && !isStreaming);
  logger.debug("ChatArea", `Rendering: activeId=${activeId}, messages=${messages.length}, hasMessages=${hasMessages}, isStreaming=${isStreaming}, showWelcome=${showWelcome}`);
  
  // Log all message IDs for debugging
  if (messages.length > 0) {
    logger.debug("ChatArea", `Message IDs: ${messages.map(m => `${m.role}:${m.id.slice(0, 8)}`).join(', ')}`);
  }

  return (
    <main 
      className="chat-area"
      role="main"
      aria-label="Chat conversation"
    >
      {/* Live region for status announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {justSwitched && activeId ? "Switched to different conversation" : ""}
        {isStreaming ? "AI is generating a response..." : ""}
        {!isStreaming && messages.length > 0 && justSwitched ? "Messages loaded" : ""}
        {error ? `Error: ${error}` : ""}
      </div>

      {/* Error banner */}
      {error && (
        <div 
          className="chat-error-banner" 
          role="alert"
          aria-live="assertive"
        >
          <span>{error}</span>
          <button 
            onClick={clearError}
            aria-label="Dismiss error message"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Debug overlay */}
      <div style={{ position: 'fixed', top: 60, right: 10, background: '#333', padding: 8, fontSize: 10, zIndex: 9999, color: '#fff', maxWidth: 400 }}>
        <div>activeId: {activeId || 'null'}</div>
        <div>messages: {messages.length}</div>
        <div>isStreaming: {String(isStreaming)}</div>
        <div>showWelcome: {String(showWelcome)}</div>
        <div>firstMsg: {messages[0]?.role || 'none'} {messages[0]?.content?.slice(0, 20) || ''}</div>
        <div>lastMsg: {messages[messages.length-1]?.role || 'none'} {messages[messages.length-1]?.content?.slice(0, 20) || ''}</div>
      </div>

      {showWelcome ? (
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
