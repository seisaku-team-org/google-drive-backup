import { useAppDispatch, useAuth, useJob } from '../../state/AppContext';
import styles from './Header.module.css';

/**
 * 全画面共通のヘッダー。
 * 未認証時はアプリ名のみ。認証済みならユーザー識別 + ログアウトリンク。
 * 複製処理中にログアウトを押されたら確認ダイアログを開く。
 */
export function Header() {
  const auth = useAuth();
  const job = useJob();
  const dispatch = useAppDispatch();

  const isRunning =
    job.currentJob?.status === 'running' ||
    job.currentJob?.status === 'preparing' ||
    job.currentJob?.status === 'cancelling';

  const handleLogout = () => {
    if (isRunning) {
      dispatch({
        type: 'ui/modalOpened',
        payload: {
          kind: 'logout-during-job',
          title: 'ログアウトしますか？',
          body: '複製処理中です。ログアウトすると処理が止まります。よろしいですか？',
          confirmLabel: 'ログアウト',
          cancelLabel: 'キャンセル',
          confirmTone: 'danger',
        },
      });
      return;
    }
    dispatch({ type: 'job/reset' });
    dispatch({ type: 'ui/folderInputCleared' });
    dispatch({ type: 'auth/signOut' });
  };

  return (
    <header className={styles.header}>
      <div className={styles.brand}>Google Drive バックアップ</div>
      {auth.status === 'authenticated' && auth.user && (
        <div className={styles.user}>
          <span className={styles.email} title={auth.user.email}>
            {auth.user.email}
          </span>
          <button type="button" className={styles.logoutLink} onClick={handleLogout}>
            ログアウト
          </button>
        </div>
      )}
    </header>
  );
}
