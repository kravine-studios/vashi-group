import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  closeLabel?: string;
  dismissible?: boolean;
};

export function Modal({
  open,
  title,
  description,
  onClose,
  children,
  closeLabel = 'Close dialog',
  dismissible = true,
}: ModalProps) {
  useEffect(() => {
    if (!open || !dismissible) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose, dismissible]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        aria-describedby={description ? 'modal-description' : undefined}
        className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="modal-title" className="text-xl font-bold text-slate-900">{title}</h2>
            {description ? (
              <p id="modal-description" className="mt-1 text-sm text-slate-600">{description}</p>
            ) : null}
          </div>
          {dismissible ? (
            <button
              type="button"
              aria-label={closeLabel}
              onClick={onClose}
              className="flex h-11 w-11 items-center justify-center rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              <X size={20} />
            </button>
          ) : null}
        </div>
        <div className="mt-5">{children}</div>
      </section>
    </div>,
    document.body,
  );
}
