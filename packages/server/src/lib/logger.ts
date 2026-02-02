type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

const COLORS = {
  debug: "\x1b[36m", // cyan
  info: "\x1b[32m",  // green
  warn: "\x1b[33m",  // yellow
  error: "\x1b[31m", // red
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private context: string;
  private minLevel: LogLevel;

  constructor(context: string, minLevel: LogLevel = "debug") {
    this.context = context;
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || minLevel;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private formatTime(): string {
    return new Date().toISOString();
  }

  private formatContext(ctx?: LogContext): string {
    if (!ctx || Object.keys(ctx).length === 0) return "";
    return ` ${COLORS.dim}${JSON.stringify(ctx)}${COLORS.reset}`;
  }

  private log(level: LogLevel, message: string, ctx?: LogContext): void {
    if (!this.shouldLog(level)) return;

    const color = COLORS[level];
    const levelStr = level.toUpperCase().padEnd(5);
    const time = this.formatTime();
    const contextStr = this.formatContext(ctx);

    console.log(
      `${COLORS.dim}${time}${COLORS.reset} ${color}${levelStr}${COLORS.reset} ${COLORS.bold}[${this.context}]${COLORS.reset} ${message}${contextStr}`
    );
  }

  debug(message: string, ctx?: LogContext): void {
    this.log("debug", message, ctx);
  }

  info(message: string, ctx?: LogContext): void {
    this.log("info", message, ctx);
  }

  warn(message: string, ctx?: LogContext): void {
    this.log("warn", message, ctx);
  }

  error(message: string, ctx?: LogContext): void {
    this.log("error", message, ctx);
  }

  /**
   * Create a child logger with a sub-context
   */
  child(subContext: string): Logger {
    return new Logger(`${this.context}:${subContext}`, this.minLevel);
  }

  /**
   * Time an async operation
   */
  async time<T>(label: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    this.debug(`${label} started`);
    try {
      const result = await fn();
      const duration = (performance.now() - start).toFixed(2);
      this.debug(`${label} completed`, { durationMs: duration });
      return result;
    } catch (error) {
      const duration = (performance.now() - start).toFixed(2);
      this.error(`${label} failed`, {
        durationMs: duration,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }
}

/**
 * Create a logger for a specific module/context
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}

// Pre-configured loggers for common modules
export const logger = {
  kimi: createLogger("Kimi"),
  chat: createLogger("Chat"),
  files: createLogger("Files"),
  http: createLogger("HTTP"),
  plugin: createLogger("Plugin"),
  usage: createLogger("Usage"),
};
