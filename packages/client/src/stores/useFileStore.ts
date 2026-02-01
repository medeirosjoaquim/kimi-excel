import { create } from "zustand";
import type { FileListItem } from "@kimi-excel/shared";
import { api } from "../api/client.js";

interface FileState {
  files: FileListItem[];
  selectedFileId: string | null;
  isLoading: boolean;
  isUploading: boolean;
  error: string | null;
}

interface FileActions {
  fetchFiles: () => Promise<void>;
  uploadFile: (file: File) => Promise<string>;
  deleteFile: (id: string) => Promise<void>;
  selectFile: (id: string | null) => void;
  clearError: () => void;
}

type FileStore = FileState & FileActions;

export const useFileStore = create<FileStore>((set, get) => ({
  files: [],
  selectedFileId: null,
  isLoading: false,
  isUploading: false,
  error: null,

  fetchFiles: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.listFiles();
      set({ files: response.files, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch files";
      set({ error: message, isLoading: false });
    }
  },

  uploadFile: async (file: File) => {
    set({ isUploading: true, error: null });
    try {
      const response = await api.uploadFile(file);
      await get().fetchFiles();
      set({ isUploading: false, selectedFileId: response.id });
      return response.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload file";
      set({ error: message, isUploading: false });
      throw error;
    }
  },

  deleteFile: async (id: string) => {
    set({ error: null });
    try {
      await api.deleteFile(id);
      const { selectedFileId } = get();
      if (selectedFileId === id) {
        set({ selectedFileId: null });
      }
      await get().fetchFiles();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete file";
      set({ error: message });
      throw error;
    }
  },

  selectFile: (id: string | null) => {
    set({ selectedFileId: id });
  },

  clearError: () => {
    set({ error: null });
  },
}));
