export function WelcomeScreen() {
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <div className="welcome-icon" />
        <h1>Kimi Excel Analyzer</h1>
        <p>Upload Excel or CSV files and ask questions about your data</p>
        <div className="welcome-hints">
          <div className="hint">
            <span className="hint-icon">1</span>
            <span>Click the + button to attach files</span>
          </div>
          <div className="hint">
            <span className="hint-icon">2</span>
            <span>Type your question about the data</span>
          </div>
          <div className="hint">
            <span className="hint-icon">3</span>
            <span>Get AI-powered analysis</span>
          </div>
        </div>
      </div>
    </div>
  );
}
