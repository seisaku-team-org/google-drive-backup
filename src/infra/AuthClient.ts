/**
 * Google OAuth 2.0 を **PKCE 認可コードフロー（リダイレクト型）**で実装する AuthClient。
 *
 * 設計上の経緯：
 *   1. 当初は GIS Token Client（popup 型 implicit flow）→ Chrome の COOP で
 *      popup → opener の postMessage が阻まれ token が届かない問題発生。
 *   2. 続いて redirect 型 implicit flow（response_type=token）に切り替え → Google が
 *      新規 OAuth クライアントに対し implicit flow を禁止しており invalid_client エラー。
 *   3. 本実装：PKCE + 認可コードフロー（response_type=code）。
 *
 * フロー：
 *   1. signIn() で code_verifier を生成し sessionStorage に保存、SHA256 した code_challenge を
 *      クエリに付けて Google の認可エンドポイントへリダイレクト。Promise は事実上未解決。
 *   2. ユーザーは Google で認証・同意。
 *   3. Google が redirect_uri へ `?code=...&state=...` 付きでリダイレクト。
 *   4. App 起動時に consumeRedirectCallback() が URL クエリを読み取り、code と
 *      code_verifier を Google のトークンエンドポイントに POST して access_token を取得。
 *      PKCE により client_secret は不要。
 *
 * セキュリティ：
 *   - state パラメータで CSRF を防御
 *   - PKCE で code 横取り攻撃を防御
 *   - access_token は cachedToken（クロージャ変数）のみ保持
 *   - リダイレクト後すぐ history.replaceState で URL から code を消去
 */

import type { UserInfo } from '../types';

const SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'openid',
  'email',
  'profile',
].join(' ');

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const STATE_KEY = '__oauth_state';
const VERIFIER_KEY = '__oauth_verifier';

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
  onTokenExpired: (handler: () => void) => () => void;
  notifyTokenExpired: () => void;
  consumeRedirectCallback: () => Promise<SignInResult | null>;
};

export function createAuthClient(clientId: string, clientSecret?: string): AuthClient {
  let cachedToken: string | null = null;
  let cachedExpiresAt: number | null = null;
  const expiredHandlers = new Set<() => void>();

  function getRedirectUri(): string {
    return window.location.origin + window.location.pathname;
  }

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
    const state = randomString(32);
    const codeVerifier = randomString(64);
    const codeChallenge = await sha256Base64Url(codeVerifier);
    sessionStorage.setItem(STATE_KEY, state);
    sessionStorage.setItem(VERIFIER_KEY, codeVerifier);

    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'code',
      scope: SCOPES,
      redirect_uri: getRedirectUri(),
      state,
      include_granted_scopes: 'true',
      prompt: 'consent',
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });
    window.location.href = `${AUTH_URL}?${params.toString()}`;
    // ブラウザが遷移するため Promise は事実上未解決
    return new Promise<SignInResult>(() => {});
  }

  async function consumeRedirectCallback(): Promise<SignInResult | null> {
    // PKCE では code が URL クエリ文字列に来る（hash ではなく）
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    const oauthError = url.searchParams.get('error');

    if (oauthError) {
      const description = url.searchParams.get('error_description') ?? '';
      console.error('[AuthClient] OAuth error:', oauthError, description);
      // URL から error を消す
      window.history.replaceState({}, '', window.location.pathname);
      throw new Error(`OAuth エラー: ${oauthError}${description ? ` (${description})` : ''}`);
    }

    if (!code) return null;

    const savedState = sessionStorage.getItem(STATE_KEY);
    const codeVerifier = sessionStorage.getItem(VERIFIER_KEY);
    sessionStorage.removeItem(STATE_KEY);
    sessionStorage.removeItem(VERIFIER_KEY);

    // 先に URL を掃除（リロード防止）
    window.history.replaceState({}, '', window.location.pathname);

    if (state !== savedState) {
      throw new Error('[AuthClient] OAuth state mismatch — possible CSRF');
    }
    if (!codeVerifier) {
      throw new Error('[AuthClient] OAuth code verifier missing — session might have been cleared');
    }

    // code を access_token と交換
    // Web Application 型 OAuth クライアントは client_secret が必須（PKCE 併用でも）
    const tokenBody: Record<string, string> = {
      client_id: clientId,
      code,
      code_verifier: codeVerifier,
      grant_type: 'authorization_code',
      redirect_uri: getRedirectUri(),
    };
    if (clientSecret) {
      tokenBody.client_secret = clientSecret;
    }
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(tokenBody).toString(),
    });

    if (!tokenRes.ok) {
      const errorText = await tokenRes.text();
      console.error('[AuthClient] Token exchange failed:', tokenRes.status, errorText);
      throw new Error(`トークン交換失敗: ${tokenRes.status} ${errorText}`);
    }

    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      expires_in?: number;
      token_type?: string;
      id_token?: string;
      refresh_token?: string;
    };

    if (!tokenData.access_token) {
      throw new Error('Token response missing access_token');
    }

    cachedToken = tokenData.access_token;
    cachedExpiresAt = Date.now() + (tokenData.expires_in ?? 3600) * 1000;
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
    consumeRedirectCallback,
  };
}

// ============================================================
// 補助関数（PKCE）
// ============================================================

function randomString(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(hash));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
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
