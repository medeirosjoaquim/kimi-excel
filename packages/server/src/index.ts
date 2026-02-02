import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { router } from "./routes/index.js";
import {
  rateLimitMiddleware,
  helmetMiddleware,
  corsMiddleware,
  errorHandlerMiddleware,
} from "./middlewares/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();
const PORT = process.env.PORT || 3001;
const log = logger.http;

// Security middlewares
app.use(helmetMiddleware);
app.use(corsMiddleware);

// Rate limiting
app.use(rateLimitMiddleware);

// Body parsing
app.use(express.json());

// HTTP request logging
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const { method, path: reqPath } = req;

  // Log request
  log.info(`${method} ${reqPath}`, { query: Object.keys(req.query).length > 0 ? req.query : undefined });

  // Log response on finish
  res.on("finish", () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const level = statusCode >= 400 ? "warn" : "debug";
    log[level](`${method} ${reqPath} ${statusCode}`, { durationMs: duration });
  });

  next();
});

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api", router);

// Error handling
app.use(errorHandlerMiddleware);

app.listen(PORT, () => {
  log.info(`Server running on http://localhost:${PORT}`);
});

export { app };
