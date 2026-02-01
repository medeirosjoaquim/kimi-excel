import type { Request, Response, NextFunction } from "express";
import type { AnalyzeFileRequest, AnalyzeFileResponse, SSEEvent } from "@kimi-excel/shared";
import { getKimiService } from "../services/kimi.service.js";
import { AppError } from "../middlewares/error-handler.middleware.js";

function sendSSE(res: Response, event: SSEEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export async function analyzeFile(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const body = req.body as AnalyzeFileRequest;

    if (!id) {
      throw new AppError(400, "File ID is required");
    }

    if (!body.question) {
      throw new AppError(400, "Question is required");
    }

    const kimiService = getKimiService();

    // Check if client wants streaming
    const wantsStream = req.headers.accept === "text/event-stream";

    if (wantsStream) {
      // Set up SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      try {
        const result = await kimiService.analyzeFile(id, body.question, {
          model: body.model,
          stream: true,
          usePlugin: body.usePlugin,
          onChunk: (chunk) => {
            sendSSE(res, { type: "chunk", content: chunk });
          },
          onToolCall: (toolCall) => {
            sendSSE(res, { type: "tool_call", toolCall });
          },
        });

        sendSSE(res, {
          type: "done",
          content: result.content,
          toolCalls: result.toolCalls,
        });
        res.end();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Analysis failed";
        sendSSE(res, { type: "error", message });
        res.end();
      }
    } else {
      // Non-streaming response
      const result = await kimiService.analyzeFile(id, body.question, {
        model: body.model,
        stream: false,
        usePlugin: body.usePlugin,
      });

      const response: AnalyzeFileResponse = {
        content: result.content,
        toolCalls: result.toolCalls,
      };

      res.json(response);
    }
  } catch (error) {
    next(error);
  }
}
