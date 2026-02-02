import type { Request, Response, NextFunction } from "express";
import * as fs from "node:fs";
import type {
  ExportConversationRequest,
  ExportAnalysisRequest,
  ExportRawFileRequest,
  ExportCustomDataRequest,
} from "@kimi-excel/shared";
import { ErrorCode } from "@kimi-excel/shared";
import { getExcelExportService } from "../services/excel-export.service.js";
import { AppError } from "../middlewares/error-handler.middleware.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("ExportController");

/**
 * POST /api/export/conversation/:conversationId
 * Export conversation messages to Excel
 */
export async function exportConversation(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const conversationId = req.params.conversationId as string;
    const body = req.body as ExportConversationRequest;

    log.info("Export conversation request", { conversationId });

    if (!conversationId || typeof conversationId !== "string") {
      throw AppError.badRequest("Conversation ID is required", ErrorCode.VALIDATION_ERROR);
    }

    // In a real implementation, fetch messages from a database
    // For now, expect messages to be passed in the request body
    const messages = (body as { messages?: unknown[] }).messages || [];

    if (!Array.isArray(messages)) {
      throw AppError.badRequest("Messages must be an array", ErrorCode.VALIDATION_ERROR);
    }

    const exportService = getExcelExportService();
    const filePath = await exportService.exportConversation(
      conversationId,
      messages as never
    );

    const filename = `conversation-${conversationId}-${Date.now()}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on("end", () => {
      exportService.cleanupTempFile(filePath);
    });

    fileStream.on("error", (error) => {
      log.error("Error streaming file", { filePath, error });
      exportService.cleanupTempFile(filePath);
      next(error);
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/export/analysis
 * Export analysis result to Excel
 */
export async function exportAnalysisResult(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as ExportAnalysisRequest;

    log.info("Export analysis request", { fileId: body.fileId, toolCallId: body.toolCallId });

    if (!body.fileId || !body.toolCallId) {
      throw AppError.badRequest(
        "fileId and toolCallId are required",
        ErrorCode.VALIDATION_ERROR
      );
    }

    // In a real implementation, fetch the tool call from a database
    // For now, expect the full tool call data in the request
    const toolCallData = (body as { toolCallData?: unknown }).toolCallData;

    if (!toolCallData) {
      throw AppError.badRequest("toolCallData is required", ErrorCode.VALIDATION_ERROR);
    }

    const exportService = getExcelExportService();
    const filePath = await exportService.exportAnalysisResult(
      body.fileId,
      toolCallData as never
    );

    const filename = `analysis-${body.fileId}-${Date.now()}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on("end", () => {
      exportService.cleanupTempFile(filePath);
    });

    fileStream.on("error", (error) => {
      log.error("Error streaming file", { filePath, error });
      exportService.cleanupTempFile(filePath);
      next(error);
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/export/file/:fileId
 * Export raw file data to Excel
 */
export async function exportRawFile(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const fileId = req.params.fileId as string;
    const body = req.body as ExportRawFileRequest;

    log.info("Export raw file request", { fileId, sheetName: body.sheetName });

    if (!fileId || typeof fileId !== "string") {
      throw AppError.badRequest("File ID is required", ErrorCode.VALIDATION_ERROR);
    }

    const exportService = getExcelExportService();
    const filePath = await exportService.exportRawFile(
      fileId,
      body.sheetName,
      body.range
    );

    const filename = `file-${fileId}-${Date.now()}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on("end", () => {
      exportService.cleanupTempFile(filePath);
    });

    fileStream.on("error", (error) => {
      log.error("Error streaming file", { filePath, error });
      exportService.cleanupTempFile(filePath);
      next(error);
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/export/custom
 * Export custom data array to Excel
 */
export async function exportCustomData(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = req.body as ExportCustomDataRequest;

    log.info("Export custom data request", { rowCount: body.data?.length });

    if (!body.data || !Array.isArray(body.data)) {
      throw AppError.badRequest("data must be an array", ErrorCode.VALIDATION_ERROR);
    }

    const exportService = getExcelExportService();
    const filePath = await exportService.exportCustomData(
      body.data,
      body.headers,
      body.filename
    );

    const filename = body.filename
      ? `${body.filename}-${Date.now()}.xlsx`
      : `export-${Date.now()}.xlsx`;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on("end", () => {
      exportService.cleanupTempFile(filePath);
    });

    fileStream.on("error", (error) => {
      log.error("Error streaming file", { filePath, error });
      exportService.cleanupTempFile(filePath);
      next(error);
    });
  } catch (error) {
    next(error);
  }
}
