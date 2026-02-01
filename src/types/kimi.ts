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
