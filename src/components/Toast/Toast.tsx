import { useEffect } from 'react';
import { useAppDispatch, useUI } from '../../state/AppContext';
import type { ToastItem } from '../../state/uiSlice';
import styles from './Toast.module.css';

const DEFAULT_DURATION_MS = 4000;

/** 画面右下に積み上げる Toast コンテナ。State 由来で描画する */
export function ToastContainer() {
  const { toasts } = useUI();
  return (
    <div className={styles.container} aria-live="polite" aria-atomic="false">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function Toast({ toast }: { toast: ToastItem }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    const timer = setTimeout(() => {
      dispatch({ type: 'ui/toastDismissed', payload: { id: toast.id } });
    }, DEFAULT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast.id, dispatch]);

  const levelClass =
    toast.level === 'error' ? styles.error : toast.level === 'warn' ? styles.warn : styles.info;

  return (
    <div className={`${styles.toast} ${levelClass}`} role={toast.level === 'error' ? 'alert' : 'status'}>
      <span className={styles.message}>{toast.message}</span>
      <button
        type="button"
        className={styles.close}
        aria-label="閉じる"
        onClick={() => dispatch({ type: 'ui/toastDismissed', payload: { id: toast.id } })}
      >
        ×
      </button>
    </div>
  );
}
