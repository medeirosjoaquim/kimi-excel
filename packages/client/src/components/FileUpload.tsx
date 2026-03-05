import { useRef, useState } from "react";
import { useFileStore } from "../stores/useFileStore.js";

export function FileUpload() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const { uploadFile, isUploading, error: storeError, clearError } = useFileStore();

  const error = localError || storeError;

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const file = files[0];
    const validExtensions = [".xlsx", ".xls", ".csv", ".tsv", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"];
    const lastDotIndex = file.name.lastIndexOf(".");
    const ext = lastDotIndex >= 0 ? file.name.toLowerCase().substring(lastDotIndex) : "";

    if (!validExtensions.includes(ext)) {
      setLocalError(`Invalid file type: ${ext || "none"}. Supported: .xlsx, .xls, .csv, .tsv, .png, .jpg, .jpeg, .gif, .webp, .bmp`);
      // Reset input so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setLocalError(null);
    clearError();
    try {
      await uploadFile(file);
      // Reset input after successful upload
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  };

  return (
    <div className="file-upload">
      {/* Screen reader announcements for status changes */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isUploading ? "Uploading file..." : ""}
        {error ? `Error: ${error}` : ""}
      </div>

      <div
        className={`drop-zone ${dragOver ? "drag-over" : ""} ${isUploading ? "uploading" : ""}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-label="File upload zone. Click or press Enter to select a file, or drag and drop a file here."
        aria-disabled={isUploading}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.xlsx,.xls,.csv,.tsv"
          onChange={(e) => handleFileSelect(e.target.files)}
          style={{ display: "none" }}
          aria-label="Select file to upload"
          aria-describedby="file-upload-hint"
        />
        {isUploading ? (
          <p role="status" aria-live="polite">Uploading...</p>
        ) : (
          <>
            <p>Drop a file here or click to select</p>
            <p id="file-upload-hint" className="hint">Supported: .xlsx, .xls, .csv, .tsv, .png, .jpg, .jpeg, .gif, .webp, .bmp</p>
          </>
        )}
      </div>
      {error && (
        <p className="error" role="alert" aria-live="assertive">
          {error}
        </p>
      )}
    </div>
  );
}
