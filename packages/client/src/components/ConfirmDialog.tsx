import { useEffect, useRef } from "react";
import { useConfirmStore } from "../stores/useConfirmStore.js";

export function ConfirmDialog() {
  const isOpen = useConfirmStore((s) => s.isOpen);
  const message = useConfirmStore((s) => s.message);
  const handleConfirm = useConfirmStore((s) => s.handleConfirm);
  const handleCancel = useConfirmStore((s) => s.handleCancel);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

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

    // Trap focus within dialog
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const dialog = dialogRef.current;
      if (!dialog) return;

      const focusableElements = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement?.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement?.focus();
      }
    };

    const keyHandler = (e: KeyboardEvent) => {
      handleKeyDown(e);
      handleTabKey(e);
    };

    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  }, [isOpen, handleCancel, handleConfirm]);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <>
      <div 
        className="confirm-backdrop" 
        onClick={handleCancel}
        aria-hidden="true"
      />
      <div 
        ref={dialogRef}
        className="confirm-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <h2 id="confirm-dialog-title" className="sr-only">Confirmation Required</h2>
        <p id="confirm-dialog-message" className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button
            type="button"
            className="confirm-btn cancel"
            onClick={handleCancel}
            aria-label="Cancel action"
          >
            Cancel
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className="confirm-btn confirm"
            onClick={handleConfirm}
            aria-label="Confirm action"
          >
            Confirm
          </button>
        </div>
      </div>
    </>
  );
}
