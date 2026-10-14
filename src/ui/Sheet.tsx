import { useEffect, useId, useRef, type ReactNode } from 'react';
import { IconClose } from './icons';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Footer actions, rendered sticky at the bottom. */
  actions?: ReactNode;
  /** Dismiss when the backdrop is tapped (default true). */
  dismissable?: boolean;
}

/**
 * Bottom sheet on phones, centred dialog on wider screens. Built on <dialog>
 * for correct focus trapping, Escape handling and inert background.
 */
export function Sheet({ open, onClose, title, children, actions, dismissable = true }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      if (typeof el.showModal === 'function') el.showModal();
      else el.setAttribute('open', '');
    } else if (!open && el.open) {
      if (typeof el.close === 'function') el.close();
      else el.removeAttribute('open');
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissable) onClose();
      }}
      onClick={(e) => {
        if (dismissable && e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="sheet__panel">
          <header className="sheet__head">
            <h2 id={titleId} className="sheet__title display">{title}</h2>
            {dismissable && (
              <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
                <IconClose />
              </button>
            )}
          </header>
          <div className="sheet__body">{children}</div>
          {actions && <footer className="sheet__actions">{actions}</footer>}
        </div>
      )}
    </dialog>
  );
}
