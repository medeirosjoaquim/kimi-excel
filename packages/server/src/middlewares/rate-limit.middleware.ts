import rateLimit from "express-rate-limit";

export const rateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes per IP
  message: {
    error: "Too Many Requests",
    message: "You have exceeded the rate limit. Please try again later.",
    statusCode: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const uploadRateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 uploads per 15 minutes per IP
  message: {
    error: "Too Many Uploads",
    message: "You have exceeded the upload rate limit. Please try again later.",
    statusCode: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const analysisRateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 analyses per 15 minutes per IP
  message: {
    error: "Too Many Analysis Requests",
    message: "You have exceeded the analysis rate limit. Please try again later.",
    statusCode: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const exportRateLimitMiddleware = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 exports per 15 minutes per IP
  message: {
    error: "Too Many Export Requests",
    message: "You have exceeded the export rate limit. Please try again later.",
    statusCode: 429,
  },
  standardHeaders: true,
  legacyHeaders: false,
});
