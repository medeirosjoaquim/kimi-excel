import { logger } from "../lib/logger.js";

const KIMI_BASE_URL = "https://api.moonshot.ai/v1";
const log = logger.usage;

export interface BalanceInfo {
  available_balance: number;
  voucher_balance: number;
  cash_balance: number;
}

export interface TokenEstimate {
  total_tokens: number;
}

export class UsageService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async getBalance(): Promise<BalanceInfo> {
    try {
      log.debug("Fetching account balance");

      const response = await fetch(`${KIMI_BASE_URL}/users/me/balance`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        log.error("Failed to fetch balance", {
          status: response.status,
          error: errorText,
        });
        throw new Error(`Failed to fetch balance: ${response.status}`);
      }

      const data = await response.json();
      log.debug("Balance fetched successfully", { balance: data });

      return {
        available_balance: data.data?.available_balance ?? 0,
        voucher_balance: data.data?.voucher_balance ?? 0,
        cash_balance: data.data?.cash_balance ?? 0,
      };
    } catch (error) {
      log.error("Error fetching balance", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async estimateTokens(
    model: string,
    messages: { role: string; content: string }[]
  ): Promise<TokenEstimate> {
    try {
      log.debug("Estimating token count", { model, messageCount: messages.length });

      const response = await fetch(`${KIMI_BASE_URL}/tokenizers/estimate-token-count`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        log.error("Failed to estimate tokens", {
          status: response.status,
          error: errorText,
        });
        throw new Error(`Failed to estimate tokens: ${response.status}`);
      }

      const data = await response.json();
      log.debug("Token estimate received", { totalTokens: data.data?.total_tokens });

      return {
        total_tokens: data.data?.total_tokens ?? 0,
      };
    } catch (error) {
      log.error("Error estimating tokens", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }
}

let usageServiceInstance: UsageService | null = null;

export function getUsageService(): UsageService {
  if (!usageServiceInstance) {
    const apiKey = process.env.MOONSHOT_API_KEY;
    if (!apiKey) {
      throw new Error("MOONSHOT_API_KEY environment variable is required");
    }
    usageServiceInstance = new UsageService(apiKey);
  }
  return usageServiceInstance;
}
