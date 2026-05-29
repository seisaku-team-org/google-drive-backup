import { createAuthClient } from '../infra/AuthClient';
import { createDriveApiClient } from '../infra/DriveApiClient';
import { createCopyEngine } from '../domain/CopyEngine';
import type { Services } from './ServicesContext';

export function createRealServices(): Services {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
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
