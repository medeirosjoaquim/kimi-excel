import { useEffect } from "react";
import { ConversationList } from "./ConversationList.js";
import { useConversationStore } from "../../stores/useConversationStore.js";
import { useUIStore } from "../../stores/useUIStore.js";

export function Sidebar() {
  const createConversation = useConversationStore((s) => s.create);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const isMobile = useUIStore((s) => s.isMobile);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);
  const setIsMobile = useUIStore((s) => s.setIsMobile);

  // Handle responsive detection
  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 768px)");

    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
    };

    // Initial check
    handleChange(mediaQuery);

    // Listen for changes
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [setIsMobile]);

  const handleNewChat = () => {
    createConversation();
    // Close sidebar on mobile after creating new chat
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  // Build class names based on state
  // On desktop: always rendered, sidebarOpen controls collapsed/expanded
  // On mobile: sidebarOpen controls visible/hidden as overlay
  const classNames = [
    "sidebar",
    isMobile ? "sidebar-mobile" : "sidebar-desktop",
    sidebarOpen ? "sidebar-open" : "sidebar-closed",
  ].join(" ");

  return (
    <aside 
      className={classNames}
      aria-label="Chat sidebar"
      aria-expanded={sidebarOpen}
      role="complementary"
    >
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <span className="brand-icon" aria-hidden="true" />
          <span className="brand-text">Kimi Excel</span>
        </div>
        {!isMobile && (
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-expanded={sidebarOpen}
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {sidebarOpen ? "<" : ">"}
          </button>
        )}
        {isMobile && (
          <button
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            ×
          </button>
        )}
      </div>

      <button 
        className="new-chat-btn" 
        onClick={handleNewChat}
        aria-label="Start a new chat"
      >
        <span className="new-chat-icon" aria-hidden="true">+</span>
        <span>New Chat</span>
      </button>

      <div className="sidebar-content">
        <ConversationList />
      </div>
    </aside>
  );
}
