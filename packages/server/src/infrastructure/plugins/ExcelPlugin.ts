import * as path from "node:path";
import type { ExcelPluginTool, KimiFileInfo } from "@kimi-excel/shared";
import type { KimiPlugin } from "../../domain/interfaces/KimiPlugin.js";

/**
 * Excel/CSV Plugin for Kimi
 *
 * Handles spreadsheet files: .xlsx, .xls, .csv, .tsv
 */
export class ExcelPlugin implements KimiPlugin {
  readonly name = "excel";
  readonly description =
    "An analysis tool for Excel and CSV files, providing file structure inspection, data statistical analysis, and pandas operation functions.";

  readonly supportedExtensions = [".xlsx", ".xls", ".csv", ".tsv"];

  readonly supportedMimeTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "text/csv",
    "text/tab-separated-values",
  ];

  canProcess(file: KimiFileInfo): boolean {
    const ext = path.extname(file.filename).toLowerCase();
    return this.supportedExtensions.includes(ext);
  }

  getToolDefinition(): ExcelPluginTool {
    return {
      type: "_plugin",
      _plugin: {
        name: this.name,
        description: this.description,
        functions: [
          {
            name: "read_file",
            description:
              "Given an Excel or CSV file, outputs basic file information including sheet names, column headers, row count, etc.",
            parameters: {
              type: "object",
              properties: {
                file_id: {
                  type: "string",
                  description: "ID of the file to read",
                },
                sheet_name: {
                  type: "string",
                  description: "Sheet name (defaults to first sheet)",
                },
              },
              required: ["file_id"],
            },
          },
          {
            name: "head",
            description: "Outputs the first N rows of data from the file",
            parameters: {
              type: "object",
              properties: {
                file_id: {
                  type: "string",
                  description: "ID of the file to analyze",
                },
                n: {
                  type: "integer",
                  description: "Number of rows to view",
                  default: 5,
                },
                sheet_name: {
                  type: "string",
                  description: "Sheet name (defaults to first sheet)",
                },
              },
              required: ["file_id"],
            },
          },
          {
            name: "tail",
            description: "Outputs the last N rows of data from the file",
            parameters: {
              type: "object",
              properties: {
                file_id: {
                  type: "string",
                  description: "ID of the file to analyze",
                },
                n: {
                  type: "integer",
                  description: "Number of rows to view",
                  default: 5,
                },
                sheet_name: {
                  type: "string",
                  description: "Sheet name (defaults to first sheet)",
                },
              },
              required: ["file_id"],
            },
          },
          {
            name: "describe",
            description:
              "Outputs statistical description of numeric columns (count, mean, std, min, max, percentiles)",
            parameters: {
              type: "object",
              properties: {
                file_id: {
                  type: "string",
                  description: "ID of the file to analyze",
                },
                sheet_name: {
                  type: "string",
                  description: "Sheet name (defaults to first sheet)",
                },
              },
              required: ["file_id"],
            },
          },
          {
            name: "groupby",
            description:
              "Groups data by specified column and performs aggregation operations",
            parameters: {
              type: "object",
              properties: {
                file_id: {
                  type: "string",
                  description: "ID of the file to analyze",
                },
                by: {
                  type: "string",
                  description: "Column name to group by",
                },
                agg: {
                  type: "object",
                  description:
                    'Aggregation configuration: {"column_name": "aggregation_function"}. Functions: sum, mean, count, min, max, std, median',
                },
                sheet_name: {
                  type: "string",
                  description: "Sheet name (defaults to first sheet)",
                },
                limit: {
                  type: "integer",
                  description: "Limit number of groups returned",
                },
              },
              required: ["file_id", "by", "agg"],
            },
          },
          {
            name: "filter",
            description: "Filters data based on conditions",
            parameters: {
              type: "object",
              properties: {
                file_id: {
                  type: "string",
                  description: "ID of the file to analyze",
                },
                conditions: {
                  type: "string",
                  description:
                    'Filter conditions in pandas query format, e.g., \'age > 30 and city == "NYC"\'',
                },
                sheet_name: {
                  type: "string",
                  description: "Sheet name (defaults to first sheet)",
                },
                limit: {
                  type: "integer",
                  description: "Limit number of rows returned",
                },
              },
              required: ["file_id", "conditions"],
            },
          },
          {
            name: "sort",
            description: "Sorts data by specified column(s)",
            parameters: {
              type: "object",
              properties: {
                file_id: {
                  type: "string",
                  description: "ID of the file to analyze",
                },
                by: {
                  type: "string",
                  description: "Column name to sort by",
                },
                ascending: {
                  type: "boolean",
                  description: "Sort in ascending order",
                  default: true,
                },
                sheet_name: {
                  type: "string",
                  description: "Sheet name (defaults to first sheet)",
                },
                limit: {
                  type: "integer",
                  description: "Limit number of rows returned",
                },
              },
              required: ["file_id", "by"],
            },
          },
          {
            name: "value_counts",
            description: "Counts unique values in a column",
            parameters: {
              type: "object",
              properties: {
                file_id: {
                  type: "string",
                  description: "ID of the file to analyze",
                },
                column: {
                  type: "string",
                  description: "Column name to count values for",
                },
                sheet_name: {
                  type: "string",
                  description: "Sheet name (defaults to first sheet)",
                },
                limit: {
                  type: "integer",
                  description: "Limit number of unique values returned",
                },
              },
              required: ["file_id", "column"],
            },
          },
        ],
      },
    };
  }

  getSystemPrompt(fileCount: number): string {
    const plural = fileCount > 1 ? "files" : "file";
    const crossRef =
      fileCount > 1
        ? " When multiple files are provided, you can cross-reference data between them."
        : "";

    // Note: File generation instructions are appended by kimi.service.ts
    return `You are a helpful data analysis assistant. Analyze the provided Excel/CSV ${plural} and answer questions about them. Use the excel plugin tools to read and analyze the data.${crossRef}`;
  }

  inferFileType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".xlsx":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".xls": "application/vnd.ms-excel",
      ".csv": "text/csv",
      ".tsv": "text/tab-separated-values",
    };
    return mimeTypes[ext] ?? "application/octet-stream";
  }
}
