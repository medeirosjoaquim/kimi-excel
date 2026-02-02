import { useEffect } from "react";
import { useFileStore } from "../stores/useFileStore.js";
import { useAnalysisStore } from "../stores/useAnalysisStore.js";
import { useConfirmStore } from "../stores/useConfirmStore.js";

export function FileList() {
  const { files, selectedFileId, isLoading, fetchFiles, selectFile, deleteFile } = useFileStore();
  const { clear: clearAnalysis } = useAnalysisStore();
  const confirm = useConfirmStore((s) => s.confirm);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleSelect = (id: string) => {
    if (selectedFileId === id) {
      selectFile(null);
      clearAnalysis();
    } else {
      selectFile(id);
      clearAnalysis();
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (await confirm("Are you sure you want to delete this file?")) {
      try {
        await deleteFile(id);
      } catch {
        // Error handled in store
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleSelect(id);
    }
  };

  if (isLoading) {
    return (
      <div className="file-list loading" role="status" aria-live="polite">
        Loading files...
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="file-list empty" role="status">
        No files uploaded yet
      </div>
    );
  }

  return (
    <div className="file-list">
      <h3 id="file-list-heading">Uploaded Files</h3>
      <ul role="list" aria-labelledby="file-list-heading">
        {files.map((file) => (
          <li
            key={file.id}
            className={selectedFileId === file.id ? "selected" : ""}
            onClick={() => handleSelect(file.id)}
            onKeyDown={(e) => handleKeyDown(e, file.id)}
            role="button"
            tabIndex={0}
            aria-pressed={selectedFileId === file.id}
            aria-label={`${file.filename}, status: ${file.status}${selectedFileId === file.id ? ", selected" : ""}`}
          >
            <span className="filename">{file.filename}</span>
            <span className="status" aria-label={`Status: ${file.status}`}>{file.status}</span>
            <button
              className="delete-btn"
              onClick={(e) => handleDelete(e, file.id)}
              aria-label={`Delete file ${file.filename}`}
              title="Delete file"
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
