import { useState } from "react";
import { ConversationList } from "./ConversationList.js";
import { useConversationStore } from "../../stores/useConversationStore.js";

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const createConversation = useConversationStore((s) => s.create);

  const handleNewChat = () => {
    createConversation();
  };

  return (
    <aside className={`sidebar ${isCollapsed ? "sidebar-collapsed" : ""}`}>
      <div className="sidebar-header">
        <div className="sidebar-brand">
          {!isCollapsed && (
            <>
              <span className="brand-icon" />
              <span className="brand-text">Kimi Excel</span>
            </>
          )}
        </div>
        <button
          className="sidebar-toggle"
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? ">" : "<"}
        </button>
      </div>

      <button className="new-chat-btn" onClick={handleNewChat}>
        <span className="new-chat-icon">+</span>
        {!isCollapsed && <span>New Chat</span>}
      </button>

      {!isCollapsed && (
        <div className="sidebar-content">
          <ConversationList />
        </div>
      )}
    </aside>
  );
}
