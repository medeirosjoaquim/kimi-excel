import { create } from "zustand";
import { api, type BalanceInfo } from "../api/client.js";
import logger from "../lib/logger.js";

interface UsageState {
  balance: BalanceInfo | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
}

interface UsageActions {
  fetchBalance: () => Promise<void>;
  clearError: () => void;
}

type UsageStore = UsageState & UsageActions;

// Cache balance for 60 seconds
const CACHE_DURATION = 60 * 1000;

export const useUsageStore = create<UsageStore>((set, get) => ({
  balance: null,
  isLoading: false,
  error: null,
  lastFetched: null,

  fetchBalance: async () => {
    const { lastFetched, isLoading } = get();

    // Skip if already loading
    if (isLoading) {
      logger.debug("UsageStore", "Balance fetch already in progress, skipping");
      return;
    }

    // Skip if cached data is still fresh
    if (lastFetched && Date.now() - lastFetched < CACHE_DURATION) {
      logger.debug("UsageStore", "Using cached balance data");
      return;
    }

    set({ isLoading: true, error: null });

    try {
      logger.info("UsageStore", "Fetching balance...");
      const balance = await api.getBalance();
      logger.debug("UsageStore", `Balance fetched: ${balance.available_balance}`);

      set({
        balance,
        isLoading: false,
        lastFetched: Date.now(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to fetch balance";
      logger.error("UsageStore", `Error fetching balance: ${message}`);

      set({
        error: message,
        isLoading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
