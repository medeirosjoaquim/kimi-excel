import { useEffect, useRef } from "react";
import { useConfirmStore } from "../stores/useConfirmStore.js";

export function ConfirmDialog() {
  const isOpen = useConfirmStore((s) => s.isOpen);
  const message = useConfirmStore((s) => s.message);
  const handleConfirm = useConfirmStore((s) => s.handleConfirm);
  const handleCancel = useConfirmStore((s) => s.handleCancel);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && confirmBtnRef.current) {
      confirmBtnRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancel();
      } else if (e.key === "Enter") {
        handleConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleCancel, handleConfirm]);

  if (!isOpen) return null;

  return (
    <>
      <div className="confirm-backdrop" onClick={handleCancel} />
      <div className="confirm-dialog">
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button
            type="button"
            className="confirm-btn cancel"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className="confirm-btn confirm"
            onClick={handleConfirm}
          >
            Confirm
          </button>
        </div>
      </div>
    </>
  );
}
