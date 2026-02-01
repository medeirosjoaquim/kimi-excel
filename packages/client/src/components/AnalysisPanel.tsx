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
      {/* Live region for status announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isAnalyzing ? "Analyzing your data..." : ""}
        {error ? `Error: ${error}` : ""}
        {content && !isAnalyzing ? "Analysis complete" : ""}
      </div>

      <form onSubmit={handleSubmit} aria-label="Data analysis form">
        <label htmlFor="analysis-question" className="sr-only">
          Ask a question about your data
        </label>
        <textarea
          id="analysis-question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask a question about your data..."
          rows={3}
          disabled={isAnalyzing}
          aria-label="Question about your data"
          aria-describedby="analysis-hint"
          aria-disabled={isAnalyzing}
        />
        <p id="analysis-hint" className="sr-only">
          Enter a question about your Excel or CSV data and click Analyze to get AI-powered insights.
        </p>
        <div className="actions">
          <button 
            type="submit" 
            disabled={isAnalyzing || !question.trim()}
            aria-label={isAnalyzing ? "Analysis in progress" : "Analyze data"}
          >
            {isAnalyzing ? "Analyzing..." : "Analyze"}
          </button>
          {isAnalyzing && (
            <button 
              type="button" 
              onClick={abort}
              aria-label="Stop analysis"
            >
              Stop
            </button>
          )}
          {content && (
            <button 
              type="button" 
              onClick={clear}
              aria-label="Clear analysis results"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {error && (
        <div className="error" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      {content && (
        <div className="result">
          <h4>Response</h4>
          <div className="content" role="region" aria-label="Analysis response" tabIndex={0}>
            {content}
          </div>
        </div>
      )}

      {toolCalls.length > 0 && (
        <div className="tool-calls">
          <h4>Tool Calls</h4>
          <ul aria-label="List of tool calls made during analysis">
            {toolCalls.map((tc, i) => (
              <li key={i}>
                <strong>{tc._plugin.name}</strong>
                <code aria-label="Tool arguments">{tc._plugin.arguments}</code>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
