import { FileUpload } from "./components/FileUpload.js";
import { FileList } from "./components/FileList.js";
import { AnalysisPanel } from "./components/AnalysisPanel.js";

export function App() {
  return (
    <div className="app">
      <header>
        <h1>Kimi Excel Analyzer</h1>
        <p>Upload and analyze Excel/CSV files using AI</p>
      </header>

      <main>
        <aside className="sidebar">
          <FileUpload />
          <FileList />
        </aside>

        <section className="content">
          <AnalysisPanel />
        </section>
      </main>
    </div>
  );
}
