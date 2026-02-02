import type {
  UploadFileResponse,
  ListFilesResponse,
  GetFileResponse,
  DeleteFileResponse,
  FindDuplicatesResponse,
  DeduplicateFilesResponse,
  AnalyzeFileRequest,
  AnalyzeFileResponse,
  SSEEvent,
  ApiErrorResponse,
  KimiPluginToolCall,
} from "@kimi-excel/shared";
import logger from "../lib/logger.js";

const API_BASE = "/api";

class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = (await response.json()) as ApiErrorResponse;
    throw new ApiError(response.status, errorData.message);
  }
  return response.json() as Promise<T>;
}

interface ChatStreamRequest {
  conversationId: string;
  message: string;
  fileIds: string[];
  history?: { role: "user" | "assistant"; content: string }[];
  model?: string;
  usePlugin?: boolean;
  userTimezone?: string; // User's IANA timezone (auto-detected if not provided)
}

/**
 * Detect the user's timezone from the browser
 * Returns IANA timezone identifier (e.g., "America/New_York")
 */
function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}

interface ChatStreamCallbacks {
  onChunk?: (content: string) => void;
  onToolCall?: (toolCall: KimiPluginToolCall) => void;
  onDone?: (event: { content: string; toolCalls: KimiPluginToolCall[] }) => void;
  onError?: (message: string) => void;
}

export const api = {
  async uploadFile(file: File): Promise<UploadFileResponse> {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${API_BASE}/files`, {
      method: "POST",
      body: formData,
    });

    return handleResponse<UploadFileResponse>(response);
  },

  async listFiles(): Promise<ListFilesResponse> {
    const response = await fetch(`${API_BASE}/files`);
    return handleResponse<ListFilesResponse>(response);
  },

  async getFile(id: string): Promise<GetFileResponse> {
    const response = await fetch(`${API_BASE}/files/${id}`);
    return handleResponse<GetFileResponse>(response);
  },

  async deleteFile(id: string): Promise<DeleteFileResponse> {
    const response = await fetch(`${API_BASE}/files/${id}`, {
      method: "DELETE",
    });
    return handleResponse<DeleteFileResponse>(response);
  },

  async findDuplicates(): Promise<FindDuplicatesResponse> {
    const response = await fetch(`${API_BASE}/files/duplicates`);
    return handleResponse<FindDuplicatesResponse>(response);
  },

  async deduplicateFiles(keep: "newest" | "oldest" = "newest"): Promise<DeduplicateFilesResponse> {
    const response = await fetch(`${API_BASE}/files/duplicates`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ keep }),
    });
    return handleResponse<DeduplicateFilesResponse>(response);
  },

  async analyzeFile(id: string, request: AnalyzeFileRequest): Promise<AnalyzeFileResponse> {
    const response = await fetch(`${API_BASE}/files/${id}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    return handleResponse<AnalyzeFileResponse>(response);
  },

  analyzeFileStream(
    id: string,
    request: AnalyzeFileRequest,
    callbacks: {
      onChunk?: (content: string) => void;
      onToolCall?: (toolCall: SSEEvent & { type: "tool_call" }) => void;
      onDone?: (event: SSEEvent & { type: "done" }) => void;
      onError?: (message: string) => void;
    }
  ): { abort: () => void } {
    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(`${API_BASE}/files/${id}/analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify(request),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorData = (await response.json()) as ApiErrorResponse;
          callbacks.onError?.(errorData.message);
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          callbacks.onError?.("No response body");
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event = JSON.parse(line.slice(6)) as SSEEvent;
                switch (event.type) {
                  case "chunk":
                    callbacks.onChunk?.(event.content);
                    break;
                  case "tool_call":
                    callbacks.onToolCall?.(event);
                    break;
                  case "done":
                    callbacks.onDone?.(event);
                    break;
                  case "error":
                    callbacks.onError?.(event.message);
                    break;
                }
              } catch {
                // Ignore parse errors
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name !== "AbortError") {
          callbacks.onError?.(error.message);
        }
      }
    })();

    return {
      abort: () => controller.abort(),
    };
  },

  chatStream(
    request: ChatStreamRequest,
    callbacks: ChatStreamCallbacks
  ): { abort: () => void } {
    const controller = new AbortController();

    logger.info("API", `chatStream called for conversation ${request.conversationId}`);

    // Auto-detect timezone if not provided
    const requestWithTimezone = {
      ...request,
      userTimezone: request.userTimezone || getUserTimezone(),
    };

    (async () => {
      try {
        logger.debug("API", `Starting chat stream fetch to ${API_BASE}/chat (timezone: ${requestWithTimezone.userTimezone})`);

        const response = await fetch(`${API_BASE}/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
          },
          body: JSON.stringify(requestWithTimezone),
          signal: controller.signal,
        });

        logger.info("API", `Chat stream response: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          try {
            const errorData = (await response.json()) as ApiErrorResponse;
            logger.error("API", `Chat stream error: ${errorData.message}`);
            callbacks.onError?.(errorData.message);
          } catch (e) {
            logger.error("API", `Chat stream HTTP error: ${response.status}`);
            callbacks.onError?.(`HTTP ${response.status}`);
          }
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          logger.error("API", "No response body for chat stream");
          callbacks.onError?.("No response body");
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let fullContent = "";
        const allToolCalls: KimiPluginToolCall[] = [];
        let isDoneReceived = false;

        logger.debug("API", "Starting to read chat stream");

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            logger.debug("API", `Chat stream complete. Content length: ${fullContent.length}, done event: ${isDoneReceived}`);
            
            // If we didn't receive an explicit 'done' event, simulate one
            if (!isDoneReceived && fullContent.length > 0) {
              logger.info("API", "Stream ended without done event, calling onDone");
              callbacks.onDone?.({
                content: fullContent,
                toolCalls: allToolCalls,
              });
            }
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          buffer += chunk;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event = JSON.parse(line.slice(6)) as SSEEvent;
                logger.debug("API", `SSE event: ${event.type}`);
                
                switch (event.type) {
                  case "chunk":
                    fullContent += event.content;
                    callbacks.onChunk?.(event.content);
                    break;
                  case "tool_call":
                    allToolCalls.push(event.toolCall);
                    callbacks.onToolCall?.(event.toolCall);
                    break;
                  case "done":
                    isDoneReceived = true;
                    callbacks.onDone?.({
                      content: event.content || fullContent,
                      toolCalls: event.toolCalls?.length ? event.toolCalls : allToolCalls,
                    });
                    break;
                  case "error":
                    logger.warn("API", `SSE error: ${event.message}`);
                    callbacks.onError?.(event.message);
                    break;
                }
              } catch (e) {
                logger.warn("API", `Failed to parse SSE: ${e instanceof Error ? e.message : String(e)}`);
              }
            }
          }
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        const isAbort = error instanceof Error && error.name === "AbortError";

        if (!isAbort) {
          logger.error("API", `Chat stream error: ${errorMsg}`);
          callbacks.onError?.(errorMsg);
        } else {
          logger.debug("API", "Chat stream aborted");
        }
      }
    })();

    return {
      abort: () => {
        logger.debug("API", "Chat stream abort requested");
        controller.abort();
      },
    };
  },
};

export { ApiError };
