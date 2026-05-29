import { createAuthClient } from '../infra/AuthClient';
import { createDriveApiClient } from '../infra/DriveApiClient';
import { createCopyEngine } from '../domain/CopyEngine';
import type { Services } from './ServicesContext';

const BOM = String.fromCharCode(0xfeff);

/** Secret 設定時の文字化けで BOM が混入し OAuth が "invalid_client" になった事象があるため保険 */
function normalize(raw: string | undefined): string {
  if (!raw) return '';
  return (raw.startsWith(BOM) ? raw.slice(1) : raw).trim();
}

export function createRealServices(): Services {
  const clientId = normalize(import.meta.env.VITE_GOOGLE_CLIENT_ID);
  const clientSecret = normalize(import.meta.env.VITE_GOOGLE_CLIENT_SECRET);
  if (!clientId) {
    throw new Error(
      'VITE_GOOGLE_CLIENT_ID が未設定です。プロジェクト直下に .env.local を作って Google OAuth クライアント ID を設定してください。',
    );
  }
  const authClient = createAuthClient(clientId, clientSecret || undefined);
  const driveApi = createDriveApiClient({
    getToken: () => authClient.getToken(),
    onTokenExpired: () => authClient.notifyTokenExpired(),
  });
  const copyEngine = createCopyEngine({ driveApi });
  return { authClient, driveApi, copyEngine };
}
