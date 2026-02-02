import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { ChatMessage, KimiPluginToolCall } from "@kimi-excel/shared";
import { createWorkbook, addDataSheet, addMetadataSheet } from "../lib/excel-builder.js";
import { getKimiService } from "./kimi.service.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("ExcelExport");

// In-memory cache for exported files (exportId -> { filePath, filename, createdAt })
const exportCache = new Map<string, { filePath: string; filename: string; createdAt: number }>();

// Cleanup old exports after 1 hour
const EXPORT_TTL_MS = 60 * 60 * 1000;

function cleanupOldExports(): void {
  const now = Date.now();
  for (const [exportId, entry] of exportCache.entries()) {
    if (now - entry.createdAt > EXPORT_TTL_MS) {
      fs.unlink(entry.filePath).catch(() => {});
      exportCache.delete(exportId);
      log.debug("Cleaned up old export", { exportId });
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupOldExports, 10 * 60 * 1000);

export class ExcelExportService {
  /**
   * Register an export and return the export ID
   */
  registerExport(filePath: string, filename: string): string {
    const exportId = randomUUID();
    exportCache.set(exportId, {
      filePath,
      filename,
      createdAt: Date.now(),
    });
    log.debug("Export registered", { exportId, filename });
    return exportId;
  }

  /**
   * Get export info by ID
   */
  getExport(exportId: string): { filePath: string; filename: string } | null {
    const entry = exportCache.get(exportId);
    if (!entry) {
      return null;
    }
    return { filePath: entry.filePath, filename: entry.filename };
  }

  /**
   * Export conversation messages to Excel
   */
  async exportConversation(
    conversationId: string,
    messages: ChatMessage[]
  ): Promise<string> {
    log.debug("Exporting conversation", { conversationId, messageCount: messages.length });

    const workbook = createWorkbook({
      title: `Conversation Export - ${conversationId}`,
      subject: "Chat Conversation",
      description: `Exported conversation ${conversationId} with ${messages.length} messages`,
    });

    // Prepare data rows
    const headers = ["Timestamp", "Role", "Content", "Tool Calls"];
    const data: unknown[][] = [];

    for (const message of messages) {
      const timestamp = new Date(message.createdAt).toLocaleString();
      const role = message.role;
      const content = message.content;
      const toolCalls = message.toolCalls
        ? JSON.stringify(message.toolCalls, null, 2)
        : "";

      data.push([timestamp, role, content, toolCalls]);
    }

    // Add conversation sheet
    addDataSheet(workbook, "Conversation", data, headers);

    // Add metadata sheet
    addMetadataSheet(workbook, {
      "Conversation ID": conversationId,
      "Total Messages": messages.length,
      "Exported At": new Date().toISOString(),
      "Exported By": "Kimi Excel",
    });

    // Save to temp file
    const filename = `export-conversation-${conversationId}-${Date.now()}.xlsx`;
    const filePath = path.join(os.tmpdir(), filename);

    await workbook.xlsx.writeFile(filePath);
    log.info("Conversation exported", { conversationId, filePath });

    return filePath;
  }

  /**
   * Export analysis result from tool call
   */
  async exportAnalysisResult(
    fileId: string,
    toolCallData: KimiPluginToolCall
  ): Promise<string> {
    log.debug("Exporting analysis result", { fileId, toolCallId: toolCallData.id });

    const workbook = createWorkbook({
      title: `Analysis Export - ${fileId}`,
      subject: "Data Analysis Result",
      description: `Analysis result for file ${fileId}`,
    });

    // Parse tool call arguments and results
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(toolCallData._plugin.arguments || "{}");
    } catch (error) {
      log.warn("Failed to parse tool call arguments", { error });
    }

    // Create analysis sheet with tool call details
    const headers = ["Property", "Value"];
    const data: unknown[][] = [
      ["Tool Call ID", toolCallData.id],
      ["Function Name", toolCallData._plugin.name],
      ["Arguments", JSON.stringify(args, null, 2)],
    ];

    addDataSheet(workbook, "Analysis Details", data, headers);

    // Add metadata
    addMetadataSheet(workbook, {
      "File ID": fileId,
      "Tool Call ID": toolCallData.id,
      "Function": toolCallData._plugin.name,
      "Exported At": new Date().toISOString(),
    });

    // Save to temp file
    const filename = `export-analysis-${fileId}-${Date.now()}.xlsx`;
    const filePath = path.join(os.tmpdir(), filename);

    await workbook.xlsx.writeFile(filePath);
    log.info("Analysis result exported", { fileId, filePath });

    return filePath;
  }

  /**
   * Export raw file data from Kimi storage
   */
  async exportRawFile(
    fileId: string,
    sheetName?: string,
    range?: string
  ): Promise<string> {
    log.debug("Exporting raw file", { fileId, sheetName, range });

    const kimiService = getKimiService();

    // Fetch file info and content
    const fileInfo = await kimiService.getFileInfo(fileId);
    const fileContent = await kimiService.getFileContent(fileId);

    const workbook = createWorkbook({
      title: `File Export - ${fileInfo.filename}`,
      subject: "Raw File Data",
      description: `Exported file ${fileInfo.filename}`,
    });

    // Parse file content (assume CSV-like format)
    const lines = fileContent.trim().split("\n");
    const data: unknown[][] = [];

    for (const line of lines) {
      // Simple CSV parsing (for more complex cases, use a CSV parser)
      const cells = line.split(",").map((cell) => cell.trim());
      data.push(cells);
    }

    // Extract headers from first row
    const headers = data.length > 0 ? (data[0] as string[]) : undefined;
    const dataRows = headers ? data.slice(1) : data;

    // Add data sheet
    const sheetNameToUse = sheetName || fileInfo.filename;
    addDataSheet(workbook, sheetNameToUse, dataRows, headers);

    // Add metadata
    addMetadataSheet(workbook, {
      "File ID": fileId,
      "Filename": fileInfo.filename,
      "File Type": fileInfo.file_type,
      "Total Rows": dataRows.length,
      "Exported At": new Date().toISOString(),
    });

    // Save to temp file
    const filename = `export-file-${fileId}-${Date.now()}.xlsx`;
    const filePath = path.join(os.tmpdir(), filename);

    await workbook.xlsx.writeFile(filePath);
    log.info("Raw file exported", { fileId, filePath });

    return filePath;
  }

  /**
   * Export custom data array
   */
  async exportCustomData(
    data: unknown[][],
    headers?: string[],
    filename?: string
  ): Promise<string> {
    log.debug("Exporting custom data", { rowCount: data.length, hasHeaders: !!headers });

    const workbook = createWorkbook({
      title: filename || "Custom Data Export",
      subject: "Custom Data",
      description: "Exported custom data array",
    });

    // Add data sheet
    addDataSheet(workbook, "Data", data, headers);

    // Add metadata
    addMetadataSheet(workbook, {
      "Total Rows": data.length,
      "Total Columns": data[0]?.length || 0,
      "Exported At": new Date().toISOString(),
    });

    // Save to temp file
    const fileBaseName = filename || "export-custom";
    const tempFilename = `${fileBaseName}-${Date.now()}.xlsx`;
    const filePath = path.join(os.tmpdir(), tempFilename);

    await workbook.xlsx.writeFile(filePath);
    log.info("Custom data exported", { filePath });

    return filePath;
  }

  /**
   * Cleanup temp file
   */
  async cleanupTempFile(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
      log.debug("Temp file cleaned up", { filePath });
    } catch (error) {
      log.warn("Failed to cleanup temp file", { filePath, error });
    }
  }
}

// Singleton instance
let exportServiceInstance: ExcelExportService | null = null;

export function getExcelExportService(): ExcelExportService {
  if (!exportServiceInstance) {
    exportServiceInstance = new ExcelExportService();
  }
  return exportServiceInstance;
}
