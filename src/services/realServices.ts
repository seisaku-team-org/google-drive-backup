import { createAuthClient } from '../infra/AuthClient';
import { createDriveApiClient } from '../infra/DriveApiClient';
import { createCopyEngine } from '../domain/CopyEngine';
import type { Services } from './ServicesContext';

const BOM = String.fromCharCode(0xfeff);

export function createRealServices(): Services {
  // 念のため BOM（U+FEFF）や前後空白を除去。Secret 設定時の文字化けで OAuth が
  // "invalid_client" エラーになる事象があったため保険を入れる。
  const raw = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
  const clientId = (raw.startsWith(BOM) ? raw.slice(1) : raw).trim();
  if (!clientId) {
    throw new Error(
      'VITE_GOOGLE_CLIENT_ID が未設定です。プロジェクト直下に .env.local を作って Google OAuth クライアント ID を設定してください。',
    );
  }
  const authClient = createAuthClient(clientId);
  const driveApi = createDriveApiClient({
    getToken: () => authClient.getToken(),
    onTokenExpired: () => authClient.notifyTokenExpired(),
  });
  const copyEngine = createCopyEngine({ driveApi });
  return { authClient, driveApi, copyEngine };
}
