import { useEffect, useRef } from 'react';
import { useAppDispatch, useUI } from '../../state/AppContext';
import { Button } from '../Button/Button';
import styles from './ConfirmDialog.module.css';

export type ConfirmHandler = (kind: string) => void;

export type ConfirmDialogHostProps = {
  /** 「confirm」を押されたときに呼ばれる。kind で何のダイアログかを判別する */
  onConfirm?: ConfirmHandler;
};

/**
 * uiSlice.modal を購読する単一のホスト。
 * 描画は modal が non-null のときのみ。Esc / 外側クリックで閉じる。
 */
export function ConfirmDialogHost({ onConfirm }: ConfirmDialogHostProps) {
  const { modal } = useUI();
  const dispatch = useAppDispatch();
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!modal) return;
    // 開いたときに confirm ボタンへフォーカス
    confirmBtnRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dispatch({ type: 'ui/modalClosed' });
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [modal, dispatch]);

  if (!modal) return null;

  const onBackdropClick = () => {
    // danger（破壊的）は外側クリックで閉じない（誤操作防止）
    if (modal.confirmTone === 'danger') return;
    dispatch({ type: 'ui/modalClosed' });
  };

  const handleConfirm = () => {
    const kind = modal.kind;
    dispatch({ type: 'ui/modalClosed' });
    onConfirm?.(kind);
  };

  const handleCancel = () => dispatch({ type: 'ui/modalClosed' });

  return (
    <div
      className={styles.backdrop}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onBackdropClick();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-body"
      >
        <h2 id="confirm-title" className={styles.title}>
          {modal.title}
        </h2>
        <p id="confirm-body" className={styles.body}>
          {modal.body}
        </p>
        <div className={styles.actions}>
          <Button tone="tertiary" onClick={handleCancel}>
            {modal.cancelLabel}
          </Button>
          <Button
            ref={confirmBtnRef}
            tone={modal.confirmTone === 'danger' ? 'danger' : 'primary'}
            onClick={handleConfirm}
          >
            {modal.confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
