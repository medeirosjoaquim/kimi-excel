import { useState } from "react";
import { useFileStore } from "../stores/useFileStore.js";
import { useAnalysisStore } from "../stores/useAnalysisStore.js";

export function AnalysisPanel() {
  const [question, setQuestion] = useState("");
  const { selectedFileId } = useFileStore();
  const { content, toolCalls, isAnalyzing, error, analyze, abort, clear } = useAnalysisStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFileId || !question.trim()) return;
    analyze(selectedFileId, question.trim());
  };

  if (!selectedFileId) {
    return (
      <div className="analysis-panel">
        <p className="placeholder">Select a file to analyze</p>
      </div>
    );
  }

  return (
    <div className="analysis-panel">
      <form onSubmit={handleSubmit}>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about your data..."
          rows={3}
          disabled={isAnalyzing}
        />
        <div className="actions">
          <button type="submit" disabled={isAnalyzing || !question.trim()}>
            {isAnalyzing ? "Analyzing..." : "Analyze"}
          </button>
          {isAnalyzing && (
            <button type="button" onClick={abort}>
              Stop
            </button>
          )}
          {content && (
            <button type="button" onClick={clear}>
              Clear
            </button>
          )}
        </div>
      </form>

      {error && <div className="error">{error}</div>}

      {content && (
        <div className="result">
          <h4>Response</h4>
          <div className="content">{content}</div>
        </div>
      )}

      {toolCalls.length > 0 && (
        <div className="tool-calls">
          <h4>Tool Calls</h4>
          <ul>
            {toolCalls.map((tc, i) => (
              <li key={i}>
                <strong>{tc._plugin.name}</strong>
                <code>{tc._plugin.arguments}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
