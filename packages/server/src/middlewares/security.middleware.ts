import helmet from "helmet";
import cors from "cors";
import type { RequestHandler } from "express";

export const helmetMiddleware = helmet();

const allowedOrigins = process.env.CORS_ORIGINS?.split(",") || ["http://localhost:5173", "http://localhost:3000"];

export const corsMiddleware: RequestHandler = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});
