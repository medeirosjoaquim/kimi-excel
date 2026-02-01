/**
 * Session-aware logging system with pluggable storage providers
 * Default: IndexedDB storage with session grouping
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  id?: number;
  sessionId: string;
  timestamp: number;
  level: LogLevel;
  context: string;
  message: string;
  data?: Record<string, any>;
  stack?: string;
}

export interface LogSession {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  logCount: number;
  metadata?: Record<string, any>;
}

export interface StorageProvider {
  readonly name: string;
  isReady(): boolean;
  init(): Promise<void>;
  close(): Promise<void>;
  
  // Session operations
  createSession(session: LogSession): Promise<void>;
  endSession(sessionId: string, endTime: number): Promise<void>;
  getSessions(limit?: number): Promise<LogSession[]>;
  getSession(sessionId: string): Promise<LogSession | null>;
  deleteSession(sessionId: string): Promise<void>;
  clearAllSessions(): Promise<void>;
  
  // Log operations
  saveLog(entry: LogEntry): Promise<void>;
  getLogs(options?: {
    sessionId?: string;
    level?: LogLevel;
    startTime?: number;
    endTime?: number;
    limit?: number;
  }): Promise<LogEntry[]>;
  clearLogs(sessionId?: string): Promise<void>;
  
  // Stats
  getLogCount(sessionId?: string): Promise<number>;
}

// IndexedDB Storage Provider Implementation
export class IndexedDBStorageProvider implements StorageProvider {
  readonly name = "IndexedDB";
  private db: IDBDatabase | null = null;
  private readonly dbName: string;
  private readonly version: number;
  private initialized = false;

  constructor(dbName = "kimi_logs_v2", version = 1) {
    this.dbName = dbName;
    this.version = version;
  }

  isReady(): boolean {
    return this.initialized && this.db !== null;
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(this.dbName, this.version);

        request.onerror = () => {
          console.warn("[Logger] Failed to open IndexedDB:", request.error);
          reject(request.error);
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          const oldVersion = event.oldVersion;

          // Create sessions store
          if (!db.objectStoreNames.contains("sessions")) {
            const sessionStore = db.createObjectStore("sessions", { keyPath: "id" });
            sessionStore.createIndex("startTime", "startTime", { unique: false });
            sessionStore.createIndex("endTime", "endTime", { unique: false });
          }

          // Create logs store
          if (!db.objectStoreNames.contains("logs")) {
            const logStore = db.createObjectStore("logs", { keyPath: "id", autoIncrement: true });
            logStore.createIndex("sessionId", "sessionId", { unique: false });
            logStore.createIndex("timestamp", "timestamp", { unique: false });
            logStore.createIndex("level", "level", { unique: false });
            // Compound index for efficient session + time queries
            logStore.createIndex("sessionTime", ["sessionId", "timestamp"], { unique: false });
          }
        };

        request.onsuccess = () => {
          this.db = request.result;
          this.initialized = true;
          
          // Handle connection errors
          this.db.onerror = (event) => {
            console.warn("[Logger] IndexedDB error:", event);
          };
          
          this.db.onclose = () => {
            this.initialized = false;
            this.db = null;
          };

          resolve();
        };
      } catch (err) {
        console.warn("[Logger] IndexedDB initialization failed:", err);
        reject(err);
      }
    });
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }

  // Session operations
  async createSession(session: LogSession): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["sessions"], "readwrite");
      const store = transaction.objectStore("sessions");
      const request = store.put(session);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async endSession(sessionId: string, endTime: number): Promise<void> {
    if (!this.db) throw new Error("Database not initialized");

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(["sessions"], "readwrite");
      const store = transaction.objectStore("sessions");
      const request = store.get(sessionId);

      request.onsuccess = () => {
        const session = request.result as LogSession | undefined;
        if (session) {
          session.endTime = endTime;
          const updateRequest = store.put(session);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => reject(updateRequest.error);
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getSessions(limit = 50): Promise<LogSession[]> {
    if (!this.db) return [];

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(["sessions"], "readonly");
      const store = transaction.objectStore("sessions");
      const index = store.index("startTime");
      const request = index.openCursor(null, "prev");

      const sessions: LogSession[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && sessions.length < limit) {
          sessions.push(cursor.value);
          cursor.continue();
        } else {
          resolve(sessions);
        }
      };

      request.onerror = () => resolve([]);
    });
  }

  async getSession(sessionId: string): Promise<LogSession | null> {
    if (!this.db) return null;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(["sessions"], "readonly");
      const store = transaction.objectStore("sessions");
      const request = store.get(sessionId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(["sessions", "logs"], "readwrite");
      
      // Delete session
      const sessionStore = transaction.objectStore("sessions");
      sessionStore.delete(sessionId);

      // Delete all logs for this session
      const logStore = transaction.objectStore("logs");
      const index = logStore.index("sessionId");
      const request = index.openCursor(sessionId);

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  }

  async clearAllSessions(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(["sessions", "logs"], "readwrite");
      transaction.objectStore("sessions").clear();
      transaction.objectStore("logs").clear();
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  }

  // Log operations
  async saveLog(entry: LogEntry): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(["logs", "sessions"], "readwrite");
      const logStore = transaction.objectStore("logs");
      const sessionStore = transaction.objectStore("sessions");

      // Save the log
      logStore.add(entry);

      // Update session log count
      const sessionRequest = sessionStore.get(entry.sessionId);
      sessionRequest.onsuccess = () => {
        const session = sessionRequest.result as LogSession | undefined;
        if (session) {
          session.logCount = (session.logCount || 0) + 1;
          sessionStore.put(session);
        }
      };

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
    });
  }

  async getLogs(options: {
    sessionId?: string;
    level?: LogLevel;
    startTime?: number;
    endTime?: number;
    limit?: number;
  } = {}): Promise<LogEntry[]> {
    if (!this.db) return [];

    const { sessionId, level, startTime, endTime, limit = 100 } = options;

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(["logs"], "readonly");
      const store = transaction.objectStore("logs");

      let request: IDBRequest;
      
      if (sessionId) {
        // Use compound index for session + time queries
        const index = store.index("sessionTime");
        const range = IDBKeyRange.bound(
          [sessionId, startTime || 0],
          [sessionId, endTime || Date.now()]
        );
        request = index.openCursor(range, "prev");
      } else if (startTime && endTime) {
        const index = store.index("timestamp");
        const range = IDBKeyRange.bound(startTime, endTime);
        request = index.openCursor(range, "prev");
      } else {
        const index = store.index("timestamp");
        request = index.openCursor(null, "prev");
      }

      const logs: LogEntry[] = [];

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor && logs.length < limit) {
          const entry = cursor.value as LogEntry;
          
          // Filter by level if specified
          if (!level || entry.level === level) {
            logs.push(entry);
          }
          
          cursor.continue();
        } else {
          // Reverse to get chronological order
          resolve(logs.reverse());
        }
      };

      request.onerror = () => resolve([]);
    });
  }

  async clearLogs(sessionId?: string): Promise<void> {
    if (!this.db) return;

    if (sessionId) {
      // Clear logs for specific session
      return new Promise((resolve) => {
        const transaction = this.db!.transaction(["logs", "sessions"], "readwrite");
        const logStore = transaction.objectStore("logs");
        const sessionStore = transaction.objectStore("sessions");
        const index = logStore.index("sessionId");
        const request = index.openCursor(sessionId);

        let count = 0;
        request.onsuccess = () => {
          const cursor = request.result;
          if (cursor) {
            cursor.delete();
            count++;
            cursor.continue();
          } else {
            // Update session log count
            const sessionRequest = sessionStore.get(sessionId);
            sessionRequest.onsuccess = () => {
              const session = sessionRequest.result as LogSession | undefined;
              if (session) {
                session.logCount = Math.max(0, session.logCount - count);
                sessionStore.put(session);
              }
            };
          }
        };

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
      });
    } else {
      // Clear all logs
      return new Promise((resolve) => {
        const transaction = this.db!.transaction(["logs"], "readwrite");
        transaction.objectStore("logs").clear();
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
      });
    }
  }

  async getLogCount(sessionId?: string): Promise<number> {
    if (!this.db) return 0;

    if (sessionId) {
      const session = await this.getSession(sessionId);
      return session?.logCount || 0;
    }

    return new Promise((resolve) => {
      const transaction = this.db!.transaction(["logs"], "readonly");
      const store = transaction.objectStore("logs");
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(0);
    });
  }
}

// In-Memory Storage Provider (fallback)
export class MemoryStorageProvider implements StorageProvider {
  readonly name = "Memory";
  private sessions = new Map<string, LogSession>();
  private logs: LogEntry[] = [];

  isReady(): boolean {
    return true;
  }

  async init(): Promise<void> {
    // Nothing to initialize
  }

  async close(): Promise<void> {
    this.sessions.clear();
    this.logs = [];
  }

  async createSession(session: LogSession): Promise<void> {
    this.sessions.set(session.id, { ...session });
  }

  async endSession(sessionId: string, endTime: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.endTime = endTime;
    }
  }

  async getSessions(limit?: number): Promise<LogSession[]> {
    const sessions = Array.from(this.sessions.values())
      .sort((a, b) => b.startTime - a.startTime);
    return limit ? sessions.slice(0, limit) : sessions;
  }

  async getSession(sessionId: string): Promise<LogSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    this.logs = this.logs.filter(log => log.sessionId !== sessionId);
  }

  async clearAllSessions(): Promise<void> {
    this.sessions.clear();
    this.logs = [];
  }

  async saveLog(entry: LogEntry): Promise<void> {
    this.logs.push({ ...entry });
    const session = this.sessions.get(entry.sessionId);
    if (session) {
      session.logCount++;
    }
  }

  async getLogs(options: {
    sessionId?: string;
    level?: LogLevel;
    startTime?: number;
    endTime?: number;
    limit?: number;
  } = {}): Promise<LogEntry[]> {
    const { sessionId, level, startTime, endTime, limit = 100 } = options;
    
    let filtered = this.logs;
    
    if (sessionId) {
      filtered = filtered.filter(log => log.sessionId === sessionId);
    }
    if (level) {
      filtered = filtered.filter(log => log.level === level);
    }
    if (startTime) {
      filtered = filtered.filter(log => log.timestamp >= startTime);
    }
    if (endTime) {
      filtered = filtered.filter(log => log.timestamp <= endTime);
    }
    
    return filtered.slice(-limit);
  }

  async clearLogs(sessionId?: string): Promise<void> {
    if (sessionId) {
      const beforeCount = this.logs.length;
      this.logs = this.logs.filter(log => log.sessionId !== sessionId);
      const deleted = beforeCount - this.logs.length;
      
      const session = this.sessions.get(sessionId);
      if (session) {
        session.logCount = Math.max(0, session.logCount - deleted);
      }
    } else {
      this.logs = [];
    }
  }

  async getLogCount(sessionId?: string): Promise<number> {
    if (sessionId) {
      return this.logs.filter(log => log.sessionId === sessionId).length;
    }
    return this.logs.length;
  }
}

interface LoggerConfig {
  enabled: boolean;
  logLevel: LogLevel;
  enableConsole: boolean;
  storeProvider?: StorageProvider;
  autoStartSession: boolean;
  sessionName?: string;
  maxMemoryLogs: number;
}

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const isDevelopment = (import.meta as any).env?.DEV === true;

class Logger {
  private config: LoggerConfig;
  private store: StorageProvider;
  private currentSession: LogSession | null = null;
  private memoryLogs: LogEntry[] = [];
  private initPromise: Promise<void> | null = null;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      enabled: true,
      logLevel: "debug",
      enableConsole: true,
      autoStartSession: true,
      maxMemoryLogs: 100,
      ...config,
    };

    // Use provided provider or default to IndexedDB
    this.store = this.config.storeProvider || new IndexedDBStorageProvider();

    // Initialize storage
    this.initPromise = this.init();
  }

  private async init(): Promise<void> {
    try {
      await this.store.init();
      
      if (this.config.autoStartSession) {
        await this.startSession(this.config.sessionName);
      }
    } catch (err) {
      console.warn("[Logger] Failed to initialize storage, falling back to memory:", err);
      this.store = new MemoryStorageProvider();
      await this.store.init();
      
      if (this.config.autoStartSession) {
        await this.startSession(this.config.sessionName);
      }
    }
  }

  // Wait for initialization to complete
  async ready(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  // Session Management
  async startSession(name?: string, metadata?: Record<string, any>): Promise<LogSession> {
    await this.ready();

    // End current session if exists
    if (this.currentSession && !this.currentSession.endTime) {
      await this.endSession();
    }

    const session: LogSession = {
      id: this.generateSessionId(),
      name: name || `Session ${new Date().toLocaleString()}`,
      startTime: Date.now(),
      logCount: 0,
      metadata,
    };

    await this.store.createSession(session);
    this.currentSession = session;

    this.info("Logger", `Started session: ${session.name}`, { sessionId: session.id });
    return session;
  }

  async endSession(): Promise<void> {
    if (!this.currentSession) return;

    const endTime = Date.now();
    await this.store.endSession(this.currentSession.id, endTime);
    
    this.info("Logger", `Ended session: ${this.currentSession.name}`, {
      sessionId: this.currentSession.id,
      duration: endTime - this.currentSession.startTime,
      logCount: this.currentSession.logCount,
    });

    this.currentSession = null;
  }

  getCurrentSession(): LogSession | null {
    return this.currentSession;
  }

  async getSessions(limit?: number): Promise<LogSession[]> {
    await this.ready();
    return this.store.getSessions(limit);
  }

  async getSession(sessionId: string): Promise<LogSession | null> {
    await this.ready();
    return this.store.getSession(sessionId);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.ready();
    
    if (this.currentSession?.id === sessionId) {
      this.currentSession = null;
    }
    
    await this.store.deleteSession(sessionId);
  }

  async clearAllSessions(): Promise<void> {
    await this.ready();
    await this.store.clearAllSessions();
    this.memoryLogs = [];
    this.currentSession = null;
  }

  // Log Methods
  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.logLevel];
  }

  private async log(level: LogLevel, context: string, message: string, data?: Record<string, any>) {
    if (!this.shouldLog(level)) return;

    // Use current session ID or a pending placeholder
    const sessionId = this.currentSession?.id || "pending_session";

    const entry: LogEntry = {
      sessionId,
      timestamp: Date.now(),
      level,
      context,
      message,
      data,
    };

    // Console output - do this synchronously
    if (this.config.enableConsole) {
      this.outputToConsole(entry);
    }

    // Store in memory SYNCHRONOUSLY - this ensures logs are visible immediately
    this.memoryLogs.push(entry);
    if (this.memoryLogs.length > this.config.maxMemoryLogs) {
      this.memoryLogs = this.memoryLogs.slice(-this.config.maxMemoryLogs);
    }

    // Ensure we have a session (async from here)
    if (!this.currentSession) {
      await this.startSession();
      // Update the entry's sessionId now that we have a real session
      entry.sessionId = this.currentSession!.id;
    }

    // Store in persistent storage
    try {
      await this.store.saveLog(entry);
      if (this.currentSession) {
        this.currentSession.logCount++;
      }
    } catch (err) {
      console.error("[Logger] Failed to save log to storage:", err);
    }
  }

  private outputToConsole(entry: LogEntry) {
    const time = new Date(entry.timestamp).toISOString();
    const level = entry.level.toUpperCase().padEnd(5);
    const sessionName = this.currentSession?.name || "unknown";
    const base = `[${time}] [${level}] [${sessionName}] ${entry.context}: ${entry.message}`;

    const consoleMethod = entry.level === "error"
      ? "error"
      : entry.level === "warn"
        ? "warn"
        : "log";

    // In development, always use console.log for better visibility
    const devConsoleMethod = isDevelopment ? "log" : consoleMethod;

    if (entry.data && Object.keys(entry.data).length > 0) {
      console[devConsoleMethod](base, entry.data);
    } else {
      console[devConsoleMethod](base);
    }
  }

  debug(context: string, message: string, data?: Record<string, any>) {
    this.log("debug", context, message, data);
  }

  info(context: string, message: string, data?: Record<string, any>) {
    this.log("info", context, message, data);
  }

  warn(context: string, message: string, data?: Record<string, any>) {
    this.log("warn", context, message, data);
  }

  error(context: string, message: string, data?: Record<string, any>) {
    const errorData = { ...data };
    if (data?.error instanceof Error) {
      errorData.errorMessage = data.error.message;
      errorData.errorStack = data.error.stack;
    }
    this.log("error", context, message, errorData);
  }

  // Query Methods
  getMemoryLogs(level?: LogLevel): LogEntry[] {
    return level
      ? this.memoryLogs.filter(log => log.level === level)
      : [...this.memoryLogs];
  }

  clearMemoryLogs() {
    this.memoryLogs = [];
  }

  async getLogs(options: {
    sessionId?: string;
    level?: LogLevel;
    startTime?: number;
    endTime?: number;
    limit?: number;
  } = {}): Promise<LogEntry[]> {
    await this.ready();
    return this.store.getLogs(options);
  }

  async clearLogs(sessionId?: string): Promise<void> {
    await this.ready();
    await this.store.clearLogs(sessionId);
    if (!sessionId || sessionId === this.currentSession?.id) {
      this.memoryLogs = [];
    }
  }

  async getLogCount(sessionId?: string): Promise<number> {
    await this.ready();
    return this.store.getLogCount(sessionId);
  }

  // Export
  async exportLogs(sessionId?: string): Promise<string> {
    await this.ready();

    const sessions = await this.store.getSessions(100);
    const logs = await this.store.getLogs({ sessionId, limit: 1000 });

    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      currentSession: this.currentSession,
      sessions,
      logs,
    }, null, 2);
  }

  async exportSession(sessionId: string): Promise<string | null> {
    await this.ready();

    const session = await this.store.getSession(sessionId);
    if (!session) return null;

    const logs = await this.store.getLogs({ sessionId, limit: 10000 });

    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      session,
      logs,
    }, null, 2);
  }

  // Global Error Handler
  setupGlobalErrorHandler() {
    window.addEventListener("error", (event) => {
      this.error("GlobalError", event.message, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
      });
    });

    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      this.error("UnhandledRejection", String(reason), {
        reason: reason instanceof Error ? reason.message : reason,
        stack: reason instanceof Error ? reason.stack : undefined,
      });
    });
  }

  // Utility
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getStorageProvider(): StorageProvider {
    return this.store;
  }

  isStorageReady(): boolean {
    return this.store.isReady();
  }
}

// Create singleton instance with IndexedDB storage
const logger = new Logger({
  enabled: true,
  logLevel: "debug",
  enableConsole: true,
  autoStartSession: true,
  maxMemoryLogs: 100,
});

// Setup global error handlers
logger.setupGlobalErrorHandler();

export default logger;
