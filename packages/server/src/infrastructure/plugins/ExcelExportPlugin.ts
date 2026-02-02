import type { UtilityPluginTool, ChatMessage, KimiPluginToolCall } from "@kimi-excel/shared";
import type { KimiUtilityPlugin } from "../../domain/interfaces/KimiUtilityPlugin.js";
import { getExcelExportService } from "../../services/excel-export.service.js";
import { createLogger } from "../../lib/logger.js";

const log = createLogger("ExcelExportPlugin");

/**
 * Excel Export Plugin for Kimi
 *
 * Provides Excel (.xlsx) file generation capabilities from chat conversations,
 * analysis results, file data, and custom data arrays.
 */
export class ExcelExportPlugin implements KimiUtilityPlugin {
  readonly name = "excel_export";
  readonly description =
    "A utility tool for exporting data to Excel (.xlsx) files. " +
    "Can export chat conversations, analysis results, file data, and custom data arrays.";

  readonly autoInclude = true;

  /**
   * Check if this plugin can handle the given function name
   */
  canHandle(functionName: string): boolean {
    const functions = [
      "export_conversation",
      "export_analysis_result",
      "export_file_data",
      "export_to_excel",
    ];

    // Strip plugin prefix if present (e.g., "excel_export.export_to_excel" -> "export_to_excel")
    const baseName = functionName.includes(".")
      ? functionName.split(".").pop() ?? functionName
      : functionName;

    return functions.includes(baseName);
  }

  /**
   * Execute a function from this plugin
   */
  async execute(functionName: string, args: Record<string, unknown>): Promise<string> {
    // Strip plugin prefix if present
    const baseName = functionName.includes(".")
      ? functionName.split(".").pop() ?? functionName
      : functionName;

    log.debug("Executing Excel export function", { functionName: baseName, args });

    const exportService = getExcelExportService();

    try {
      switch (baseName) {
        case "export_conversation": {
          const conversationId = args.conversation_id as string;
          const messages = args.messages as ChatMessage[] | undefined;

          if (!conversationId) {
            return JSON.stringify({
              success: false,
              error: "conversation_id is required",
            });
          }

          if (!messages || messages.length === 0) {
            return JSON.stringify({
              success: false,
              error: "No messages to export. The conversation appears to be empty.",
            });
          }

          const filePath = await exportService.exportConversation(conversationId, messages);

          return JSON.stringify({
            success: true,
            message: `Conversation exported successfully with ${messages.length} messages`,
            filePath,
            downloadUrl: `/api/export/conversation/${conversationId}`,
            filename: `conversation-${conversationId}-${Date.now()}.xlsx`,
          });
        }

        case "export_analysis_result": {
          const fileId = args.file_id as string;
          const toolCallData = args.tool_call_data as KimiPluginToolCall | undefined;

          if (!fileId) {
            return JSON.stringify({
              success: false,
              error: "file_id is required",
            });
          }

          if (!toolCallData) {
            return JSON.stringify({
              success: false,
              error: "tool_call_data is required",
            });
          }

          const filePath = await exportService.exportAnalysisResult(fileId, toolCallData);

          return JSON.stringify({
            success: true,
            message: "Analysis result exported successfully",
            filePath,
            downloadUrl: `/api/export/analysis`,
            filename: `analysis-${fileId}-${Date.now()}.xlsx`,
          });
        }

        case "export_file_data": {
          const fileId = args.file_id as string;
          const sheetName = args.sheet_name as string | undefined;

          if (!fileId) {
            return JSON.stringify({
              success: false,
              error: "file_id is required",
            });
          }

          const filePath = await exportService.exportRawFile(fileId, sheetName);

          return JSON.stringify({
            success: true,
            message: "File data exported successfully",
            filePath,
            downloadUrl: `/api/export/file/${fileId}`,
            filename: `file-${fileId}-${Date.now()}.xlsx`,
          });
        }

        case "export_to_excel": {
          const data = args.data as unknown[][] | undefined;
          const headers = args.headers as string[] | undefined;
          const filename = args.filename as string | undefined;

          if (!data || !Array.isArray(data)) {
            return JSON.stringify({
              success: false,
              error: "data must be a 2D array",
            });
          }

          if (data.length === 0) {
            return JSON.stringify({
              success: false,
              error: "data array is empty",
            });
          }

          const filePath = await exportService.exportCustomData(data, headers, filename);

          return JSON.stringify({
            success: true,
            message: `Custom data exported successfully with ${data.length} rows`,
            filePath,
            downloadUrl: `/api/export/custom`,
            filename: `${filename || "export"}-${Date.now()}.xlsx`,
          });
        }

        default:
          return JSON.stringify({
            success: false,
            error: `Unknown function: ${baseName}`,
          });
      }
    } catch (error) {
      log.error("Error executing Excel export function", {
        functionName: baseName,
        error: error instanceof Error ? error.message : String(error),
      });

      return JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  }

  getToolDefinition(): UtilityPluginTool {
    return {
      type: "_plugin",
      _plugin: {
        name: this.name,
        description: this.description,
        functions: [
          {
            name: "export_conversation",
            description:
              "Export the current chat conversation to an Excel file. " +
              "Creates a spreadsheet with columns for timestamp, role, content, and tool calls. " +
              'Use this when the user asks to "export", "download", or "save the conversation to Excel".',
            parameters: {
              type: "object",
              properties: {
                conversation_id: {
                  type: "string",
                  description: "The unique identifier for this conversation",
                },
                messages: {
                  type: "array",
                  description:
                    "Array of chat messages to export. Each message should have role, content, and createdAt properties.",
                },
              },
              required: ["conversation_id", "messages"],
            },
          },
          {
            name: "export_analysis_result",
            description:
              "Export the result of a data analysis or tool call to an Excel file. " +
              "Creates a spreadsheet with the tool call details and results. " +
              'Use this when the user asks to "export the analysis" or "save the results to Excel".',
            parameters: {
              type: "object",
              properties: {
                file_id: {
                  type: "string",
                  description: "The ID of the file that was analyzed",
                },
                tool_call_data: {
                  type: "object",
                  description:
                    "The complete tool call object containing id, function name, arguments, and results",
                },
              },
              required: ["file_id", "tool_call_data"],
            },
          },
          {
            name: "export_file_data",
            description:
              "Export the raw data from a file in Kimi storage to an Excel file. " +
              "Creates a spreadsheet with the file's data in tabular format. " +
              'Use this when the user asks to "export the file to Excel" or "download the file data".',
            parameters: {
              type: "object",
              properties: {
                file_id: {
                  type: "string",
                  description: "The ID of the file to export",
                },
                sheet_name: {
                  type: "string",
                  description:
                    "Optional name for the Excel sheet. If not provided, uses the filename.",
                },
              },
              required: ["file_id"],
            },
          },
          {
            name: "export_to_excel",
            description:
              "Export any custom data array to an Excel file. " +
              "Takes a 2D array of data and creates a formatted spreadsheet. " +
              'Use this for exporting filtered, aggregated, or transformed data. ' +
              'Example: When the user asks "export the top 10 results" or "save this filtered data".',
            parameters: {
              type: "object",
              properties: {
                data: {
                  type: "array",
                  description:
                    "2D array of data to export. Each inner array represents a row. " +
                    'Example: [["Name", "Age"], ["Alice", 30], ["Bob", 25]]',
                },
                headers: {
                  type: "array",
                  description:
                    "Optional array of column headers. If not provided, the first row of data is used as headers.",
                },
                filename: {
                  type: "string",
                  description:
                    "Optional base filename for the export (without extension). " +
                    'Example: "sales_report" will create "sales_report-{timestamp}.xlsx"',
                },
              },
              required: ["data"],
            },
          },
        ],
      },
    };
  }

  getSystemPromptAddition(): string {
    return (
      "You have access to an Excel export utility that can create downloadable .xlsx files from various data sources. " +
      "When the user asks to 'export', 'download', 'save to Excel', or 'save as xlsx', use the excel_export plugin tools. " +
      "\n\n" +
      "Available export functions:\n" +
      "- export_conversation: Export the current chat conversation with all messages\n" +
      "- export_analysis_result: Export the results of a data analysis or tool call\n" +
      "- export_file_data: Export the raw data from an uploaded file\n" +
      "- export_to_excel: Export any custom data array (filtered, aggregated, or transformed data)\n" +
      "\n" +
      "After exporting, inform the user that the Excel file has been generated and provide details about what was exported. " +
      "Note: The actual file download will be handled by the frontend application."
    );
  }
}
