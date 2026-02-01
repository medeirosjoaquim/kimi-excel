import { useRef, useState } from "react";
import { useFileStore } from "../stores/useFileStore.js";

export function FileUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const { uploadFile, isUploading, error, clearError } = useFileStore();

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const validExtensions = [".xlsx", ".xls", ".csv", ".tsv"];
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf("."));

    if (!validExtensions.includes(ext)) {
      return;
    }

    clearError();
    try {
      await uploadFile(file);
    } catch {
      // Error is handled in store
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="file-upload">
      <div
        className={`drop-zone ${dragOver ? "drag-over" : ""} ${isUploading ? "uploading" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv,.tsv"
          onChange={(e) => handleFileSelect(e.target.files)}
          style={{ display: "none" }}
        />
        {isUploading ? (
          <p>Uploading...</p>
        ) : (
          <>
            <p>Drop a file here or click to select</p>
            <p className="hint">Supported: .xlsx, .xls, .csv, .tsv</p>
          </>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
