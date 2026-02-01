// ==========================================
// Kimi API Types (from original implementation)
// ==========================================

export interface KimiPluginToolCall {
  index: number;
  id: string;
  type: "_plugin";
  _plugin: {
    arguments: string;
    name: string;
  };
}

export interface KimiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  name?: string;
  tool_calls?: KimiPluginToolCall[];
  tool_call_id?: string;
}

export interface ExcelPluginFunction {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, {
      type: string;
      description: string;
      default?: unknown;
    }>;
    required: string[];
  };
}

export interface ExcelPluginTool {
  type: "_plugin";
  _plugin: {
    name: string;
    description: string;
    functions: ExcelPluginFunction[];
  };
}

export interface KimiFileInfo {
  id: string;
  filename: string;
  file_type: string;
  bytes?: number;
  created_at?: number;
  status?: string;
  status_details?: string;
}

export interface KimiUploadResponse {
  id: string;
  object: string;
  bytes: number;
  created_at: number;
  filename: string;
  purpose: string;
  status: string;
  status_details: string;
}

export interface AnalysisResult {
  content: string;
  toolCalls: KimiPluginToolCall[];
}

// ==========================================
// API Request/Response Types
// ==========================================

// Files API
export interface UploadFileRequest {
  // File is sent as multipart/form-data
}

export interface UploadFileResponse {
  id: string;
  filename: string;
  bytes: number;
  status: string;
  createdAt: number;
}

export interface ListFilesResponse {
  files: FileListItem[];
}

export interface FileListItem {
  id: string;
  filename: string;
  status: string;
  createdAt?: number;
  bytes?: number;
}

export interface GetFileResponse {
  id: string;
  filename: string;
  fileType: string;
  bytes?: number;
  createdAt?: number;
  status?: string;
  statusDetails?: string;
}

export interface DeleteFileResponse {
  success: boolean;
  id: string;
}

// Analysis API
export interface AnalyzeFileRequest {
  question: string;
  model?: string;
  usePlugin?: boolean;
}

export interface AnalyzeFileResponse {
  content: string;
  toolCalls: KimiPluginToolCall[];
}

// SSE Event Types for streaming analysis
export type SSEEventType = "chunk" | "tool_call" | "done" | "error";

export interface SSEChunkEvent {
  type: "chunk";
  content: string;
}

export interface SSEToolCallEvent {
  type: "tool_call";
  toolCall: KimiPluginToolCall;
}

export interface SSEDoneEvent {
  type: "done";
  content: string;
  toolCalls: KimiPluginToolCall[];
}

export interface SSEErrorEvent {
  type: "error";
  message: string;
}

export type SSEEvent = SSEChunkEvent | SSEToolCallEvent | SSEDoneEvent | SSEErrorEvent;

// Error Response
export interface ApiErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}
