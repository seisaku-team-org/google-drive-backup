import { useCallback } from 'react';
import { AppProvider, useAppDispatch } from './state/AppContext';
import { ServicesProvider } from './services/ServicesContext';
import { cancelCurrentJob } from './services/jobRunner';
import { AppRouter } from './routes/router';
import { Header } from './components/Header/Header';
import { ToastContainer } from './components/Toast/Toast';
import { ConfirmDialogHost } from './components/ConfirmDialog/ConfirmDialog';

export function App() {
  return (
    <ServicesProvider>
      <AppProvider>
        <Header />
        <AppRouter />
        <ToastContainer />
        <ConfirmDialogHostWired />
      </AppProvider>
    </ServicesProvider>
  );
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
