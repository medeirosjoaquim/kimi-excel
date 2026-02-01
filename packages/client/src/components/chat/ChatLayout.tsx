import { useEffect } from "react";
import { Sidebar } from "./Sidebar.js";
import { ChatArea } from "./ChatArea.js";
import { MobileHeader } from "./MobileHeader.js";
import { ConfirmDialog } from "../ConfirmDialog.js";
import { useConversationStore } from "../../stores/useConversationStore.js";
import { useFileStore } from "../../stores/useFileStore.js";
import { useUIStore } from "../../stores/useUIStore.js";

export function ChatLayout() {
  const loadConversations = useConversationStore((s) => s.load);
  const fetchFiles = useFileStore((s) => s.fetchFiles);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const isMobile = useUIStore((s) => s.isMobile);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  useEffect(() => {
    loadConversations();
    fetchFiles();
  }, [loadConversations, fetchFiles]);

  const handleBackdropClick = () => {
    setSidebarOpen(false);
  };

  return (
    <div className="chat-layout">
      {isMobile && <MobileHeader />}
      <Sidebar />
      {isMobile && sidebarOpen && (
        <div className="sidebar-backdrop" onClick={handleBackdropClick} />
      )}
      <ChatArea />
      <ConfirmDialog />
    </div>
  );
}
