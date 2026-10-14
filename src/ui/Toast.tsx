import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';

interface ToastApi {
  show: (message: string, opts?: { action?: { label: string; onClick: () => void }; duration?: number }) => void;
}

const Ctx = createContext<ToastApi>({ show: () => {} });

interface ToastState {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback<ToastApi['show']>((message, opts) => {
    window.clearTimeout(timer.current);
    const id = Date.now();
    setToast({ id, message, action: opts?.action });
    timer.current = window.setTimeout(() => setToast((t) => (t?.id === id ? null : t)), opts?.duration ?? 2400);
  }, []);
  return (
    <Ctx.Provider value={{ show }}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast && (
          <div className="toast anim-rise" key={toast.id}>
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                className="toast__action"
                onClick={() => {
                  toast.action?.onClick();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
