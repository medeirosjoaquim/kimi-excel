import { useEffect } from "react";
import { useFileStore } from "../stores/useFileStore.js";
import { useAnalysisStore } from "../stores/useAnalysisStore.js";

export function FileList() {
  const { files, selectedFileId, isLoading, fetchFiles, selectFile, deleteFile } = useFileStore();
  const { clear: clearAnalysis } = useAnalysisStore();

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
    if (confirm("Are you sure you want to delete this file?")) {
      try {
        await deleteFile(id);
      } catch {
        // Error handled in store
      }
    }
  };

  if (isLoading) {
    return <div className="file-list loading">Loading files...</div>;
  }

  if (files.length === 0) {
    return <div className="file-list empty">No files uploaded yet</div>;
  }

  return (
    <div className="file-list">
      <h3>Uploaded Files</h3>
      <ul>
        {files.map((file) => (
          <li
            key={file.id}
            className={selectedFileId === file.id ? "selected" : ""}
            onClick={() => handleSelect(file.id)}
          >
            <span className="filename">{file.filename}</span>
            <span className="status">{file.status}</span>
            <button
              className="delete-btn"
              onClick={(e) => handleDelete(e, file.id)}
              title="Delete file"
            >
              X
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
