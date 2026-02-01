import type { ErrorRequestHandler } from "express";
import { type ApiErrorResponse, ErrorCode } from "@kimi-excel/shared";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code: ErrorCode = ErrorCode.INTERNAL_ERROR
  ) {
    super(message);
    this.name = "AppError";
  }

  static badRequest(message: string, code: ErrorCode = ErrorCode.BAD_REQUEST): AppError {
    return new AppError(400, message, code);
  }

  static notFound(message: string): AppError {
    return new AppError(404, message, ErrorCode.NOT_FOUND);
  }

  static unauthorized(message: string, code: ErrorCode = ErrorCode.UNAUTHORIZED): AppError {
    return new AppError(401, message, code);
  }

  static serviceUnavailable(message: string, code: ErrorCode = ErrorCode.SERVICE_UNAVAILABLE): AppError {
    return new AppError(503, message, code);
  }
}

function isOpenAIError(err: unknown): err is { status: number; error?: { type?: string; message?: string } } {
  return typeof err === "object" && err !== null && "status" in err;
}

export const errorHandlerMiddleware: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error("Error:", err);

  if (err instanceof AppError) {
    const response: ApiErrorResponse = {
      error: err.name,
      code: err.code,
      message: err.message,
      statusCode: err.statusCode,
    };
    res.status(err.statusCode).json(response);
    return;
  }

  if (err.name === "MulterError") {
    const response: ApiErrorResponse = {
      error: "Upload Error",
      code: ErrorCode.FILE_UPLOAD_ERROR,
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
      code: ErrorCode.FORBIDDEN,
      message: "Origin not allowed",
      statusCode: 403,
    };
    res.status(403).json(response);
    return;
  }

  // Handle OpenAI/Kimi API errors
  if (isOpenAIError(err)) {
    const status = err.status;
    const errorType = err.error?.type;
    const errorMessage = err.error?.message ?? "External API error";

    if (status === 401 || errorType === "incorrect_api_key_error") {
      const response: ApiErrorResponse = {
        error: "Authentication Error",
        code: ErrorCode.API_KEY_INVALID,
        message: "Invalid API key. Please check your MOONSHOT_API_KEY configuration.",
        statusCode: 401,
      };
      res.status(401).json(response);
      return;
    }

    if (status === 429) {
      const response: ApiErrorResponse = {
        error: "Rate Limited",
        code: ErrorCode.KIMI_RATE_LIMITED,
        message: "API rate limit exceeded. Please try again later.",
        statusCode: 429,
      };
      res.status(429).json(response);
      return;
    }

    if (status >= 500) {
      const response: ApiErrorResponse = {
        error: "External Service Error",
        code: ErrorCode.KIMI_SERVICE_UNAVAILABLE,
        message: "Kimi API is temporarily unavailable. Please try again later.",
        statusCode: 503,
      };
      res.status(503).json(response);
      return;
    }

    const response: ApiErrorResponse = {
      error: "API Error",
      code: ErrorCode.KIMI_API_ERROR,
      message: errorMessage,
      statusCode: status >= 400 && status < 600 ? status : 500,
    };
    res.status(response.statusCode).json(response);
    return;
  }

  // Handle API key missing error from KimiService
  if (err.message?.includes("MOONSHOT_API_KEY")) {
    const response: ApiErrorResponse = {
      error: "Configuration Error",
      code: ErrorCode.API_KEY_MISSING,
      message: "API key not configured. Please set MOONSHOT_API_KEY in your environment.",
      statusCode: 503,
    };
    res.status(503).json(response);
    return;
  }

  // Default error
  const response: ApiErrorResponse = {
    error: "Internal Server Error",
    code: ErrorCode.INTERNAL_ERROR,
    message: process.env.NODE_ENV === "production" ? "An unexpected error occurred" : err.message,
    statusCode: 500,
  };
  res.status(500).json(response);
};
