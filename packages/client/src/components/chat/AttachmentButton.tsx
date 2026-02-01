import { useState, useRef, useEffect } from "react";
import type { FileListItem } from "@kimi-excel/shared";
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

type ViewMode = "files" | "duplicates";

export function AttachmentButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("files");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const files = useFileStore((s) => s.files);
  const fetchFiles = useFileStore((s) => s.fetchFiles);
  const deleteFile = useFileStore((s) => s.deleteFile);
  const duplicates = useFileStore((s) => s.duplicates);
  const totalDuplicateFiles = useFileStore((s) => s.totalDuplicateFiles);
  const findDuplicates = useFileStore((s) => s.findDuplicates);
  const deduplicateFiles = useFileStore((s) => s.deduplicateFiles);
  const isDeduplicating = useFileStore((s) => s.isDeduplicating);
  const pendingAttachments = useChatStore((s) => s.pendingAttachments);
  const addAttachment = useChatStore((s) => s.addAttachment);
  const removeAttachment = useChatStore((s) => s.removeAttachment);

  // Find duplicates when switching to duplicates view
  useEffect(() => {
    if (viewMode === "duplicates") {
      findDuplicates();
    }
  }, [viewMode, findDuplicates]);

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

  const handleDeleteFile = async (e: React.MouseEvent, fileId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this file from Kimi?")) {
      return;
    }
    setIsDeleting(fileId);
    try {
      await deleteFile(fileId);
      // Also remove from pending attachments if attached
      if (isAttached(fileId)) {
        removeAttachment(fileId);
      }
    } catch (error) {
      console.error("Delete failed:", error);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleDeduplicate = async (keep: "newest" | "oldest") => {
    if (!confirm(`This will delete ${totalDuplicateFiles} duplicate files, keeping the ${keep} version of each. Continue?`)) {
      return;
    }
    try {
      const deleted = await deduplicateFiles(keep);
      alert(`Successfully deleted ${deleted} duplicate files.`);
      setViewMode("files");
    } catch (error) {
      console.error("Deduplicate failed:", error);
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
            <div className="attachment-tabs">
              <button
                className={`attachment-tab ${viewMode === "files" ? "active" : ""}`}
                onClick={() => setViewMode("files")}
              >
                Files
                {selectedCount > 0 && <span className="tab-badge">{selectedCount}</span>}
              </button>
              <button
                className={`attachment-tab ${viewMode === "duplicates" ? "active" : ""}`}
                onClick={() => setViewMode("duplicates")}
              >
                Duplicates
                {totalDuplicateFiles > 0 && <span className="tab-badge">{totalDuplicateFiles}</span>}
              </button>
            </div>
          </div>

          {viewMode === "files" && (
            <>
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
                      const deleting = isDeleting === file.id;
                      return (
                        <li key={file.id} className="file-list-row">
                          <label className={`file-select-item ${attached ? "selected" : ""}`}>
                            <input
                              type="checkbox"
                              checked={attached}
                              onChange={() => handleToggleFile(file.id, file.filename)}
                              disabled={deleting}
                            />
                            <span className="file-icon">{attached ? "✓" : "F"}</span>
                            <span className="file-name" title={displayName}>
                              {displayName}
                            </span>
                          </label>
                          <button
                            className="file-delete-btn"
                            onClick={(e) => handleDeleteFile(e, file.id)}
                            disabled={deleting}
                            title="Delete file"
                          >
                            {deleting ? "..." : "×"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              <div className="attachment-hint">
                Max 9 files per conversation (256k token limit)
              </div>
            </>
          )}

          {viewMode === "duplicates" && (
            <div className="duplicates-view">
              {isDeduplicating ? (
                <div className="duplicates-loading">Removing duplicates...</div>
              ) : duplicates.length === 0 ? (
                <div className="no-duplicates">No duplicate files found.</div>
              ) : (
                <>
                  <div className="duplicates-summary">
                    Found {totalDuplicateFiles} duplicate{totalDuplicateFiles !== 1 ? "s" : ""} across {duplicates.length} file{duplicates.length !== 1 ? "s" : ""}
                  </div>
                  <ul className="duplicates-list">
                    {duplicates.map((group) => (
                      <li key={group.originalName} className="duplicate-group">
                        <div className="duplicate-group-name">{group.originalName}</div>
                        <ul className="duplicate-files">
                          {group.files.map((file: FileListItem, idx: number) => (
                            <li key={file.id} className="duplicate-file">
                              <span className="duplicate-badge">
                                {idx === 0 ? "newest" : `copy ${idx}`}
                              </span>
                              <span className="duplicate-date">
                                {file.createdAt ? new Date(file.createdAt * 1000).toLocaleDateString() : "unknown"}
                              </span>
                              <button
                                className="file-delete-btn"
                                onClick={(e) => handleDeleteFile(e, file.id)}
                                disabled={isDeleting === file.id}
                                title="Delete this copy"
                              >
                                {isDeleting === file.id ? "..." : "×"}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                  <div className="deduplicate-actions">
                    <button
                      className="deduplicate-btn"
                      onClick={() => handleDeduplicate("newest")}
                      disabled={isDeduplicating}
                    >
                      Keep Newest
                    </button>
                    <button
                      className="deduplicate-btn secondary"
                      onClick={() => handleDeduplicate("oldest")}
                      disabled={isDeduplicating}
                    >
                      Keep Oldest
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

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
