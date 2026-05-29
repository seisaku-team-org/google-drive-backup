/**
 * Google Identity Services（GIS）のトークンクライアントを薄くラップする。
 * 機能設計書 §9.1 / 技術仕様 §6.2 に対応。
 *
 * 設計上の方針:
 *   - アクセストークンはこのモジュール内のクロージャ変数のみに保持する
 *     （localStorage / sessionStorage / Cookie には書かない）
 *   - 401 検知時の通知は onTokenExpired コールバック経由
 */

import type { UserInfo } from '../types';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'email',
  'profile',
].join(' ');

const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

// ============================================================
// 型定義（GIS の最小サブセット）
// ============================================================

type GisTokenResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
};

type GisErrorResponse = {
  type: string;
  message?: string;
};

type GisTokenClient = {
  requestAccessToken: (override?: { prompt?: string }) => void;
};

type GisOauth2 = {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    callback: (response: GisTokenResponse) => void;
    error_callback?: (error: GisErrorResponse) => void;
  }) => GisTokenClient;
  revoke?: (token: string, done?: () => void) => void;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: GisOauth2;
      };
    };
  }
}

// ============================================================
// AuthClient
// ============================================================

export type SignInResult = {
  accessToken: string;
  expiresAt: number;
  user: UserInfo;
};

export type AuthClient = {
  signIn: () => Promise<SignInResult>;
  signOut: () => void;
  getToken: () => string | null;
  isExpired: () => boolean;
  /** 401 検知 / 期限切れ通知。返り値は unsubscribe 関数 */
  onTokenExpired: (handler: () => void) => () => void;
  /** 401 を受けたときに呼ぶ（DriveApiClient から）*/
  notifyTokenExpired: () => void;
};

export function createAuthClient(clientId: string): AuthClient {
  let cachedToken: string | null = null;
  let cachedExpiresAt: number | null = null;
  const expiredHandlers = new Set<() => void>();

  function signOut(): void {
    cachedToken = null;
    cachedExpiresAt = null;
  }

  function isExpired(): boolean {
    return cachedExpiresAt === null || Date.now() >= cachedExpiresAt;
  }

  function notifyTokenExpired(): void {
    cachedToken = null;
    cachedExpiresAt = null;
    for (const h of expiredHandlers) h();
  }

  async function signIn(): Promise<SignInResult> {
    const oauth2 = await waitForGoogleIdentity();
    const accessToken = await new Promise<{ token: string; expiresIn: number }>(
      (resolve, reject) => {
        const client = oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPES,
          callback: (res) => {
            if (res.error || !res.access_token) {
              reject(new Error(res.error ?? 'OAuth token request failed'));
              return;
            }
            resolve({ token: res.access_token, expiresIn: res.expires_in ?? 3600 });
          },
          error_callback: (err) => {
            reject(new Error(err.message ?? err.type ?? 'OAuth error'));
          },
        });
        client.requestAccessToken({ prompt: '' });
      },
    );
    cachedToken = accessToken.token;
    cachedExpiresAt = Date.now() + accessToken.expiresIn * 1000;
    const user = await fetchUserInfo(cachedToken);
    return { accessToken: cachedToken, expiresAt: cachedExpiresAt, user };
  }

  return {
    signIn,
    signOut,
    getToken: () => cachedToken,
    isExpired,
    onTokenExpired: (handler) => {
      expiredHandlers.add(handler);
      return () => expiredHandlers.delete(handler);
    },
    notifyTokenExpired,
  };
}

// ============================================================
// 補助関数
// ============================================================

async function waitForGoogleIdentity(timeoutMs = 10_000): Promise<GisOauth2> {
  if (typeof window === 'undefined') {
    throw new Error('Google Identity Services is only available in the browser');
  }
  if (window.google?.accounts?.oauth2) {
    return window.google.accounts.oauth2 as GisOauth2;
  }
  // gsi/client が defer 読込なので少し待つ
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      const g = window.google;
      if (g?.accounts?.oauth2) {
        clearInterval(timer);
        resolve(g.accounts.oauth2 as GisOauth2);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(timer);
        reject(new Error('Google Identity Services script did not load within timeout'));
      }
    }, 100);
  });
}

async function fetchUserInfo(accessToken: string): Promise<UserInfo> {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch user info: ${res.status}`);
  }
  const data = (await res.json()) as { sub?: string; email?: string; name?: string };
  if (!data.sub || !data.email) {
    throw new Error('userinfo response missing required fields');
  }
  return {
    id: data.sub,
    email: data.email,
    name: data.name ?? data.email,
  };
}
