import { useConversationStore } from "../../stores/useConversationStore.js";

export function ConversationList() {
  const conversations = useConversationStore((s) => s.conversations);
  const activeId = useConversationStore((s) => s.activeId);
  const selectConversation = useConversationStore((s) => s.select);
  const deleteConversation = useConversationStore((s) => s.delete);
  const isLoading = useConversationStore((s) => s.isLoading);

  if (isLoading) {
    return <div className="conversation-list-loading">Loading...</div>;
  }

  if (conversations.length === 0) {
    return (
      <div className="conversation-list-empty">
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

  return (
    <div className="conversation-list">
      <h3>Chat History</h3>
      <ul>
        {conversations.map((conv) => (
          <li
            key={conv.id}
            className={`conversation-item ${activeId === conv.id ? "selected" : ""}`}
            onClick={() => selectConversation(conv.id)}
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
              title="Delete conversation"
            >
              x
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
