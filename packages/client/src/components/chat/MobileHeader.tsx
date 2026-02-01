import { useUIStore } from "../../stores/useUIStore.js";

export function MobileHeader() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);

  return (
    <header className="mobile-header" role="banner">
      <button
        className="mobile-menu-btn"
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={sidebarOpen}
        aria-controls="sidebar"
        aria-haspopup="true"
      >
        <span className="hamburger-icon" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </button>
      <div className="mobile-header-brand">
        <span className="brand-icon" aria-hidden="true" />
        <span className="brand-text">Kimi Excel</span>
      </div>
      <div className="mobile-header-spacer" aria-hidden="true" />
    </header>
  );
}
