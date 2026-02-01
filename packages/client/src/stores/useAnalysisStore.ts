import { create } from "zustand";
import type { KimiPluginToolCall } from "@kimi-excel/shared";
import { api } from "../api/client.js";

interface AnalysisState {
  content: string;
  toolCalls: KimiPluginToolCall[];
  isAnalyzing: boolean;
  error: string | null;
  abortController: { abort: () => void } | null;
}

interface AnalysisActions {
  analyze: (fileId: string, question: string, options?: { model?: string; usePlugin?: boolean }) => void;
  abort: () => void;
  clear: () => void;
}

type AnalysisStore = AnalysisState & AnalysisActions;

export const useAnalysisStore = create<AnalysisStore>((set, get) => ({
  content: "",
  toolCalls: [],
  isAnalyzing: false,
  error: null,
  abortController: null,

  analyze: (fileId: string, question: string, options = {}) => {
    // Abort any ongoing analysis
    get().abort();

    set({
      content: "",
      toolCalls: [],
      isAnalyzing: true,
      error: null,
    });

    const controller = api.analyzeFileStream(
      fileId,
      { question, ...options },
      {
        onChunk: (chunk) => {
          set((state) => ({ content: state.content + chunk }));
        },
        onToolCall: (event) => {
          set((state) => ({ toolCalls: [...state.toolCalls, event.toolCall] }));
        },
        onDone: (event) => {
          set({
            content: event.content,
            toolCalls: event.toolCalls,
            isAnalyzing: false,
            abortController: null,
          });
        },
        onError: (message) => {
          set({
            error: message,
            isAnalyzing: false,
            abortController: null,
          });
        },
      }
    );

    set({ abortController: controller });
  },

  abort: () => {
    const { abortController } = get();
    if (abortController) {
      abortController.abort();
      set({ abortController: null, isAnalyzing: false });
    }
  },

  clear: () => {
    get().abort();
    set({
      content: "",
      toolCalls: [],
      isAnalyzing: false,
      error: null,
      abortController: null,
    });
  },
}));
