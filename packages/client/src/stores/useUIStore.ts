import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  isMobile: boolean;
}

interface UIActions {
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setIsMobile: (isMobile: boolean) => void;
  closeSidebarOnMobile: () => void;
}

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>((set, get) => ({
  sidebarOpen: true, // Open by default on desktop
  isMobile: false,

  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },

  setSidebarOpen: (open: boolean) => {
    set({ sidebarOpen: open });
  },

  setIsMobile: (isMobile: boolean) => {
    set({ isMobile });
    // Auto-close sidebar when switching to mobile
    if (isMobile) {
      set({ sidebarOpen: false });
    }
  },

  closeSidebarOnMobile: () => {
    const { isMobile } = get();
    if (isMobile) {
      set({ sidebarOpen: false });
    }
  },
}));
