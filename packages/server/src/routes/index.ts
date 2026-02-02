import { Router, type Router as RouterType } from "express";
import multer from "multer";
import * as path from "node:path";
import * as os from "node:os";
import { uploadFile, listFiles, getFile, deleteFile, findDuplicates, deduplicateFiles } from "../controllers/files.controller.js";
import { analyzeFile } from "../controllers/analysis.controller.js";
import { chat } from "../controllers/chat.controller.js";
import { getBalance, estimateTokens } from "../controllers/usage.controller.js";
import {
  exportConversation,
  exportAnalysisResult,
  exportRawFile,
  exportCustomData,
  downloadExport
} from "../controllers/export.controller.js";
import { uploadRateLimitMiddleware, analysisRateLimitMiddleware, exportRateLimitMiddleware } from "../middlewares/rate-limit.middleware.js";

const router: RouterType = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, os.tmpdir());
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = [".xlsx", ".xls", ".csv", ".tsv"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed types: ${allowedExtensions.join(", ")}`));
    }
  },
});

// Files routes
router.post("/files", uploadRateLimitMiddleware, upload.single("file"), uploadFile);
router.get("/files", listFiles);
router.get("/files/duplicates", findDuplicates);
router.delete("/files/duplicates", deduplicateFiles);
router.get("/files/:id", getFile);
router.delete("/files/:id", deleteFile);

// Analysis route
router.post("/files/:id/analyze", analysisRateLimitMiddleware, analyzeFile);

// Chat route (multi-file context)
router.post("/chat", analysisRateLimitMiddleware, chat);

// Usage routes
router.get("/usage/balance", getBalance);
router.post("/usage/estimate-tokens", estimateTokens);

// Export routes
router.get("/export/download/:exportId", downloadExport);
router.post("/export/conversation/:conversationId", exportRateLimitMiddleware, exportConversation);
router.post("/export/analysis", exportRateLimitMiddleware, exportAnalysisResult);
router.post("/export/file/:fileId", exportRateLimitMiddleware, exportRawFile);
router.post("/export/custom", exportRateLimitMiddleware, exportCustomData);

export { router };
