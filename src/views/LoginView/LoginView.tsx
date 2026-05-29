import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAuth } from '../../state/AppContext';
import { useServices } from '../../services/ServicesContext';
import { Button } from '../../components/Button/Button';
import { isAbortError } from '../../utils/abortable';
import styles from './LoginView.module.css';

/** SCR-001-login（UI 仕様書 §3.1）*/
export function LoginView() {
  const dispatch = useAppDispatch();
  const auth = useAuth();
  const { authClient } = useServices();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setError(null);
    dispatch({ type: 'auth/signInRequested' });
    try {
      // 実 AuthClient はここで window.location を変えるため、以下は実行されない（ブラウザが遷移する）
      // スタブの場合は Promise が resolve して以下が走る
      const result = await authClient.signIn();
      dispatch({
        type: 'auth/signInSucceeded',
        payload: {
          accessToken: result.accessToken,
          expiresAt: result.expiresAt,
          user: result.user,
        },
      });
      navigate('/');
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'OAuth エラー';
      dispatch({ type: 'auth/signInFailed', payload: { reason } });
      if (isAbortError(err) || /popup/i.test(reason) || /cancel/i.test(reason)) {
        dispatch({
          type: 'ui/toastShown',
          payload: {
            id: `login-cancel-${Date.now()}`,
            message: 'ログインがキャンセルされました。',
            level: 'info',
          },
        });
      } else {
        setError(reason);
      }
    }
  };

  return (
    <main className={styles.root}>
      <h2 className={styles.heading}>ようこそ</h2>
      <p className={styles.lead}>
        Drive のフォルダを丸ごと複製します。
        <br />
        まず Google アカウントでログインしてください。
      </p>
      <div className={styles.actions}>
        <Button
          tone="primary"
          onClick={handleSignIn}
          busy={auth.status === 'authenticating'}
        >
          {auth.status === 'authenticating' ? 'ログインしています…' : 'Google でログイン'}
        </Button>
      </div>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      <p className={styles.notice}>※ 本アプリは元フォルダを書き換えません</p>
    </main>
  );
}
