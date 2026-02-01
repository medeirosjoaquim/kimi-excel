import type { Request, Response, NextFunction } from "express";
import type { UploadFileResponse, ListFilesResponse, GetFileResponse, DeleteFileResponse } from "@kimi-excel/shared";
import type { FileUploadRequest } from "../types/index.js";
import { getKimiService } from "../services/kimi.service.js";
import { AppError } from "../middlewares/error-handler.middleware.js";
import * as fs from "node:fs";

export async function uploadFile(req: FileUploadRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) {
      throw new AppError(400, "No file uploaded");
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
      throw new AppError(400, "File ID is required");
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
      throw new AppError(400, "File ID is required");
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
