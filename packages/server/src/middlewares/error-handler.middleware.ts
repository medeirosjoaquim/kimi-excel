import type { ErrorRequestHandler } from "express";
import type { ApiErrorResponse } from "@kimi-excel/shared";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errorHandlerMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error("Error:", err);

  if (err instanceof AppError) {
    const response: ApiErrorResponse = {
      error: err.name,
      message: err.message,
      statusCode: err.statusCode,
    };
    res.status(err.statusCode).json(response);
    return;
  }

  if (err.name === "MulterError") {
    const response: ApiErrorResponse = {
      error: "Upload Error",
      message: err.message,
      statusCode: 400,
    };
    res.status(400).json(response);
    return;
  }

  // Handle CORS errors
  if (err.message === "Not allowed by CORS") {
    const response: ApiErrorResponse = {
      error: "CORS Error",
      message: "Origin not allowed",
      statusCode: 403,
    };
    res.status(403).json(response);
    return;
  }

  // Default error
  const response: ApiErrorResponse = {
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "production" ? "An unexpected error occurred" : err.message,
    statusCode: 500,
  };
  res.status(500).json(response);
};
