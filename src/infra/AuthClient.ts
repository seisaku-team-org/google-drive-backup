/**
 * Google OAuth 2.0 を **リダイレクト型 implicit フロー**で実装する AuthClient。
 *
 * 設計上の経緯：
 *   当初は GIS Token Client（popup 型）を使っていたが、GitHub Pages のようにレスポンスヘッダーで
 *   Cross-Origin-Opener-Policy を制御できない環境では、popup → opener の postMessage が
 *   ブラウザ（Chrome）の COOP 既定挙動で阻まれて token が opener に届かない事象が発生した。
 *   そのため popup を使わず、フルページのリダイレクトで OAuth を完走する方式に切り替えた。
 *
 * フロー：
 *   signIn() → window.location を Google の認可エンドポイントへ向ける（Promise は永久に未解決）
 *   ↓ Google で認証・同意
 *   ↓ Google が redirect_uri へ `#access_token=...&state=...` 付きで遷移
 *   App 起動時に consumeRedirectCallback() が URL を見て token を回収し、URL を掃除
 *
 * セキュリティ：
 *   - state パラメータで CSRF を防御（sessionStorage で一時保持し検証後削除）
 *   - access_token は cachedToken（クロージャ変数）のみ保持。
 *     リダイレクト中の URL 上には一時的に token が乗るが、回収後すぐ history.replaceState で消す。
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
const USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';
const STATE_KEY = '__oauth_state';

export type SignInResult = {
  accessToken: string;
  expiresAt: number;
  user: UserInfo;
};

export type AuthClient = {
  /** Google の認可ページへリダイレクト。返り値の Promise は基本的に解決しない（ブラウザが遷移する） */
  signIn: () => Promise<SignInResult>;
  signOut: () => void;
  getToken: () => string | null;
  isExpired: () => boolean;
  onTokenExpired: (handler: () => void) => () => void;
  notifyTokenExpired: () => void;
  /**
   * App 起動時に呼ぶ。URL hash に access_token があれば回収して返す。
   * 何もなければ null を返す。回収後は URL から token を消す。
   */
  consumeRedirectCallback: () => Promise<SignInResult | null>;
};

export function createAuthClient(clientId: string): AuthClient {
  let cachedToken: string | null = null;
  let cachedExpiresAt: number | null = null;
  const expiredHandlers = new Set<() => void>();

  function getRedirectUri(): string {
    // Cloud Console で承認済みのリダイレクト URI と完全一致させる必要があるため pathname まで含める
    return window.location.origin + window.location.pathname;
  }

  function generateState(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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
    const state = generateState();
    sessionStorage.setItem(STATE_KEY, state);
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: 'token',
      scope: SCOPES,
      redirect_uri: getRedirectUri(),
      state,
      include_granted_scopes: 'true',
      prompt: 'consent',
    });
    window.location.href = `${AUTH_URL}?${params.toString()}`;
    // ブラウザが遷移するため、この Promise は事実上 resolve しない
    return new Promise<SignInResult>(() => {});
  }

  async function consumeRedirectCallback(): Promise<SignInResult | null> {
    const hash = window.location.hash;
    if (!hash || !hash.includes('access_token=')) return null;

    // hash は '#access_token=...&state=...' か '#/access_token=...' の可能性がある
    const cleanHash = hash.replace(/^#\/?/, '');
    const params = new URLSearchParams(cleanHash);
    const token = params.get('access_token');
    const expiresInRaw = params.get('expires_in');
    const state = params.get('state');

    if (!token) return null;

    // state 検証（CSRF 対策）
    const savedState = sessionStorage.getItem(STATE_KEY);
    sessionStorage.removeItem(STATE_KEY);
    if (state !== savedState) {
      console.error('[AuthClient] OAuth state mismatch — possible CSRF');
      // URL は消しておく
      window.history.replaceState({}, '', window.location.pathname);
      return null;
    }

    // URL から token を消す（履歴・リロード防止）
    window.history.replaceState({}, '', window.location.pathname);

    const expiresIn = parseInt(expiresInRaw ?? '3600', 10);
    cachedToken = token;
    cachedExpiresAt = Date.now() + expiresIn * 1000;
    const user = await fetchUserInfo(token);
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
