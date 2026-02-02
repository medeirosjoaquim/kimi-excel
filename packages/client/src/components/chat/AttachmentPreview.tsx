import { useChatStore } from "../../stores/useChatStore.js";

// Strip timestamp prefix from server-generated filenames
function getDisplayName(filename: string): string {
  const match = filename.match(/^\d+-\d+-(.+)$/);
  return match ? match[1] : filename;
}

export function AttachmentPreview() {
  const pendingAttachments = useChatStore((s) => s.pendingAttachments);
  const removeAttachment = useChatStore((s) => s.removeAttachment);

  if (pendingAttachments.length === 0) {
    return null;
  }

  return (
    <div 
      className="attachment-preview"
      role="region"
      aria-label={`Pending attachments: ${pendingAttachments.length}`}
    >
      {pendingAttachments.map((att) => (
        <div 
          key={att.fileId} 
          className="attachment-preview-item"
          role="listitem"
        >
          <span className="attachment-preview-icon" aria-hidden="true">F</span>
          <span 
            className="attachment-preview-name" 
            title={getDisplayName(att.filename)}
          >
            {getDisplayName(att.filename)}
          </span>
          <button
            type="button"
            className="attachment-preview-remove"
            onClick={() => removeAttachment(att.fileId)}
            aria-label={`Remove attachment: ${getDisplayName(att.filename)}`}
            title="Remove attachment"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
