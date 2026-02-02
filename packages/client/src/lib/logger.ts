/**
 * Session-aware logging system with pluggable storage providers
 * Default: IndexedDB storage with session grouping
 * Development: Zustand storage for reactive updates
 * Optional: Sentry-compatible API integration
 */

import { create } from "zustand";

export type LogLevel = "debug" | "info" | "warn" | "error";

// Sentry-compatible severity levels
export type SentrySeverity = "fatal" | "error" | "warning" | "info" | "debug";

export interface LogEntry {
  id?: number;
  sessionId: string;
  timestamp: number;
  level: LogLevel;
  context: string;
  message: string;
  data?: Record<string, any>;
  stack?: string;
  // Sentry-compatible fields
  tags?: Record<string, string>;
  user?: SentryUser;
  fingerprint?: string[];
}

export interface LogSession {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  logCount: number;
  metadata?: Record<string, any>;
}

// Sentry-compatible types
export interface SentryUser {
  id?: string;
  email?: string;
  username?: string;
  ip_address?: string;
}

export interface SentryBreadcrumb {
  type?: string;
  category?: string;
  message?: string;
  data?: Record<string, any>;
  level?: SentrySeverity;
  timestamp?: number;
}

export interface SentryEvent {
  event_id: string;
  timestamp: number;
  platform: string;
  level: SentrySeverity;
  logger?: string;
  transaction?: string;
  server_name?: string;
  release?: string;
  environment?: string;
  message?: { formatted: string };
  exception?: {
    values: Array<{
      type: string;
      value: string;
      stacktrace?: { frames: Array<{ filename: string; lineno?: number; colno?: number; function?: string }> };
    }>;
  };
  tags?: Record<string, string>;
  contexts?: Record<string, Record<string, any>>;
  user?: SentryUser;
  breadcrumbs?: { values: SentryBreadcrumb[] };
  fingerprint?: string[];
  extra?: Record<string, any>;
}

export interface SentryDSN {
  protocol: string;
  publicKey: string;
  host: string;
  projectId: string;
}

// Parse Sentry DSN string
export function parseSentryDSN(dsn: string): SentryDSN | null {
  try {
    const url = new URL(dsn);
    const pathParts = url.pathname.split("/").filter(Boolean);
    return {
      protocol: url.protocol.replace(":", ""),
      publicKey: url.username,
      host: url.host,
      projectId: pathParts[pathParts.length - 1] || "",
    };
  } catch {
    return null;
  }
}

// Map log levels to Sentry severity
export function toSentrySeverity(level: LogLevel): SentrySeverity {
  const map: Record<LogLevel, SentrySeverity> = {
    debug: "debug",
    info: "info",
    warn: "warning",
    error: "error",
  };
  return map[level];
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

// Zustand Store for reactive log state
interface LogStoreState {
  sessions: Map<string, LogSession>;
  logs: LogEntry[];
  nextLogId: number;
}

interface LogStoreActions {
  addSession: (session: LogSession) => void;
  updateSession: (sessionId: string, updates: Partial<LogSession>) => void;
  removeSession: (sessionId: string) => void;
  clearSessions: () => void;
  addLog: (entry: LogEntry) => void;
  removeLogs: (sessionId?: string) => void;
  clearAll: () => void;
}

type LogStore = LogStoreState & LogStoreActions;

// Create the Zustand store - exported for direct subscription in components
export const useLogStore = create<LogStore>((set, get) => ({
  sessions: new Map(),
  logs: [],
  nextLogId: 1,

  addSession: (session) => {
    set((state) => {
      const newSessions = new Map(state.sessions);
      newSessions.set(session.id, { ...session });
      return { sessions: newSessions };
    });
  },

  updateSession: (sessionId, updates) => {
    set((state) => {
      const session = state.sessions.get(sessionId);
      if (!session) return state;
      const newSessions = new Map(state.sessions);
      newSessions.set(sessionId, { ...session, ...updates });
      return { sessions: newSessions };
    });
  },

  removeSession: (sessionId) => {
    set((state) => {
      const newSessions = new Map(state.sessions);
      newSessions.delete(sessionId);
      const newLogs = state.logs.filter((log) => log.sessionId !== sessionId);
      return { sessions: newSessions, logs: newLogs };
    });
  },

  clearSessions: () => {
    set({ sessions: new Map(), logs: [], nextLogId: 1 });
  },

  addLog: (entry) => {
    set((state) => {
      const logWithId = { ...entry, id: state.nextLogId };
      const newLogs = [...state.logs, logWithId];

      // Update session log count
      const session = state.sessions.get(entry.sessionId);
      if (session) {
        const newSessions = new Map(state.sessions);
        newSessions.set(entry.sessionId, {
          ...session,
          logCount: session.logCount + 1,
        });
        return { logs: newLogs, nextLogId: state.nextLogId + 1, sessions: newSessions };
      }

      return { logs: newLogs, nextLogId: state.nextLogId + 1 };
    });
  },

  removeLogs: (sessionId) => {
    set((state) => {
      if (sessionId) {
        const deletedCount = state.logs.filter((log) => log.sessionId === sessionId).length;
        const newLogs = state.logs.filter((log) => log.sessionId !== sessionId);

        // Update session log count
        const session = state.sessions.get(sessionId);
        if (session) {
          const newSessions = new Map(state.sessions);
          newSessions.set(sessionId, {
            ...session,
            logCount: Math.max(0, session.logCount - deletedCount),
          });
          return { logs: newLogs, sessions: newSessions };
        }

        return { logs: newLogs };
      }
      return { logs: [] };
    });
  },

  clearAll: () => {
    set({ sessions: new Map(), logs: [], nextLogId: 1 });
  },
}));

// Zustand Storage Provider - uses reactive Zustand store
export class ZustandStorageProvider implements StorageProvider {
  readonly name = "Zustand";

  isReady(): boolean {
    return true; // Zustand is always ready
  }

  async init(): Promise<void> {
    // Nothing to initialize - Zustand store is created on import
  }

  async close(): Promise<void> {
    useLogStore.getState().clearAll();
  }

  async createSession(session: LogSession): Promise<void> {
    useLogStore.getState().addSession(session);
  }

  async endSession(sessionId: string, endTime: number): Promise<void> {
    useLogStore.getState().updateSession(sessionId, { endTime });
  }

  async getSessions(limit = 50): Promise<LogSession[]> {
    const { sessions } = useLogStore.getState();
    return Array.from(sessions.values())
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  async getSession(sessionId: string): Promise<LogSession | null> {
    return useLogStore.getState().sessions.get(sessionId) || null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    useLogStore.getState().removeSession(sessionId);
  }

  async clearAllSessions(): Promise<void> {
    useLogStore.getState().clearAll();
  }

  async saveLog(entry: LogEntry): Promise<void> {
    useLogStore.getState().addLog(entry);
  }

  async getLogs(options: {
    sessionId?: string;
    level?: LogLevel;
    startTime?: number;
    endTime?: number;
    limit?: number;
  } = {}): Promise<LogEntry[]> {
    const { sessionId, level, startTime, endTime, limit = 100 } = options;
    let { logs } = useLogStore.getState();

    if (sessionId) {
      logs = logs.filter((log) => log.sessionId === sessionId);
    }
    if (level) {
      logs = logs.filter((log) => log.level === level);
    }
    if (startTime) {
      logs = logs.filter((log) => log.timestamp >= startTime);
    }
    if (endTime) {
      logs = logs.filter((log) => log.timestamp <= endTime);
    }

    return logs.slice(-limit);
  }

  async clearLogs(sessionId?: string): Promise<void> {
    useLogStore.getState().removeLogs(sessionId);
  }

  async getLogCount(sessionId?: string): Promise<number> {
    const { logs } = useLogStore.getState();
    if (sessionId) {
      return logs.filter((log) => log.sessionId === sessionId).length;
    }
    return logs.length;
  }
}

// Sentry-compatible Storage Provider - sends events to Sentry API
export interface SentryConfig {
  dsn?: string;
  environment?: string;
  release?: string;
  serverName?: string;
  sampleRate?: number;
  beforeSend?: (event: SentryEvent) => SentryEvent | null;
  enabled?: boolean;
}

export class SentryStorageProvider implements StorageProvider {
  readonly name = "Sentry";
  private config: SentryConfig;
  private parsedDSN: SentryDSN | null = null;
  private sessions = new Map<string, LogSession>();
  private breadcrumbs: SentryBreadcrumb[] = [];
  private maxBreadcrumbs = 100;
  private user: SentryUser | null = null;
  private tags: Record<string, string> = {};
  private contexts: Record<string, Record<string, any>> = {};
  private initialized = false;

  constructor(config: SentryConfig = {}) {
    this.config = {
      enabled: true,
      sampleRate: 1.0,
      environment: isDevelopment ? "development" : "production",
      ...config,
    };

    if (config.dsn) {
      this.parsedDSN = parseSentryDSN(config.dsn);
    }
  }

  isReady(): boolean {
    return this.initialized;
  }

  async init(): Promise<void> {
    this.initialized = true;

    // Add browser context
    this.setContext("browser", {
      name: navigator.userAgent,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    });

    // Add OS context if available
    this.setContext("os", {
      name: navigator.platform,
    });
  }

  async close(): Promise<void> {
    this.sessions.clear();
    this.breadcrumbs = [];
    this.initialized = false;
  }

  // Sentry-specific methods
  setUser(user: SentryUser | null): void {
    this.user = user;
  }

  setTag(key: string, value: string): void {
    this.tags[key] = value;
  }

  setTags(tags: Record<string, string>): void {
    this.tags = { ...this.tags, ...tags };
  }

  setContext(name: string, context: Record<string, any> | null): void {
    if (context === null) {
      delete this.contexts[name];
    } else {
      this.contexts[name] = context;
    }
  }

  addBreadcrumb(breadcrumb: Omit<SentryBreadcrumb, "timestamp">): void {
    this.breadcrumbs.push({
      ...breadcrumb,
      timestamp: Date.now() / 1000, // Sentry uses seconds
    });

    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-this.maxBreadcrumbs);
    }
  }

  clearBreadcrumbs(): void {
    this.breadcrumbs = [];
  }

  // Convert LogEntry to Sentry Event
  private toSentryEvent(entry: LogEntry): SentryEvent {
    const eventId = this.generateEventId();

    const event: SentryEvent = {
      event_id: eventId,
      timestamp: entry.timestamp / 1000, // Sentry uses seconds
      platform: "javascript",
      level: toSentrySeverity(entry.level),
      logger: entry.context,
      environment: this.config.environment,
      release: this.config.release,
      server_name: this.config.serverName,
      message: { formatted: entry.message },
      tags: { ...this.tags, ...entry.tags },
      contexts: { ...this.contexts },
      user: entry.user || this.user || undefined,
      breadcrumbs: { values: [...this.breadcrumbs] },
      fingerprint: entry.fingerprint,
      extra: entry.data,
    };

    // Add exception if there's a stack trace
    if (entry.stack) {
      event.exception = {
        values: [{
          type: entry.context,
          value: entry.message,
          stacktrace: this.parseStackTrace(entry.stack),
        }],
      };
    }

    return event;
  }

  private parseStackTrace(stack: string): { frames: Array<{ filename: string; lineno?: number; colno?: number; function?: string }> } {
    const frames = stack
      .split("\n")
      .slice(1) // Skip the error message line
      .map((line) => {
        const match = line.match(/at\s+(?:(.+?)\s+)?\(?(.+?):(\d+):(\d+)\)?/);
        if (match) {
          return {
            function: match[1] || "<anonymous>",
            filename: match[2],
            lineno: parseInt(match[3], 10),
            colno: parseInt(match[4], 10),
          };
        }
        return { filename: line.trim(), function: "<unknown>" };
      })
      .reverse(); // Sentry expects frames in reverse order

    return { frames };
  }

  private generateEventId(): string {
    return "xxxxxxxxxxxxxxxxxxxxxxxxxxxx".replace(/x/g, () =>
      Math.floor(Math.random() * 16).toString(16)
    );
  }

  // Send event to Sentry API
  private async sendToSentry(event: SentryEvent): Promise<void> {
    if (!this.config.enabled || !this.parsedDSN) {
      return;
    }

    // Apply sample rate
    if (Math.random() > (this.config.sampleRate || 1)) {
      return;
    }

    // Apply beforeSend hook
    if (this.config.beforeSend) {
      const modifiedEvent = this.config.beforeSend(event);
      if (!modifiedEvent) return;
      event = modifiedEvent;
    }

    const { protocol, publicKey, host, projectId } = this.parsedDSN;
    const url = `${protocol}://${host}/api/${projectId}/store/`;

    try {
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Sentry-Auth": `Sentry sentry_version=7, sentry_client=kimi-logger/1.0, sentry_key=${publicKey}`,
        },
        body: JSON.stringify(event),
      });
    } catch (err) {
      console.warn("[SentryProvider] Failed to send event:", err);
    }
  }

  // Sentry-style capture methods
  captureMessage(message: string, level: LogLevel = "info"): string {
    const event = this.toSentryEvent({
      sessionId: "",
      timestamp: Date.now(),
      level,
      context: "captureMessage",
      message,
    });

    this.sendToSentry(event);
    return event.event_id;
  }

  captureException(error: Error, context?: Record<string, any>): string {
    const event = this.toSentryEvent({
      sessionId: "",
      timestamp: Date.now(),
      level: "error",
      context: error.name || "Error",
      message: error.message,
      stack: error.stack,
      data: context,
    });

    this.sendToSentry(event);
    return event.event_id;
  }

  captureEvent(event: Partial<SentryEvent>): string {
    const fullEvent: SentryEvent = {
      event_id: this.generateEventId(),
      timestamp: Date.now() / 1000,
      platform: "javascript",
      level: "info",
      ...event,
    } as SentryEvent;

    this.sendToSentry(fullEvent);
    return fullEvent.event_id;
  }

  // StorageProvider interface implementation
  async createSession(session: LogSession): Promise<void> {
    this.sessions.set(session.id, { ...session });
    this.addBreadcrumb({
      category: "session",
      message: `Session started: ${session.name}`,
      level: "info",
    });
  }

  async endSession(sessionId: string, endTime: number): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.endTime = endTime;
      this.addBreadcrumb({
        category: "session",
        message: `Session ended: ${session.name}`,
        level: "info",
      });
    }
  }

  async getSessions(limit = 50): Promise<LogSession[]> {
    return Array.from(this.sessions.values())
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit);
  }

  async getSession(sessionId: string): Promise<LogSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async clearAllSessions(): Promise<void> {
    this.sessions.clear();
    this.breadcrumbs = [];
  }

  async saveLog(entry: LogEntry): Promise<void> {
    // Add as breadcrumb for non-error logs
    if (entry.level !== "error") {
      this.addBreadcrumb({
        category: entry.context,
        message: entry.message,
        level: toSentrySeverity(entry.level),
        data: entry.data,
      });
    }

    // Send errors to Sentry
    if (entry.level === "error" || entry.level === "warn") {
      const event = this.toSentryEvent(entry);
      await this.sendToSentry(event);
    }

    // Update session log count
    const session = this.sessions.get(entry.sessionId);
    if (session) {
      session.logCount++;
    }
  }

  async getLogs(): Promise<LogEntry[]> {
    // Sentry doesn't store logs locally, return empty
    // Use breadcrumbs for recent activity
    return [];
  }

  async clearLogs(): Promise<void> {
    this.clearBreadcrumbs();
  }

  async getLogCount(): Promise<number> {
    return this.breadcrumbs.length;
  }
}

// Sentry-compatible API wrapper for drop-in replacement
export function createSentryCompatibleLogger(config: SentryConfig = {}) {
  const provider = new SentryStorageProvider(config);

  return {
    init: () => provider.init(),

    // Sentry-style methods
    captureMessage: (message: string, level?: LogLevel) => provider.captureMessage(message, level),
    captureException: (error: Error, context?: Record<string, any>) => provider.captureException(error, context),
    captureEvent: (event: Partial<SentryEvent>) => provider.captureEvent(event),

    // Scope methods
    setUser: (user: SentryUser | null) => provider.setUser(user),
    setTag: (key: string, value: string) => provider.setTag(key, value),
    setTags: (tags: Record<string, string>) => provider.setTags(tags),
    setContext: (name: string, context: Record<string, any> | null) => provider.setContext(name, context),

    // Breadcrumbs
    addBreadcrumb: (breadcrumb: Omit<SentryBreadcrumb, "timestamp">) => provider.addBreadcrumb(breadcrumb),

    // Get the provider for use with Logger
    getProvider: () => provider,
  };
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

const isDevelopment = !!(import.meta as any).env?.DEV;

// Debug: Log which mode we're in
console.log("[Logger] isDevelopment:", isDevelopment, "DEV value:", (import.meta as any).env?.DEV);

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
    // Wait for store to be ready, but don't wait for full init (avoids deadlock)
    // The store.init() is called first in init(), so by the time startSession
    // is called from init(), the store is already ready
    while (!this.store.isReady()) {
      await new Promise(resolve => setTimeout(resolve, 10));
    }

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
      console.log("[Logger] No session, awaiting startSession...");
      await this.startSession();
    }

    // Update entry sessionId if we now have a session
    if (this.currentSession && entry.sessionId === "pending_session") {
      console.log("[Logger] Session started:", this.currentSession.id);
      entry.sessionId = this.currentSession.id;
    }

    // Store in persistent storage
    try {
      console.log("[Logger] Saving to store:", this.store.name, "entry:", entry.message.substring(0, 30));
      await this.store.saveLog(entry);
      console.log("[Logger] Saved successfully, store logs:",
        this.store.name === "Zustand" ? useLogStore.getState().logs.length : "N/A"
      );
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

  // Sentry-compatible methods (delegate to provider if it's Sentry)
  private getSentryProvider(): SentryStorageProvider | null {
    return this.store instanceof SentryStorageProvider ? this.store : null;
  }

  captureMessage(message: string, level: LogLevel = "info"): string | null {
    const sentry = this.getSentryProvider();
    if (sentry) {
      return sentry.captureMessage(message, level);
    }
    this.log(level, "captureMessage", message);
    return null;
  }

  captureException(error: Error, context?: Record<string, any>): string | null {
    const sentry = this.getSentryProvider();
    if (sentry) {
      return sentry.captureException(error, context);
    }
    this.error("Exception", error.message, { ...context, stack: error.stack });
    return null;
  }

  setUser(user: SentryUser | null): void {
    const sentry = this.getSentryProvider();
    if (sentry) {
      sentry.setUser(user);
    }
  }

  setTag(key: string, value: string): void {
    const sentry = this.getSentryProvider();
    if (sentry) {
      sentry.setTag(key, value);
    }
  }

  setTags(tags: Record<string, string>): void {
    const sentry = this.getSentryProvider();
    if (sentry) {
      sentry.setTags(tags);
    }
  }

  setContext(name: string, context: Record<string, any> | null): void {
    const sentry = this.getSentryProvider();
    if (sentry) {
      sentry.setContext(name, context);
    }
  }

  addBreadcrumb(breadcrumb: Omit<SentryBreadcrumb, "timestamp">): void {
    const sentry = this.getSentryProvider();
    if (sentry) {
      sentry.addBreadcrumb(breadcrumb);
    }
  }
}

// Create singleton instance
// Use Zustand in development for reactive updates, IndexedDB in production for persistence
const storeProvider = isDevelopment ? new ZustandStorageProvider() : new IndexedDBStorageProvider();
console.log("[Logger] Using storage provider:", storeProvider.name, "isDevelopment:", isDevelopment);

const logger = new Logger({
  enabled: true,
  logLevel: "debug",
  enableConsole: true,
  autoStartSession: true,
  maxMemoryLogs: 100,
  storeProvider,
});

// Setup global error handlers
logger.setupGlobalErrorHandler();

// Default export is the singleton instance
// All classes and types are already exported inline
export default logger;
