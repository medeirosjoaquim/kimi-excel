import { useState, useRef } from "react";
import { useFileStore } from "../../stores/useFileStore.js";
import { useChatStore } from "../../stores/useChatStore.js";
import { api } from "../../api/client.js";

// Strip timestamp prefix from server-generated filenames
// Pattern: "timestamp-randomId-originalname.ext" -> "originalname.ext"
function getDisplayName(filename: string): string {
  // Match pattern like "1769970671268-1524408-filename.xls"
  const match = filename.match(/^\d+-\d+-(.+)$/);
  return match ? match[1] : filename;
}

export function AttachmentButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const files = useFileStore((s) => s.files);
  const fetchFiles = useFileStore((s) => s.fetchFiles);
  const pendingAttachments = useChatStore((s) => s.pendingAttachments);
  const addAttachment = useChatStore((s) => s.addAttachment);
  const removeAttachment = useChatStore((s) => s.removeAttachment);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const response = await api.uploadFile(file);
      await fetchFiles();
      addAttachment({ fileId: response.id, filename: response.filename });
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleToggleFile = (fileId: string, filename: string) => {
    if (isAttached(fileId)) {
      removeAttachment(fileId);
    } else {
      addAttachment({ fileId, filename });
    }
  };

  const isAttached = (fileId: string) =>
    pendingAttachments.some((a) => a.fileId === fileId);

  const selectedCount = pendingAttachments.length;

  return (
    <div className="attachment-button-container">
      <button
        type="button"
        className="attachment-button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUploading}
        title="Attach files"
      >
        {isUploading ? "..." : selectedCount > 0 ? selectedCount : "+"}
      </button>

      {isOpen && (
        <div className="attachment-dropdown">
          <div className="attachment-dropdown-header">
            Attach Files
            {selectedCount > 0 && (
              <span className="selected-count">{selectedCount} selected</span>
            )}
          </div>

          <button
            className="attachment-upload-btn"
            onClick={() => fileInputRef.current?.click()}
          >
            Upload New File
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.tsv"
            onChange={handleFileSelect}
            hidden
          />

          {files.length > 0 && (
            <>
              <div className="attachment-divider">or select existing</div>
              <ul className="attachment-file-list">
                {files.map((file) => {
                  const attached = isAttached(file.id);
                  const displayName = getDisplayName(file.filename);
                  return (
                    <li key={file.id}>
                      <label className={`file-select-item ${attached ? "selected" : ""}`}>
                        <input
                          type="checkbox"
                          checked={attached}
                          onChange={() => handleToggleFile(file.id, file.filename)}
                        />
                        <span className="file-icon">{attached ? "✓" : "F"}</span>
                        <span className="file-name" title={displayName}>
                          {displayName}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <div className="attachment-hint">
            Max 9 files per conversation (256k token limit)
          </div>

          <button
            className="attachment-done-btn"
            onClick={() => setIsOpen(false)}
          >
            Done
          </button>
        </div>
      )}

      {isOpen && (
        <div className="attachment-backdrop" onClick={() => setIsOpen(false)} />
      )}
    </div>
  );
}
