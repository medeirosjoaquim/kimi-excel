import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  isMobile: boolean;
  debugOpen: boolean;
}

interface UIActions {
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setIsMobile: (isMobile: boolean) => void;
  closeSidebarOnMobile: () => void;
  setDebugOpen: (open: boolean) => void;
}

type UIStore = UIState & UIActions;

export const useUIStore = create<UIStore>((set, get) => ({
  sidebarOpen: true,
  isMobile: false,
  debugOpen: false,

  toggleSidebar: () => {
    set((state) => ({ sidebarOpen: !state.sidebarOpen }));
  },

  setSidebarOpen: (open: boolean) => {
    set({ sidebarOpen: open });
  },

  setIsMobile: (isMobile: boolean) => {
    set({ isMobile });
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

  setDebugOpen: (open: boolean) => {
    set({ debugOpen: open });
  },
}));
