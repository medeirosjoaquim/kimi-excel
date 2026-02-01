import { useEffect } from "react";
import { Sidebar } from "./Sidebar.js";
import { ChatArea } from "./ChatArea.js";
import { useConversationStore } from "../../stores/useConversationStore.js";
import { useFileStore } from "../../stores/useFileStore.js";

export function ChatLayout() {
  const loadConversations = useConversationStore((s) => s.load);
  const fetchFiles = useFileStore((s) => s.fetchFiles);

  useEffect(() => {
    loadConversations();
    fetchFiles();
  }, [loadConversations, fetchFiles]);

  return (
    <div className="chat-layout">
      <Sidebar />
      <ChatArea />
    </div>
  );
}
