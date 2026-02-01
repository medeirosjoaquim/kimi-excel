import { useUIStore } from "../../stores/useUIStore.js";

export function MobileHeader() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);

  return (
    <header className="mobile-header">
      <button
        className="mobile-menu-btn"
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? "Close menu" : "Open menu"}
      >
        <span className="hamburger-icon">
          <span />
          <span />
          <span />
        </span>
      </button>
      <div className="mobile-header-brand">
        <span className="brand-icon" />
        <span className="brand-text">Kimi Excel</span>
      </div>
      <div className="mobile-header-spacer" />
    </header>
  );
}
