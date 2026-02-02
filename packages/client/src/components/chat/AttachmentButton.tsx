import { useState, useRef, useEffect } from "react";
import type { FileListItem } from "@kimi-excel/shared";
import { useFileStore } from "../../stores/useFileStore.js";
import { useChatStore } from "../../stores/useChatStore.js";
import { useConfirmStore } from "../../stores/useConfirmStore.js";
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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
  const confirm = useConfirmStore((s) => s.confirm);

  // Focus management when dropdown opens
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      // Focus the first focusable element in dropdown
      const firstFocusable = dropdownRef.current.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }
  }, [isOpen]);

  // Handle escape key to close dropdown
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

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
    if (!(await confirm("Are you sure you want to delete this file from Kimi?"))) {
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
    if (!(await confirm(`This will delete ${totalDuplicateFiles} duplicate files, keeping the ${keep} version of each. Continue?`))) {
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
        ref={buttonRef}
        type="button"
        className="attachment-button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUploading}
        aria-label={isOpen ? "Close file attachment menu" : "Open file attachment menu"}
        aria-expanded={isOpen}
        aria-controls={isOpen ? "attachment-dropdown" : undefined}
        aria-haspopup="true"
        title="Attach files"
      >
        {isUploading ? "..." : selectedCount > 0 ? selectedCount : "+"}
      </button>

      {/* Screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {isUploading ? "Uploading file..." : ""}
        {selectedCount > 0 ? `${selectedCount} file${selectedCount !== 1 ? "s" : ""} selected` : ""}
      </div>

      {isOpen && (
        <div 
          ref={dropdownRef}
          id="attachment-dropdown"
          className="attachment-dropdown"
          role="dialog"
          aria-label="File attachment dialog"
          aria-modal="true"
        >
          <div className="attachment-dropdown-header">
            <div 
              className="attachment-tabs" 
              role="tablist"
              aria-label="File management tabs"
            >
              <button
                className={`attachment-tab ${viewMode === "files" ? "active" : ""}`}
                onClick={() => setViewMode("files")}
                role="tab"
                aria-selected={viewMode === "files"}
                aria-controls="files-panel"
                id="files-tab"
              >
                Files
                {selectedCount > 0 && <span className="tab-badge" aria-label={`${selectedCount} selected`}>{selectedCount}</span>}
              </button>
              <button
                className={`attachment-tab ${viewMode === "duplicates" ? "active" : ""}`}
                onClick={() => setViewMode("duplicates")}
                role="tab"
                aria-selected={viewMode === "duplicates"}
                aria-controls="duplicates-panel"
                id="duplicates-tab"
              >
                Duplicates
                {totalDuplicateFiles > 0 && <span className="tab-badge" aria-label={`${totalDuplicateFiles} duplicates found`}>{totalDuplicateFiles}</span>}
              </button>
            </div>
          </div>

          {viewMode === "files" && (
            <div 
              id="files-panel"
              role="tabpanel"
              aria-labelledby="files-tab"
            >
              <button
                className="attachment-upload-btn"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Upload new file"
              >
                Upload New File
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.tsv"
                onChange={handleFileSelect}
                hidden
                aria-label="Select file to upload"
                aria-describedby="file-types-hint"
              />
              <span id="file-types-hint" className="sr-only">
                Supported file types: Excel (.xlsx, .xls) and CSV (.csv, .tsv)
              </span>

              {files.length > 0 && (
                <>
                  <div className="attachment-divider" aria-hidden="true">or select existing</div>
                  <ul 
                    className="attachment-file-list"
                    role="listbox"
                    aria-label="Available files"
                    aria-multiselectable="true"
                  >
                    {files.map((file) => {
                      const attached = isAttached(file.id);
                      const displayName = getDisplayName(file.filename);
                      const deleting = isDeleting === file.id;
                      return (
                        <li 
                          key={file.id} 
                          className="file-list-row"
                          role="option"
                          aria-selected={attached}
                        >
                          <label className={`file-select-item ${attached ? "selected" : ""}`}>
                            <input
                              type="checkbox"
                              checked={attached}
                              onChange={() => handleToggleFile(file.id, file.filename)}
                              disabled={deleting}
                              aria-label={`Select ${displayName}`}
                            />
                            <span className="file-icon" aria-hidden="true">{attached ? "✓" : "F"}</span>
                            <span className="file-name" title={displayName}>
                              {displayName}
                            </span>
                          </label>
                          <button
                            className="file-delete-btn"
                            onClick={(e) => handleDeleteFile(e, file.id)}
                            disabled={deleting}
                            aria-label={`Delete ${displayName}`}
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

              <div className="attachment-hint" id="file-limit-hint">
                Max 9 files per conversation (256k token limit)
              </div>
            </div>
          )}

          {viewMode === "duplicates" && (
            <div 
              id="duplicates-panel"
              role="tabpanel"
              aria-labelledby="duplicates-tab"
              className="duplicates-view"
            >
              {isDeduplicating ? (
                <div 
                  className="duplicates-loading"
                  role="status"
                  aria-live="polite"
                >
                  Removing duplicates...
                </div>
              ) : duplicates.length === 0 ? (
                <div className="no-duplicates" role="status">
                  No duplicate files found.
                </div>
              ) : (
                <>
                  <div className="duplicates-summary" aria-live="polite">
                    Found {totalDuplicateFiles} duplicate{totalDuplicateFiles !== 1 ? "s" : ""} across {duplicates.length} file{duplicates.length !== 1 ? "s" : ""}
                  </div>
                  <ul className="duplicates-list" aria-label="Duplicate files list">
                    {duplicates.map((group) => (
                      <li key={group.originalName} className="duplicate-group">
                        <div className="duplicate-group-name">{group.originalName}</div>
                        <ul className="duplicate-files" aria-label={`Copies of ${group.originalName}`}>
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
                                aria-label={`Delete this copy of ${group.originalName}`}
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
                      aria-label="Keep newest versions and delete duplicates"
                    >
                      Keep Newest
                    </button>
                    <button
                      className="deduplicate-btn secondary"
                      onClick={() => handleDeduplicate("oldest")}
                      disabled={isDeduplicating}
                      aria-label="Keep oldest versions and delete duplicates"
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
            onClick={() => {
              setIsOpen(false);
              buttonRef.current?.focus();
            }}
            aria-label="Close file attachment dialog"
          >
            Done
          </button>
        </div>
      )}

      {isOpen && (
        <div 
          className="attachment-backdrop" 
          onClick={() => {
            setIsOpen(false);
            buttonRef.current?.focus();
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
