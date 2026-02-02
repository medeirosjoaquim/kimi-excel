import type { Request, Response } from "express";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { randomUUID } from "node:crypto";
import { logger } from "../lib/logger.js";
import { createWorkbook, addDataSheet } from "../lib/excel-builder.js";

const log = logger.files;

// Store generated files temporarily
const GENERATED_FILES_DIR = path.join(os.tmpdir(), "kimi-excel-generated");

// Ensure directory exists
if (!fs.existsSync(GENERATED_FILES_DIR)) {
  fs.mkdirSync(GENERATED_FILES_DIR, { recursive: true });
}

// In-memory store for file metadata (in production, use a database)
const fileMetadata = new Map<string, { filename: string; path: string; createdAt: number }>();

// Clean up old files periodically (files older than 1 hour)
const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes
const MAX_FILE_AGE = 60 * 60 * 1000; // 1 hour

setInterval(() => {
  const now = Date.now();
  for (const [id, meta] of fileMetadata.entries()) {
    if (now - meta.createdAt > MAX_FILE_AGE) {
      try {
        if (fs.existsSync(meta.path)) {
          fs.unlinkSync(meta.path);
        }
        fileMetadata.delete(id);
        log.debug("Cleaned up old generated file", { id, filename: meta.filename });
      } catch (error) {
        log.warn("Failed to clean up file", { id, error: String(error) });
      }
    }
  }
}, CLEANUP_INTERVAL);

export interface CreateGeneratedFileRequest {
  filename: string;
  content: string; // Base64 encoded content
  mimeType?: string;
}

export async function createGeneratedFile(req: Request, res: Response): Promise<void> {
  try {
    const { filename, content, mimeType } = req.body as CreateGeneratedFileRequest;

    if (!filename || !content) {
      res.status(400).json({
        success: false,
        message: "filename and content are required",
      });
      return;
    }

    // Validate base64 content
    let base64Data = content;

    // Handle data URI format (e.g., "data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,...")
    if (content.includes(",")) {
      base64Data = content.split(",")[1] || content;
    }

    // Remove any whitespace/newlines
    base64Data = base64Data.replace(/\s/g, "");

    // Validate it's valid base64
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(base64Data)) {
      res.status(400).json({
        success: false,
        message: "Invalid base64 content",
      });
      return;
    }

    const id = randomUUID();
    const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const filePath = path.join(GENERATED_FILES_DIR, `${id}-${safeFilename}`);

    // Decode and save the file
    const buffer = Buffer.from(base64Data, "base64");
    fs.writeFileSync(filePath, buffer);

    // Store metadata
    fileMetadata.set(id, {
      filename: safeFilename,
      path: filePath,
      createdAt: Date.now(),
    });

    log.info("Generated file created", { id, filename: safeFilename, size: buffer.length });

    res.json({
      success: true,
      data: {
        id,
        filename: safeFilename,
        downloadUrl: `/api/files/generated/${id}`,
        size: buffer.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create generated file";
    log.error("Failed to create generated file", { error: message });

    res.status(500).json({
      success: false,
      message,
    });
  }
}

export async function downloadGeneratedFile(req: Request<{ id: string }>, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const meta = fileMetadata.get(id);
    if (!meta) {
      res.status(404).json({
        success: false,
        message: "File not found or expired",
      });
      return;
    }

    if (!fs.existsSync(meta.path)) {
      fileMetadata.delete(id);
      res.status(404).json({
        success: false,
        message: "File not found",
      });
      return;
    }

    // Determine content type based on extension
    const ext = path.extname(meta.filename).toLowerCase();
    const contentTypes: Record<string, string> = {
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".xls": "application/vnd.ms-excel",
      ".csv": "text/csv",
      ".json": "application/json",
      ".txt": "text/plain",
      ".pdf": "application/pdf",
    };

    const contentType = contentTypes[ext] || "application/octet-stream";

    log.debug("Serving generated file", { id, filename: meta.filename, contentType });

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${meta.filename}"`);

    const fileStream = fs.createReadStream(meta.path);
    fileStream.pipe(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to download file";
    log.error("Failed to download generated file", { error: message });

    res.status(500).json({
      success: false,
      message,
    });
  }
}

export interface CsvToExcelRequest {
  filename: string;
  csvContent: string;
}

export async function csvToExcel(req: Request, res: Response): Promise<void> {
  try {
    const { filename, csvContent } = req.body as CsvToExcelRequest;

    if (!filename || !csvContent) {
      res.status(400).json({
        success: false,
        message: "filename and csvContent are required",
      });
      return;
    }

    // Parse CSV content
    const lines = csvContent.trim().split("\n");
    if (lines.length < 1) {
      res.status(400).json({
        success: false,
        message: "CSV content is empty",
      });
      return;
    }

    // Parse headers and data
    const headers = lines[0].split(",").map((h) => h.trim());
    const data: unknown[][] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => {
        const trimmed = v.trim();
        // Try to parse as number
        const num = Number(trimmed);
        return isNaN(num) ? trimmed : num;
      });
      data.push(values);
    }

    // Create Excel workbook
    const workbook = createWorkbook({
      title: filename,
      description: "Generated from CSV data",
    });

    const sheetName = path.basename(filename, path.extname(filename));
    addDataSheet(workbook, sheetName, data, headers);

    // Generate unique ID and save file
    const id = randomUUID();
    const safeFilename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
    const xlsxFilename = safeFilename.replace(/\.csv$/i, ".xlsx");
    const filePath = path.join(GENERATED_FILES_DIR, `${id}-${xlsxFilename}`);

    await workbook.xlsx.writeFile(filePath);

    // Store metadata
    const stats = fs.statSync(filePath);
    fileMetadata.set(id, {
      filename: xlsxFilename,
      path: filePath,
      createdAt: Date.now(),
    });

    log.info("CSV converted to Excel", { id, filename: xlsxFilename, rows: data.length });

    res.json({
      success: true,
      data: {
        id,
        filename: xlsxFilename,
        downloadUrl: `/api/files/generated/${id}`,
        size: stats.size,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to convert CSV to Excel";
    log.error("Failed to convert CSV to Excel", { error: message });

    res.status(500).json({
      success: false,
      message,
    });
  }
}
