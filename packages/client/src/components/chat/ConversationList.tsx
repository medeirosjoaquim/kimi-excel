import { useConversationStore } from "../../stores/useConversationStore.js";
import { useUIStore } from "../../stores/useUIStore.js";

export function ConversationList() {
  const conversations = useConversationStore((s) => s.conversations);
  const activeId = useConversationStore((s) => s.activeId);
  const selectConversation = useConversationStore((s) => s.select);
  const deleteConversation = useConversationStore((s) => s.delete);
  const isLoading = useConversationStore((s) => s.isLoading);
  const closeSidebarOnMobile = useUIStore((s) => s.closeSidebarOnMobile);

  if (isLoading) {
    return (
      <div 
        className="conversation-list-loading"
        role="status"
        aria-live="polite"
      >
        Loading conversations...
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="conversation-list-empty" role="status">
        No conversations yet. Start a new chat!
      </div>
    );
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return "Today";
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      selectConversation(id);
      closeSidebarOnMobile();
    }
  };

  return (
    <nav className="conversation-list" aria-label="Conversation history">
      <h3 id="conversation-list-heading">Chat History</h3>
      <ul role="list" aria-labelledby="conversation-list-heading">
        {conversations.map((conv) => (
          <li
            key={conv.id}
            className={`conversation-item ${activeId === conv.id ? "selected" : ""}`}
            onClick={() => {
              selectConversation(conv.id);
              closeSidebarOnMobile();
            }}
            onKeyDown={(e) => handleKeyDown(e, conv.id)}
            role="button"
            tabIndex={0}
            aria-current={activeId === conv.id ? "true" : undefined}
            aria-label={`${conv.title}, updated ${formatDate(conv.updatedAt)}${activeId === conv.id ? ", current conversation" : ""}`}
          >
            <div className="conversation-info">
              <span className="conversation-title">{conv.title}</span>
              <span className="conversation-date">
                {formatDate(conv.updatedAt)}
              </span>
            </div>
            <button
              className="conversation-delete"
              onClick={(e) => {
                e.stopPropagation();
                deleteConversation(conv.id);
              }}
              aria-label={`Delete conversation: ${conv.title}`}
              title="Delete conversation"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
