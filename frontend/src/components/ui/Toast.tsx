import React, { createContext, useCallback, useContext, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { MOTION_SPRINGS } from '../../tokens/motionTokens';

export type ToastType = 'success' | 'warning' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  durationMs?: number;
}

interface ToastContextValue {
  showToast: (props: Omit<ToastItem, 'id'>) => string;
  dismissToast: (id: string) => void;
  success: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, message, durationMs = 4200 }: Omit<ToastItem, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const newToast: ToastItem = { id, type, title, message, durationMs };

      setToasts((prev) => [...prev, newToast]);

      if (durationMs > 0) {
        setTimeout(() => {
          dismissToast(id);
        }, durationMs);
      }

      return id;
    },
    [dismissToast]
  );

  const success = useCallback(
    (title: string, message?: string) => showToast({ type: 'success', title, message }),
    [showToast]
  );
  const warning = useCallback(
    (title: string, message?: string) => showToast({ type: 'warning', title, message }),
    [showToast]
  );
  const error = useCallback(
    (title: string, message?: string) => showToast({ type: 'error', title, message }),
    [showToast]
  );
  const info = useCallback(
    (title: string, message?: string) => showToast({ type: 'info', title, message }),
    [showToast]
  );

  const getTheme = (type: ToastType) => {
    switch (type) {
      case 'success':
        return {
          icon: <CheckCircle2 size={18} color="#4A7C59" />,
          accent: '#4A7C59',
          bg: '#F6FAF7',
          border: '#D3E6DA',
        };
      case 'warning':
        return {
          icon: <AlertTriangle size={18} color="#B87319" />,
          accent: '#B87319',
          bg: '#FFFDF9',
          border: '#F4E5CC',
        };
      case 'error':
        return {
          icon: <AlertTriangle size={18} color="#C85252" />,
          accent: '#C85252',
          bg: '#FFF8F7',
          border: '#F6D9D7',
        };
      case 'info':
      default:
        return {
          icon: <Info size={18} color="#437A82" />,
          accent: '#437A82',
          bg: '#F5F9FA',
          border: '#D2E3E5',
        };
    }
  };

  return (
    <ToastContext.Provider value={{ showToast, dismissToast, success, warning, error, info }}>
      {children}

      {/* Toast Floating Container (Góc trên bên phải) */}
      <aside
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '380px',
          width: 'calc(100vw - 40px)',
          pointerEvents: 'none',
        }}
      >
        <AnimatePresence>
          {toasts.map((toast) => {
            const theme = getTheme(toast.type);
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, x: 50, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 70, scale: 0.9, transition: { duration: 0.2 } }}
                transition={MOTION_SPRINGS.snappy}
                drag="x"
                dragConstraints={{ left: 0, right: 160 }}
                onDragEnd={(_, info) => {
                  if (info.offset.x > 80) {
                    dismissToast(toast.id);
                  }
                }}
                style={{
                  pointerEvents: 'auto',
                  backgroundColor: theme.bg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: '14px',
                  boxShadow: '0 8px 26px rgba(45, 40, 37, 0.1)',
                  padding: '14px 16px',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: 'grab',
                }}
                whileTap={{ cursor: 'grabbing' }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <div style={{ marginTop: '2px', flexShrink: 0 }}>{theme.icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.88rem',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        lineHeight: 1.3,
                      }}
                    >
                      {toast.title}
                    </div>
                    {toast.message && (
                      <p
                        style={{
                          margin: '4px 0 0 0',
                          fontSize: '0.78rem',
                          color: 'var(--text-secondary)',
                          lineHeight: 1.4,
                        }}
                      >
                        {toast.message}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => dismissToast(toast.id)}
                    aria-label="Đóng thông báo"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                      padding: '2px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Auto dismiss progress bar */}
                {toast.durationMs && toast.durationMs > 0 && (
                  <motion.div
                    initial={{ scaleX: 1 }}
                    animate={{ scaleX: 0 }}
                    transition={{ duration: toast.durationMs / 1000, ease: 'linear' }}
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '3px',
                      backgroundColor: theme.accent,
                      transformOrigin: 'left',
                      opacity: 0.6,
                    }}
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </aside>
    </ToastContext.Provider>
  );
};
