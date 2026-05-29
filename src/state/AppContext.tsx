import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { authReducer, initialAuthState, type AuthAction } from './authSlice';
import { jobReducer, initialJobState, type JobAction, type JobState } from './jobSlice';
import { uiReducer, initialUIState, type UIAction, type UIState } from './uiSlice';
import type { AuthState } from '../types';

export type RootState = {
  auth: AuthState;
  job: JobState;
  ui: UIState;
};

export type Action = AuthAction | JobAction | UIAction;

export const initialRootState: RootState = {
  auth: initialAuthState,
  job: initialJobState,
  ui: initialUIState,
};

export function rootReducer(state: RootState, action: Action): RootState {
  // 各スライスは自身の action 以外を default で素通しする
  return {
    auth: authReducer(state.auth, action as AuthAction),
    job: jobReducer(state.job, action as JobAction),
    ui: uiReducer(state.ui, action as UIAction),
  };
}

const StateContext = createContext<RootState | null>(null);
const DispatchContext = createContext<Dispatch<Action> | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(rootReducer, initialRootState);
  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useAppState(): RootState {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error('useAppState must be used within <AppProvider>');
  return ctx;
}

export function useAppDispatch(): Dispatch<Action> {
  const ctx = useContext(DispatchContext);
  if (!ctx) throw new Error('useAppDispatch must be used within <AppProvider>');
  return ctx;
}

/** よく使うサブステートのセレクタ。再描画範囲を絞りたいなら個別 selector を増やす */
export function useAuth() {
  return useAppState().auth;
}

/**
 * 認証必須画面で使う。未認証なら /login に redirect する。
 * 内部で useNavigate を呼ぶため、<Router> 配下でのみ動作する。
 */
export function useRequireAuth(): void {
  const auth = useAppState().auth;
  const navigate = useNavigate();
  useEffect(() => {
    if (auth.status === 'unauthenticated') {
      navigate('/login', { replace: true });
    }
  }, [auth.status, navigate]);
}

export function useJob() {
  return useAppState().job;
}

export function useUI() {
  return useAppState().ui;
}
