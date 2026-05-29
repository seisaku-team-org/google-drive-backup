import type { AuthState, UserInfo } from '../types';

export const initialAuthState: AuthState = {
  status: 'unauthenticated',
  accessToken: null,
  expiresAt: null,
  user: null,
};

export type AuthAction =
  | { type: 'auth/signInRequested' }
  | {
      type: 'auth/signInSucceeded';
      payload: { accessToken: string; expiresAt: number; user: UserInfo };
    }
  | { type: 'auth/signInFailed'; payload: { reason: string } }
  | { type: 'auth/signOut' }
  | { type: 'auth/tokenExpired' };

export function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'auth/signInRequested':
      return { ...state, status: 'authenticating' };
    case 'auth/signInSucceeded':
      return {
        status: 'authenticated',
        accessToken: action.payload.accessToken,
        expiresAt: action.payload.expiresAt,
        user: action.payload.user,
      };
    case 'auth/signInFailed':
      return { ...state, status: 'unauthenticated' };
    case 'auth/signOut':
      return initialAuthState;
    case 'auth/tokenExpired':
      return initialAuthState;
    default:
      return state;
  }
}
