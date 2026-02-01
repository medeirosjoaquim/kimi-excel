import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
import express, { type Express } from "express";
import { router } from "./routes/index.js";
import {
  rateLimitMiddleware,
  helmetMiddleware,
  corsMiddleware,
  errorHandlerMiddleware,
} from "./middlewares/index.js";

const app: Express = express();
const PORT = process.env.PORT || 3001;

// Security middlewares
app.use(helmetMiddleware);
app.use(corsMiddleware);

// Rate limiting
app.use(rateLimitMiddleware);

// Body parsing
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API routes
app.use("/api", router);

// Error handling
app.use(errorHandlerMiddleware);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export { app };
