export function WelcomeScreen() {
  return (
    <div 
      className="welcome-screen"
      role="region"
      aria-label="Welcome screen"
    >
      <div className="welcome-content">
        <div className="welcome-icon" aria-hidden="true" />
        <h1>Kimi Excel Analyzer</h1>
        <p>Upload Excel or CSV files and ask questions about your data</p>
        <div className="welcome-hints" role="list" aria-label="Getting started steps">
          <div className="hint" role="listitem">
            <span className="hint-icon" aria-hidden="true">1</span>
            <span>Click the + button to attach files</span>
          </div>
          <div className="hint" role="listitem">
            <span className="hint-icon" aria-hidden="true">2</span>
            <span>Type your question about the data</span>
          </div>
          <div className="hint" role="listitem">
            <span className="hint-icon" aria-hidden="true">3</span>
            <span>Get AI-powered analysis</span>
          </div>
        </div>
      </div>
    </div>
  );
}
