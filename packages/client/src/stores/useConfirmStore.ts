import { create } from "zustand";

interface ConfirmState {
  isOpen: boolean;
  message: string;
  resolve: ((value: boolean) => void) | null;
}

interface ConfirmActions {
  confirm: (message: string) => Promise<boolean>;
  handleConfirm: () => void;
  handleCancel: () => void;
}

type ConfirmStore = ConfirmState & ConfirmActions;

export const useConfirmStore = create<ConfirmStore>((set, get) => ({
  isOpen: false,
  message: "",
  resolve: null,

  confirm: (message: string) => {
    return new Promise<boolean>((resolve) => {
      set({ isOpen: true, message, resolve });
    });
  },

  handleConfirm: () => {
    const { resolve } = get();
    if (resolve) resolve(true);
    set({ isOpen: false, message: "", resolve: null });
  },

  handleCancel: () => {
    const { resolve } = get();
    if (resolve) resolve(false);
    set({ isOpen: false, message: "", resolve: null });
  },
}));
