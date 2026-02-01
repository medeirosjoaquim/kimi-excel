import { useState, useEffect, useMemo } from "react";
import { X, Maximize2, Minimize2 } from "lucide-react";
import logger, { type LogEntry, type LogSession, useLogStore } from "../lib/logger.js";
import { useChatStore } from "../stores/useChatStore.js";
import { useConversationStore } from "../stores/useConversationStore.js";
import { useDebugStore } from "../stores/useDebugStore.js";

const isDevelopment = !!(import.meta as any).env?.DEV;

export function DebugPanel() {
  const isOpen = useDebugStore((s) => s.isOpen);
  const setIsOpen = useDebugStore((s) => s.setIsOpen);
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string>("current");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"logs" | "state" | "sessions">("logs");
  const [currentSession, setCurrentSession] = useState<LogSession | null>(null);
  // In dev mode, Zustand is always ready; start with true to avoid flicker
  const [storageReady, setStorageReady] = useState(isDevelopment);

  // Debug: Log what mode we're in
  console.log("[DebugPanel] isDevelopment:", isDevelopment);

  // In dev mode, subscribe directly to Zustand store for reactive updates
  const zustandLogs = useLogStore((s) => s.logs);
  const zustandSessions = useLogStore((s) => s.sessions);

  // For non-dev mode, we still need state for polling
  const [polledLogs, setPolledLogs] = useState<LogEntry[]>([]);
  const [polledSessions, setPolledSessions] = useState<LogSession[]>([]);

  // Subscribe to stores to show real-time state
  const activeConvId = useConversationStore((s) => s.activeId);
  const conversations = useConversationStore((s) => s.conversations);
  const messagesMap = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const chatError = useChatStore((s) => s.error);

  const currentMessages = activeConvId ? (messagesMap[activeConvId] ?? []) : [];

  // Compute filtered logs from Zustand store (dev mode) or polled logs (prod mode)
  const logs = useMemo(() => {
    const sourceLogs = isDevelopment ? zustandLogs : polledLogs;

    // Debug logging
    console.log("[DebugPanel] Computing logs:", {
      isDevelopment,
      zustandLogsCount: zustandLogs.length,
      polledLogsCount: polledLogs.length,
      sourceLogsCount: sourceLogs.length,
      selectedSession,
      currentSessionId: logger.getCurrentSession()?.id,
    });

    let filtered = [...sourceLogs];

    // Filter by session
    if (selectedSession === "current") {
      const session = logger.getCurrentSession();
      if (session) {
        // Include logs from current session OR pending logs (before session was created)
        filtered = filtered.filter((log) =>
          log.sessionId === session.id || log.sessionId === "pending_session"
        );
      }
      // If no session yet, show all logs (including pending)
    } else if (selectedSession !== "all") {
      filtered = filtered.filter((log) => log.sessionId === selectedSession);
    }

    // Filter by level
    if (selectedLevel !== "all") {
      filtered = filtered.filter((log) => log.level === selectedLevel);
    }

    console.log("[DebugPanel] After filtering:", filtered.length, "logs");
    return filtered.slice(-200);
  }, [zustandLogs, polledLogs, selectedSession, selectedLevel, currentSession]);

  // Compute sessions list
  const sessions = useMemo(() => {
    if (isDevelopment) {
      return Array.from(zustandSessions.values()).sort((a, b) => b.startTime - a.startTime);
    }
    return polledSessions;
  }, [zustandSessions, polledSessions]);

  // Load sessions and current session info
  useEffect(() => {
    if (!isOpen) return;

    const updateInfo = async () => {
      await logger.ready();
      // In dev mode, Zustand is always ready
      setStorageReady(isDevelopment ? true : logger.isStorageReady());
      setCurrentSession(logger.getCurrentSession());

      // Only poll in non-dev mode
      if (!isDevelopment) {
        const allSessions = await logger.getSessions(20);
        setPolledSessions(allSessions);
      }
    };

    updateInfo();
    // Poll less frequently in dev mode since we have reactive updates
    const interval = setInterval(updateInfo, isDevelopment ? 5000 : 2000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Poll logs only in non-dev mode
  useEffect(() => {
    if (!isOpen || isDevelopment) return;

    const updateLogs = async () => {
      let fetchedLogs: LogEntry[] = [];

      if (selectedSession === "current") {
        const session = logger.getCurrentSession();
        if (session) {
          fetchedLogs = await logger.getLogs({ sessionId: session.id, limit: 200 });
          if (fetchedLogs.length === 0) {
            fetchedLogs = logger.getMemoryLogs();
          }
        } else {
          fetchedLogs = logger.getMemoryLogs();
        }
      } else if (selectedSession === "all") {
        fetchedLogs = await logger.getLogs({ limit: 200 });
        if (fetchedLogs.length === 0) {
          fetchedLogs = logger.getMemoryLogs();
        }
      } else {
        fetchedLogs = await logger.getLogs({ sessionId: selectedSession, limit: 200 });
      }

      setPolledLogs(fetchedLogs);
    };

    updateLogs();
    const interval = setInterval(updateLogs, 500);

    return () => clearInterval(interval);
  }, [isOpen, selectedSession]);

  const handleExport = async () => {
    let exported: string;
    
    if (selectedSession === "current") {
      const session = logger.getCurrentSession();
      exported = session 
        ? await logger.exportSession(session.id) || "{}"
        : await logger.exportLogs();
    } else if (selectedSession === "all") {
      exported = await logger.exportLogs();
    } else {
      exported = await logger.exportSession(selectedSession) || "{}";
    }

    const blob = new Blob([exported], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kimi-logs-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = async () => {
    if (selectedSession === "current") {
      logger.clearMemoryLogs();
      const session = logger.getCurrentSession();
      if (session) {
        await logger.clearLogs(session.id);
      }
      // In dev mode, also clear Zustand store
      if (isDevelopment && session) {
        useLogStore.getState().removeLogs(session.id);
      }
    } else if (selectedSession === "all") {
      await logger.clearAllSessions();
      if (isDevelopment) {
        useLogStore.getState().clearAll();
      }
    } else {
      await logger.deleteSession(selectedSession);
      if (isDevelopment) {
        useLogStore.getState().removeSession(selectedSession);
      }
    }
    // In non-dev mode, clear polled logs
    if (!isDevelopment) {
      setPolledLogs([]);
    }
  };

  const handleNewSession = async () => {
    await logger.startSession(`Debug Session ${new Date().toLocaleTimeString()}`);
    setCurrentSession(logger.getCurrentSession());
    // In non-dev mode, manually refresh sessions
    if (!isDevelopment) {
      const allSessions = await logger.getSessions(20);
      setPolledSessions(allSessions);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="debug-toggle"
        title="Open debug panel (press Ctrl+Shift+D)"
      >
        🐛
      </button>
    );
  }

  return (
    <div className={`debug-panel ${isExpanded ? "debug-panel-expanded" : ""}`}>
      <div className="debug-panel-titlebar">
        <span className="debug-panel-title">Debug</span>
        <div className="debug-panel-window-controls">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="debug-window-btn"
            title={isExpanded ? "Collapse panel" : "Expand to half screen"}
          >
            {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="debug-window-btn debug-window-btn-close"
            title="Close debug panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="debug-panel-header">
        <div className="debug-panel-tabs">
          <button
            className={`debug-tab ${activeTab === "logs" ? "active" : ""}`}
            onClick={() => setActiveTab("logs")}
          >
            Logs
          </button>
          <button
            className={`debug-tab ${activeTab === "sessions" ? "active" : ""}`}
            onClick={() => setActiveTab("sessions")}
          >
            Sessions
          </button>
          <button
            className={`debug-tab ${activeTab === "state" ? "active" : ""}`}
            onClick={() => setActiveTab("state")}
          >
            State
          </button>
        </div>
        <div className="debug-panel-controls">
          {activeTab === "logs" && (
            <>
              <select
                value={selectedSession}
                onChange={(e) => setSelectedSession(e.target.value)}
                className="debug-select"
                title="Select session"
              >
                <option value="current">Current Session</option>
                <option value="all">All Sessions</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name} ({session.logCount} logs)
                    {session.endTime ? " [ended]" : " [active]"}
                  </option>
                ))}
              </select>

              <select
                value={selectedLevel}
                onChange={(e) => setSelectedLevel(e.target.value)}
                className="debug-select"
                title="Filter by level"
              >
                <option value="all">All Levels</option>
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warn">Warn</option>
                <option value="error">Error</option>
              </select>
            </>
          )}

          <button onClick={handleExport} className="debug-button" title="Export logs as JSON">
            Export
          </button>

          <button onClick={handleClear} className="debug-button" title="Clear logs">
            Clear
          </button>
        </div>
      </div>

      {activeTab === "logs" ? (
        <div className="debug-logs">
          {logs.length === 0 ? (
            <div className="debug-empty">
              <div>No logs available</div>
              <div style={{ marginTop: "8px", fontSize: "11px", color: "#888" }}>
                isDev: {String(isDevelopment)} | zustand: {zustandLogs.length} | polled: {polledLogs.length} | filtered: {logs.length}
              </div>
              {!storageReady && (
                <div className="debug-warning" style={{ marginTop: "8px", fontSize: "12px", color: "#f59e0b" }}>
                  Storage not ready yet. Logs are in memory.
                </div>
              )}
            </div>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className={`debug-log debug-log-${log.level}`}>
                <span className="debug-time">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className="debug-level">{log.level}</span>
                <span className="debug-context">{log.context}</span>
                <span className="debug-message">{log.message}</span>
                {log.data && Object.keys(log.data).length > 0 && (
                  <details className="debug-data">
                    <summary>data</summary>
                    <pre>{JSON.stringify(log.data, null, 2)}</pre>
                  </details>
                )}
              </div>
            ))
          )}
        </div>
      ) : activeTab === "sessions" ? (
        <div className="debug-sessions">
          <div className="debug-session-info">
            <h4>Current Session</h4>
            {currentSession ? (
              <div className="debug-session-card active">
                <div><strong>{currentSession.name}</strong></div>
                <div>ID: {currentSession.id}</div>
                <div>Started: {new Date(currentSession.startTime).toLocaleString()}</div>
                <div>Logs: {currentSession.logCount}</div>
                {currentSession.metadata && (
                  <details>
                    <summary>Metadata</summary>
                    <pre>{JSON.stringify(currentSession.metadata, null, 2)}</pre>
                  </details>
                )}
              </div>
            ) : (
              <div className="debug-empty">No active session</div>
            )}
          <button onClick={handleNewSession} className="debug-button">
            Start New Session
          </button>
          <button
            onClick={() => {
              logger.info("DebugPanel", "Test log generated", {
                timestamp: new Date().toISOString(),
                test: true,
              });
              // Also log the current state
              console.log("[DebugPanel] After test log:", {
                zustandLogs: useLogStore.getState().logs.length,
                zustandSessions: useLogStore.getState().sessions.size,
                currentSession: logger.getCurrentSession(),
                memoryLogs: logger.getMemoryLogs().length,
              });
            }}
            className="debug-button"
            title="Generate a test log entry"
          >
            Test Log
          </button>
          </div>

          <div className="debug-session-list">
            <h4>Recent Sessions ({sessions.length})</h4>
            {sessions.length === 0 ? (
              <div className="debug-empty">No sessions found</div>
            ) : (
              sessions.map((session) => (
                <div 
                  key={session.id} 
                  className={`debug-session-card ${session.id === currentSession?.id ? "active" : ""}`}
                >
                  <div><strong>{session.name}</strong></div>
                  <div>ID: {session.id.slice(0, 20)}...</div>
                  <div>Started: {new Date(session.startTime).toLocaleString()}</div>
                  {session.endTime && (
                    <div>Ended: {new Date(session.endTime).toLocaleString()}</div>
                  )}
                  <div>Logs: {session.logCount}</div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="debug-state">
          <div className="debug-state-section">
            <h4>Storage Provider</h4>
            <pre>{JSON.stringify({
              provider: logger.getStorageProvider().name,
              ready: logger.isStorageReady(),
              currentSession: currentSession?.id,
            }, null, 2)}</pre>
          </div>

          <div className="debug-state-section">
            <h4>Conversation State</h4>
            <pre>{JSON.stringify({
              activeConvId,
              conversationCount: conversations.length,
              isStreaming,
              chatError,
            }, null, 2)}</pre>
          </div>

          <div className="debug-state-section">
            <h4>Messages ({currentMessages.length})</h4>
            <pre>{JSON.stringify(currentMessages.map(m => ({
              id: m.id,
              role: m.role,
              contentLength: m.content.length,
              isStreaming: m.isStreaming,
            })), null, 2)}</pre>
          </div>

          <div className="debug-state-section">
            <h4>All Conversations</h4>
            <pre>{JSON.stringify(conversations, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

// Add keyboard shortcut support
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === "D") {
    e.preventDefault();
    useDebugStore.getState().toggle();
  }
});
