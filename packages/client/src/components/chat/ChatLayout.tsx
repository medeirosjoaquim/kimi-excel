import { useEffect, useRef } from "react";
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
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadConversations();
    fetchFiles();
  }, [loadConversations, fetchFiles]);

  const handleBackdropClick = () => {
    setSidebarOpen(false);
  };

  // Focus main content on initial load for screen readers
  useEffect(() => {
    // Set focus to main content after a short delay
    const timer = setTimeout(() => {
      const mainElement = document.querySelector('main');
      if (mainElement) {
        mainElement.tabIndex = -1;
        mainElement.focus({ preventScroll: true });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div 
      ref={mainRef}
      className="chat-layout"
      role="application"
      aria-label="Kimi Excel Analyzer"
    >
      {/* Skip to main content link for keyboard users */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Screen reader announcements for app state */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isMobile && sidebarOpen ? "Sidebar opened" : ""}
        {isMobile && !sidebarOpen ? "Sidebar closed" : ""}
      </div>

      {isMobile && <MobileHeader />}
      <Sidebar />
      {isMobile && sidebarOpen && (
        <div 
          className="sidebar-backdrop" 
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}
      <ChatArea />
      <ConfirmDialog />
    </div>
  );
}
