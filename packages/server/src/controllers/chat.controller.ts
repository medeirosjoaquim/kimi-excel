import type { Request, Response, NextFunction } from "express";
import type { SSEEvent } from "@kimi-excel/shared";
import { ErrorCode } from "@kimi-excel/shared";
import { getKimiService } from "../services/kimi.service.js";
import { AppError } from "../middlewares/error-handler.middleware.js";
import { logger } from "../lib/logger.js";

interface ChatRequestBody {
  conversationId: string;
  message: string;
  fileIds: string[];
  history?: { role: "user" | "assistant"; content: string }[];
  model?: string;
  usePlugin?: boolean;
}

function sendSSE(res: Response, event: SSEEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export async function chat(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const log = logger.chat;
  const requestId = `req_${Date.now()}`;

  try {
    const body = req.body as ChatRequestBody;
    log.info("Chat request received", { requestId, fileCount: body.fileIds?.length, messageLength: body.message?.length });

    if (!body.message) {
      throw AppError.badRequest("Message is required", ErrorCode.VALIDATION_ERROR);
    }

    if (!body.fileIds) {
      throw AppError.badRequest("fileIds is required", ErrorCode.VALIDATION_ERROR);
    }

    // Validate file count (max 9 files per Kimi API constraints)
    if (body.fileIds.length > 9) {
      throw AppError.badRequest(
        "Maximum 9 files can be analyzed at once",
        ErrorCode.VALIDATION_ERROR
      );
    }

    const kimiService = getKimiService();

    // Create abort controller to handle client disconnect
    const abortController = new AbortController();
    let isAborted = false;
    let chunkCount = 0;

    // Listen for client disconnect
    req.on("close", () => {
      if (!res.writableEnded) {
        log.warn("Client disconnected", { requestId, chunkCount });
        isAborted = true;
        abortController.abort();
      }
    });

    // Set up SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();
    log.debug("SSE headers sent", { requestId });

    try {
      log.info("Starting Kimi analysis", { requestId, fileIds: body.fileIds, usePlugin: body.usePlugin });
      const startTime = Date.now();

      const result = await kimiService.analyzeWithContext(
        body.fileIds,
        body.message,
        {
          model: body.model,
          stream: true,
          usePlugin: body.usePlugin,
          history: body.history,
          abortSignal: abortController.signal,
          onChunk: (chunk) => {
            if (!isAborted) {
              chunkCount++;
              if (chunkCount === 1) {
                log.debug("First chunk received", { requestId, timeToFirstChunkMs: Date.now() - startTime });
              }
              sendSSE(res, { type: "chunk", content: chunk });
            }
          },
          onToolCall: (toolCall) => {
            if (!isAborted) {
              log.debug("Tool call received", { requestId, toolName: toolCall._plugin.name });
              sendSSE(res, { type: "tool_call", toolCall });
            }
          },
        }
      );

      const duration = Date.now() - startTime;
      log.info("Kimi analysis completed", { requestId, durationMs: duration, chunkCount, contentLength: result.content.length });

      if (!isAborted) {
        sendSSE(res, {
          type: "done",
          content: result.content,
          toolCalls: result.toolCalls,
        });
      }
      res.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Chat failed";
      log.error("Kimi analysis failed", { requestId, error: message });
      if (!isAborted) {
        sendSSE(res, { type: "error", message });
      }
      res.end();
    }
  } catch (error) {
    log.error("Chat controller error", { requestId, error: error instanceof Error ? error.message : String(error) });
    next(error);
  }
}
