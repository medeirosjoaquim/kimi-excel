import type { Request, Response } from "express";
import { getUsageService } from "../services/usage.service.js";
import { logger } from "../lib/logger.js";

const log = logger.usage;

export async function getBalance(_req: Request, res: Response): Promise<void> {
  try {
    log.info("Balance request received");

    const usageService = getUsageService();
    const balance = await usageService.getBalance();

    res.json({
      success: true,
      data: balance,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch balance";
    log.error("Balance request failed", { error: message });

    res.status(500).json({
      success: false,
      message,
    });
  }
}

export async function estimateTokens(req: Request, res: Response): Promise<void> {
  try {
    const { model = "kimi-k2-0905-preview", messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({
        success: false,
        message: "messages array is required",
      });
      return;
    }

    log.info("Token estimate request received", {
      model,
      messageCount: messages.length,
    });

    const usageService = getUsageService();
    const estimate = await usageService.estimateTokens(model, messages);

    res.json({
      success: true,
      data: estimate,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to estimate tokens";
    log.error("Token estimate request failed", { error: message });

    res.status(500).json({
      success: false,
      message,
    });
  }
}
