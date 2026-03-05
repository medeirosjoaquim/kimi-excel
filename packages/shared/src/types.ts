// ==========================================
// Error Codes
// ==========================================

export enum ErrorCode {
  // Configuration errors (1xx)
  API_KEY_MISSING = "API_KEY_MISSING",
  API_KEY_INVALID = "API_KEY_INVALID",
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR",

  // Authentication/Authorization errors (4xx)
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",

  // Client errors
  BAD_REQUEST = "BAD_REQUEST",
  NOT_FOUND = "NOT_FOUND",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  FILE_NOT_FOUND = "FILE_NOT_FOUND",
  FILE_UPLOAD_ERROR = "FILE_UPLOAD_ERROR",

  // External service errors
  KIMI_API_ERROR = "KIMI_API_ERROR",
  KIMI_RATE_LIMITED = "KIMI_RATE_LIMITED",
  KIMI_SERVICE_UNAVAILABLE = "KIMI_SERVICE_UNAVAILABLE",

  // Server errors
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
}

// ==========================================
// Moonshot API Types
// ==========================================

/**
 * File purposes supported by Moonshot Kimi API.
 *
 * Kimi accepts the following file purposes:
 * - `file-extract`: For data files (Excel, CSV, etc.) to be analyzed and extracted
 * - `image`: For image files to enable vision/image analysis capabilities
 * - `video`: For video files (if supported)
 * - `batch`: For batch processing operations
 * - `batch_output`: For batch processing output files
 * - `lambda`: For Lambda function operations
 *
 * @see https://platform.moonshot.ai/docs/guide/file-upload
 */
export type MoonshotFilePurpose = "file-extract" | "image" | "video" | "batch" | "batch_output" | "lambda";

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

export interface KimiMessageContentImage {
  type: "image_url";
  image_url: {
    url: string; // base64 data URL or ms://file_id
  };
}

export interface KimiMessageContentText {
  type: "text";
  text: string;
}

export type KimiMessageContent = KimiMessageContentText | KimiMessageContentImage;

export interface KimiMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | KimiMessageContent[];
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
  isExpired?: boolean;
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

export interface DuplicateGroup {
  originalName: string;
  files: FileListItem[];
}

export interface FindDuplicatesResponse {
  duplicates: DuplicateGroup[];
  totalDuplicateFiles: number;
}

export interface DeduplicateFilesResponse {
  deleted: string[];
  kept: string[];
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
  code: ErrorCode;
  message: string;
  statusCode: number;
}

// ==========================================
// Chat Types
// ==========================================

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  fileIds: string[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
  toolCalls?: KimiPluginToolCall[];
  createdAt: number;
  isStreaming?: boolean;
}

export type AttachmentType = "spreadsheet" | "image";

export interface ChatAttachment {
  fileId: string;
  filename: string;
  type?: AttachmentType;
}

// Chat API Request/Response Types
export interface ChatRequest {
  conversationId: string;
  message: string;
  fileIds: string[];
  model?: string;
  usePlugin?: boolean;
}

export interface ChatResponse {
  content: string;
  toolCalls: KimiPluginToolCall[];
}
