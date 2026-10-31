import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import Button from './Button';

/**
 * Modal
 * Sizes: sm | md (default) | lg | xl | full
 *
 * Sub-components:
 *   <Modal.Header>  — title + optional close button
 *   <Modal.Body>    — scrollable content area
 *   <Modal.Footer>  — action buttons row
 *
 * Usage:
 *   <Modal isOpen={open} onClose={() => setOpen(false)} size="md">
 *     <Modal.Header onClose={() => setOpen(false)}>Title</Modal.Header>
 *     <Modal.Body>Content here</Modal.Body>
 *     <Modal.Footer>
 *       <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
 *       <Button>Confirm</Button>
 *     </Modal.Footer>
 *   </Modal>
 */
const sizeMap = {
  sm:   'max-w-sm',
  md:   'max-w-lg',
  lg:   'max-w-2xl',
  xl:   'max-w-4xl',
  full: 'max-w-[95vw] max-h-[95vh]',
};

function Modal({ isOpen, onClose, size = 'md', closeOnBackdrop = true, children, className }) {
  const overlayRef = useRef(null);

  /* Trap focus & handle Escape */
  useEffect(() => {
    if (!isOpen) return;

    const handleKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };

    document.addEventListener('keydown', handleKey);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
      aria-modal="true"
      role="dialog"
    >
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className="absolute inset-0 bg-dark-900/60 backdrop-blur-sm animate-fade-in"
        onClick={() => closeOnBackdrop && onClose?.()}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={clsx(
          'relative w-full bg-white rounded-2xl shadow-modal flex flex-col',
          'max-h-[90vh]',
          'animate-scale-in',
          sizeMap[size] ?? sizeMap.md,
          className
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

/* ── Modal.Header ─────────────────────────────────────────── */
function ModalHeader({ children, onClose, className }) {
  return (
    <div
      className={clsx(
        'flex items-center justify-between px-6 py-4 border-b border-dark-100 shrink-0',
        className
      )}
    >
      <h2 className="text-lg font-semibold text-dark-800">{children}</h2>
      {onClose && (
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-dark-400 hover:text-dark-600 hover:bg-dark-100 transition-colors"
          aria-label="Close modal"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

/* ── Modal.Body ───────────────────────────────────────────── */
function ModalBody({ children, className }) {
  return (
    <div className={clsx('flex-1 overflow-y-auto px-6 py-5', className)}>
      {children}
    </div>
  );
}

/* ── Modal.Footer ─────────────────────────────────────────── */
function ModalFooter({ children, className }) {
  return (
    <div
      className={clsx(
        'flex items-center justify-end gap-3 px-6 py-4 border-t border-dark-100 shrink-0',
        className
      )}
    >
      {children}
    </div>
  );
}

/* ── Confirm Modal (convenience wrapper) ─────────────────── */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title  = 'Confirm Action',
  message,
  confirmLabel = 'Confirm',
  cancelLabel  = 'Cancel',
  variant      = 'danger',
  loading      = false,
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalHeader onClose={onClose}>{title}</ModalHeader>
      <ModalBody>
        <p className="text-sm text-dark-600 leading-relaxed">{message}</p>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          {cancelLabel}
        </Button>
        <Button variant={variant} onClick={onConfirm} loading={loading}>
          {confirmLabel}
        </Button>
      </ModalFooter>
    </Modal>
  );
}

Modal.Header = ModalHeader;
Modal.Body   = ModalBody;
Modal.Footer = ModalFooter;

export default Modal;
