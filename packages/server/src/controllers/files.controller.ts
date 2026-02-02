import type { Request, Response, NextFunction } from "express";
import type {
  UploadFileResponse,
  ListFilesResponse,
  GetFileResponse,
  DeleteFileResponse,
  FindDuplicatesResponse,
  DeduplicateFilesResponse,
  DuplicateGroup,
  FileListItem,
} from "@kimi-excel/shared";
import { ErrorCode } from "@kimi-excel/shared";
import type { FileUploadRequest } from "../types/index.js";
import { getKimiService } from "../services/kimi.service.js";
import { AppError } from "../middlewares/error-handler.middleware.js";
import * as fs from "node:fs";

// Extract original filename from server-generated name
// Pattern: "timestamp-randomId-originalname.ext" -> "originalname.ext"
function getOriginalName(filename: string): string {
  const match = filename.match(/^\d+-\d+-(.+)$/);
  return match ? match[1] : filename;
}

export async function uploadFile(req: FileUploadRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      throw AppError.badRequest("No file uploaded", ErrorCode.FILE_UPLOAD_ERROR);
    }

    const kimiService = getKimiService();
    const result = await kimiService.uploadFile(req.file.path);

    // Clean up the temporary file
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    const response: UploadFileResponse = {
      id: result.id,
      filename: result.filename,
      bytes: result.bytes,
      status: result.status,
      createdAt: result.created_at,
    };

    res.status(201).json(response);
  } catch (error) {
    // Clean up temp file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
}

export async function listFiles(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const kimiService = getKimiService();
    const files = await kimiService.listFiles();

    const response: ListFilesResponse = {
      files: files.map((f) => ({
        id: f.id,
        filename: f.filename,
        status: f.status ?? "unknown",
        createdAt: f.created_at,
        bytes: f.bytes,
      })),
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function getFile(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      throw AppError.badRequest("File ID is required", ErrorCode.VALIDATION_ERROR);
    }

    const kimiService = getKimiService();
    const fileInfo = await kimiService.getFileInfo(id);

    const response: GetFileResponse = {
      id: fileInfo.id,
      filename: fileInfo.filename,
      fileType: fileInfo.file_type,
      bytes: fileInfo.bytes,
      createdAt: fileInfo.created_at,
      status: fileInfo.status,
      statusDetails: fileInfo.status_details,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function deleteFile(req: Request<{ id: string }>, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      throw AppError.badRequest("File ID is required", ErrorCode.VALIDATION_ERROR);
    }

    const kimiService = getKimiService();
    await kimiService.deleteFile(id);

    const response: DeleteFileResponse = {
      success: true,
      id,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function findDuplicates(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const kimiService = getKimiService();
    const files = await kimiService.listFiles();

    // Group files by original name
    const groups = new Map<string, FileListItem[]>();

    for (const f of files) {
      const originalName = getOriginalName(f.filename);
      const fileItem: FileListItem = {
        id: f.id,
        filename: f.filename,
        status: f.status ?? "unknown",
        createdAt: f.created_at,
        bytes: f.bytes,
      };

      const existing = groups.get(originalName);
      if (existing) {
        existing.push(fileItem);
      } else {
        groups.set(originalName, [fileItem]);
      }
    }

    // Filter to only groups with more than one file (duplicates)
    const duplicates: DuplicateGroup[] = [];
    let totalDuplicateFiles = 0;

    for (const [originalName, fileList] of groups) {
      if (fileList.length > 1) {
        // Sort by createdAt descending (newest first)
        fileList.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        duplicates.push({ originalName, files: fileList });
        totalDuplicateFiles += fileList.length - 1; // Count extra copies
      }
    }

    const response: FindDuplicatesResponse = {
      duplicates,
      totalDuplicateFiles,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function deduplicateFiles(
  req: Request<object, object, { keep?: "newest" | "oldest" }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { keep = "newest" } = req.body;
    const kimiService = getKimiService();
    const files = await kimiService.listFiles();

    // Group files by original name
    const groups = new Map<string, { id: string; createdAt: number }[]>();

    for (const f of files) {
      const originalName = getOriginalName(f.filename);
      const item = { id: f.id, createdAt: f.created_at ?? 0 };

      const existing = groups.get(originalName);
      if (existing) {
        existing.push(item);
      } else {
        groups.set(originalName, [item]);
      }
    }

    const deleted: string[] = [];
    const kept: string[] = [];

    // Process each group with duplicates
    for (const [, fileList] of groups) {
      if (fileList.length > 1) {
        // Sort by createdAt
        fileList.sort((a, b) => a.createdAt - b.createdAt);

        // Determine which to keep
        const toKeep = keep === "newest" ? fileList[fileList.length - 1] : fileList[0];
        kept.push(toKeep.id);

        // Delete the rest
        for (const file of fileList) {
          if (file.id !== toKeep.id) {
            await kimiService.deleteFile(file.id);
            deleted.push(file.id);
          }
        }
      }
    }

    const response: DeduplicateFilesResponse = {
      deleted,
      kept,
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
}
