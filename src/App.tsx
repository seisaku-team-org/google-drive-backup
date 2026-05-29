import { useCallback, useEffect, useRef } from 'react';
import { AppProvider, useAppDispatch } from './state/AppContext';
import { ServicesProvider, useServices } from './services/ServicesContext';
import { cancelCurrentJob } from './services/jobRunner';
import { AppRouter } from './routes/router';
import { Header } from './components/Header/Header';
import { ToastContainer } from './components/Toast/Toast';
import { ConfirmDialogHost } from './components/ConfirmDialog/ConfirmDialog';

export function App() {
  return (
    <ServicesProvider>
      <AppProvider>
        <AuthCallbackConsumer />
        <Header />
        <AppRouter />
        <ToastContainer />
        <ConfirmDialogHostWired />
      </AppProvider>
    </ServicesProvider>
  );
}

/**
 * リダイレクト型 OAuth の戻り URL（#access_token=...）を起動時に 1 回だけ消費する。
 * authClient.consumeRedirectCallback() が URL 掃除も担当する。
 */
function AuthCallbackConsumer() {
  const { authClient } = useServices();
  const dispatch = useAppDispatch();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    authClient
      .consumeRedirectCallback()
      .then((result) => {
        if (!result) return;
        dispatch({
          type: 'auth/signInSucceeded',
          payload: {
            accessToken: result.accessToken,
            expiresAt: result.expiresAt,
            user: result.user,
          },
        });
      })
      .catch((err) => {
        console.error('[App] consumeRedirectCallback failed:', err);
        dispatch({
          type: 'ui/toastShown',
          payload: {
            id: `auth-callback-fail-${Date.now()}`,
            message:
              err instanceof Error
                ? `ログイン後の処理に失敗しました: ${err.message}`
                : 'ログイン後の処理に失敗しました',
            level: 'error',
          },
        });
      });
  }, [authClient, dispatch]);

  return null;
}

function ConfirmDialogHostWired() {
  const dispatch = useAppDispatch();
  const onConfirm = useCallback(
    (kind: string) => {
      switch (kind) {
        case 'cancel-confirm':
          cancelCurrentJob();
          break;
        case 'logout-during-job':
          cancelCurrentJob();
          dispatch({ type: 'job/reset' });
          dispatch({ type: 'auth/signOut' });
          break;
        default:
          break;
      }
    },
    [dispatch],
  );
  return <ConfirmDialogHost onConfirm={onConfirm} />;
}
