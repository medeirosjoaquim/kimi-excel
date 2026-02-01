import type {
  UploadFileResponse,
  ListFilesResponse,
  GetFileResponse,
  DeleteFileResponse,
  AnalyzeFileRequest,
  AnalyzeFileResponse,
  SSEEvent,
  ApiErrorResponse,
  KimiPluginToolCall,
} from "@kimi-excel/shared";

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

    (async () => {
      try {
        const response = await fetch(`${API_BASE}/chat`, {
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
                    callbacks.onToolCall?.(event.toolCall);
                    break;
                  case "done":
                    callbacks.onDone?.({
                      content: event.content,
                      toolCalls: event.toolCalls,
                    });
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
};

export { ApiError };
