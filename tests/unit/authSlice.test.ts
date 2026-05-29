import { describe, it, expect } from 'vitest';
import { authReducer, initialAuthState } from '../../src/state/authSlice';

describe('authReducer', () => {
  it('signInRequested で status を authenticating にする', () => {
    const next = authReducer(initialAuthState, { type: 'auth/signInRequested' });
    expect(next.status).toBe('authenticating');
  });

  it('signInSucceeded でトークン・ユーザーをセットし authenticated になる', () => {
    const next = authReducer(initialAuthState, {
      type: 'auth/signInSucceeded',
      payload: {
        accessToken: 'tk',
        expiresAt: 9999,
        user: { id: 'u1', email: 'u@example.com', name: 'User' },
      },
    });
    expect(next.status).toBe('authenticated');
    expect(next.accessToken).toBe('tk');
    expect(next.user?.email).toBe('u@example.com');
  });

  it('signOut で初期状態に戻る', () => {
    const authed = {
      status: 'authenticated' as const,
      accessToken: 'tk',
      expiresAt: 1,
      user: { id: 'u1', email: 'u@x', name: 'U' },
    };
    expect(authReducer(authed, { type: 'auth/signOut' })).toEqual(initialAuthState);
  });

  it('tokenExpired も初期状態に戻る', () => {
    const authed = {
      status: 'authenticated' as const,
      accessToken: 'tk',
      expiresAt: 1,
      user: { id: 'u1', email: 'u@x', name: 'U' },
    };
    expect(authReducer(authed, { type: 'auth/tokenExpired' })).toEqual(initialAuthState);
  });

  it('未知の action は state をそのまま返す', () => {
    // @ts-expect-error 意図的に未知の action を投げて default 分岐を確認
    expect(authReducer(initialAuthState, { type: 'unknown/action' })).toBe(initialAuthState);
  });
});
