import type {
  KimiMessage,
  KimiFileInfo,
  KimiUploadResponse,
  KimiPluginToolCall,
  AnalysisResult,
} from "./kimi.js";

describe("Kimi Types", () => {
  describe("KimiMessage", () => {
    it("should accept valid message objects", () => {
      const systemMessage: KimiMessage = {
        role: "system",
        content: "You are a helpful assistant.",
      };
      expect(systemMessage.role).toBe("system");

      const userMessage: KimiMessage = {
        role: "user",
        content: "Analyze this file.",
      };
      expect(userMessage.role).toBe("user");

      const assistantMessage: KimiMessage = {
        role: "assistant",
        content: "I'll analyze the file for you.",
      };
      expect(assistantMessage.role).toBe("assistant");

      const toolMessage: KimiMessage = {
        role: "tool",
        content: "Tool result",
        tool_call_id: "call_123",
      };
      expect(toolMessage.role).toBe("tool");
    });

    it("should accept message with resource name", () => {
      const resourceMessage: KimiMessage = {
        role: "system",
        content: '{"id": "file123"}',
        name: "resource:file-info",
      };
      expect(resourceMessage.name).toBe("resource:file-info");
    });
  });

  describe("KimiFileInfo", () => {
    it("should accept valid file info objects", () => {
      const fileInfo: KimiFileInfo = {
        id: "file_123",
        filename: "data.xlsx",
        file_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      };
      expect(fileInfo.id).toBe("file_123");
      expect(fileInfo.filename).toBe("data.xlsx");
    });

    it("should accept optional fields", () => {
      const fileInfo: KimiFileInfo = {
        id: "file_123",
        filename: "data.xlsx",
        file_type: "text/csv",
        bytes: 1024,
        created_at: 1704067200,
        status: "processed",
        status_details: "File processed successfully",
      };
      expect(fileInfo.bytes).toBe(1024);
      expect(fileInfo.status).toBe("processed");
    });
  });

  describe("KimiUploadResponse", () => {
    it("should accept valid upload response", () => {
      const response: KimiUploadResponse = {
        id: "file_123",
        object: "file",
        bytes: 2048,
        created_at: 1704067200,
        filename: "report.xlsx",
        purpose: "file-extract",
        status: "processed",
        status_details: "",
      };
      expect(response.id).toBe("file_123");
      expect(response.purpose).toBe("file-extract");
    });
  });

  describe("KimiPluginToolCall", () => {
    it("should accept valid tool call", () => {
      const toolCall: KimiPluginToolCall = {
        index: 0,
        id: "call_123",
        type: "_plugin",
        _plugin: {
          name: "excel.read_file",
          arguments: '{"file_id": "file_123"}',
        },
      };
      expect(toolCall.type).toBe("_plugin");
      expect(toolCall._plugin.name).toBe("excel.read_file");
    });
  });

  describe("AnalysisResult", () => {
    it("should accept valid analysis result", () => {
      const result: AnalysisResult = {
        content: "The file contains 100 rows and 5 columns.",
        toolCalls: [],
      };
      expect(result.content).toBeTruthy();
      expect(result.toolCalls).toHaveLength(0);
    });

    it("should accept result with tool calls", () => {
      const result: AnalysisResult = {
        content: "Analysis complete.",
        toolCalls: [
          {
            index: 0,
            id: "call_1",
            type: "_plugin",
            _plugin: {
              name: "excel.head",
              arguments: '{"file_id": "file_123", "n": 10}',
            },
          },
        ],
      };
      expect(result.toolCalls).toHaveLength(1);
    });
  });
});
