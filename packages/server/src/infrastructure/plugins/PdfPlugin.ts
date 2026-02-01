import * as path from "node:path";
import type { ExcelPluginTool, KimiFileInfo } from "@kimi-excel/shared";
import type { KimiPlugin } from "../../domain/interfaces/KimiPlugin.js";

/**
 * PDF Plugin for Kimi (Future Implementation)
 *
 * Handles PDF documents for text extraction and analysis
 * Note: This is a stub for future implementation
 */
export class PdfPlugin implements KimiPlugin {
  readonly name = "pdf";
  readonly description =
    "A tool for reading and analyzing PDF documents, extracting text, tables, and metadata.";

  readonly supportedExtensions = [".pdf"];

  readonly supportedMimeTypes = ["application/pdf"];

  canProcess(file: KimiFileInfo): boolean {
    const ext = path.extname(file.filename).toLowerCase();
    return this.supportedExtensions.includes(ext);
  }

  getToolDefinition(): ExcelPluginTool {
    // Kimi's PDF plugin tool definition (when available)
    return {
      type: "_plugin",
      _plugin: {
        name: this.name,
        description: this.description,
        functions: [
          {
            name: "read_pdf",
            description: "Extract text content from a PDF file",
            parameters: {
              type: "object",
              properties: {
                file_id: {
                  type: "string",
                  description: "ID of the PDF file to read",
                },
                page_range: {
                  type: "string",
                  description:
                    "Page range to extract (e.g., '1-5', 'all'). Defaults to all pages.",
                },
              },
              required: ["file_id"],
            },
          },
          {
            name: "extract_tables",
            description: "Extract tables from a PDF file",
            parameters: {
              type: "object",
              properties: {
                file_id: {
                  type: "string",
                  description: "ID of the PDF file",
                },
                page_number: {
                  type: "integer",
                  description: "Specific page to extract tables from",
                },
              },
              required: ["file_id"],
            },
          },
          {
            name: "get_metadata",
            description: "Get PDF metadata (author, title, creation date, etc.)",
            parameters: {
              type: "object",
              properties: {
                file_id: {
                  type: "string",
                  description: "ID of the PDF file",
                },
              },
              required: ["file_id"],
            },
          },
        ],
      },
    };
  }

  getSystemPrompt(fileCount: number): string {
    const plural = fileCount > 1 ? "documents" : "document";
    return `You are a helpful document analysis assistant. Analyze the provided PDF ${plural} and answer questions about their content. Use the pdf plugin tools to read and extract information from the documents.`;
  }

  inferFileType(_filename: string): string {
    return "application/pdf";
  }
}
