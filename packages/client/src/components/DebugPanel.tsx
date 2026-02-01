import { useState, useEffect } from "react";
import { X } from "lucide-react";
import logger, { type LogEntry, type LogSession } from "../lib/logger.js";
import { useChatStore } from "../stores/useChatStore.js";
import { useConversationStore } from "../stores/useConversationStore.js";

export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sessions, setSessions] = useState<LogSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>("current");
  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"logs" | "state" | "sessions">("logs");
  const [currentSession, setCurrentSession] = useState<LogSession | null>(null);
  const [storageReady, setStorageReady] = useState(false);

  // Subscribe to stores to show real-time state
  const activeConvId = useConversationStore((s) => s.activeId);
  const conversations = useConversationStore((s) => s.conversations);
  const messagesMap = useChatStore((s) => s.messages);
  const isStreaming = useChatStore((s) => s.isStreaming);
  const chatError = useChatStore((s) => s.error);

  const currentMessages = activeConvId ? (messagesMap[activeConvId] ?? []) : [];

  // Load sessions and current session info
  useEffect(() => {
    if (!isOpen) return;

    const updateInfo = async () => {
      await logger.ready();
      setStorageReady(logger.isStorageReady());
      const allSessions = await logger.getSessions(20);
      setSessions(allSessions);
      setCurrentSession(logger.getCurrentSession());
    };

    updateInfo();
    const interval = setInterval(updateInfo, 2000);
    return () => clearInterval(interval);
  }, [isOpen]);

  // Load logs based on selection
  useEffect(() => {
    if (!isOpen) return;

    const updateLogs = async () => {
      let fetchedLogs: LogEntry[] = [];

      if (selectedSession === "current") {
        const session = logger.getCurrentSession();
        if (session) {
          fetchedLogs = await logger.getLogs({ sessionId: session.id, limit: 200 });
          // If storage returns no logs, check memory logs
          if (fetchedLogs.length === 0) {
            fetchedLogs = logger.getMemoryLogs();
          }
        } else {
          // Fall back to memory logs if no active session
          fetchedLogs = logger.getMemoryLogs();
        }
      } else if (selectedSession === "all") {
        fetchedLogs = await logger.getLogs({ limit: 200 });
        // If storage returns no logs, check memory logs
        if (fetchedLogs.length === 0) {
          fetchedLogs = logger.getMemoryLogs();
        }
      } else {
        fetchedLogs = await logger.getLogs({ sessionId: selectedSession, limit: 200 });
      }

      // Filter by level if needed
      if (selectedLevel !== "all") {
        fetchedLogs = fetchedLogs.filter((log) => log.level === selectedLevel);
      }

      setLogs(fetchedLogs);
    };

    updateLogs();
    const interval = setInterval(updateLogs, 500);

    return () => clearInterval(interval);
  }, [isOpen, selectedSession, selectedLevel]);

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
    } else if (selectedSession === "all") {
      await logger.clearAllSessions();
    } else {
      await logger.deleteSession(selectedSession);
    }
    setLogs([]);
  };

  const handleNewSession = async () => {
    await logger.startSession(`Debug Session ${new Date().toLocaleTimeString()}`);
    const sessions = await logger.getSessions(20);
    setSessions(sessions);
    setCurrentSession(logger.getCurrentSession());
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
    <div className="debug-panel">
      <div className="debug-panel-header">
        <h3>Debug</h3>
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

          <button
            onClick={() => setIsOpen(false)}
            className="debug-button"
            title="Close debug panel"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {activeTab === "logs" ? (
        <div className="debug-logs">
          {logs.length === 0 ? (
            <div className="debug-empty">
              <div>No logs available</div>
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
    const toggle = document.querySelector(".debug-toggle") as HTMLButtonElement;
    if (toggle) toggle.click();
  }
});
