/**
 * テスト・E2E・開発用のスタブサービス。
 * folderId の末尾パターンで挙動を振り分け、UI 仕様書 §3.2.4 の状態を再現する。
 *   末尾 'nope'   → 親階層書込権限なし
 *   末尾 '404'    → Not Found
 *   末尾 'shared' → 共有ドライブ拒否
 *   その他         → 正常（小さなフォルダ階層を模擬）
 */

import { createCopyEngine } from '../domain/CopyEngine';
import type { AuthClient } from '../infra/AuthClient';
import type {
  DriveApiClient,
  GetFolderOptions,
  ListChildrenOptions,
  SimpleOptions,
  CopyFileOptions,
} from '../infra/DriveApiClient';
import {
  MIME,
  DriveApiError,
  SharedDriveUnsupportedError,
  type DriveFileResource,
  type DriveListResponse,
} from '../infra/driveTypes';
import { sleep } from '../utils/abortable';
import type { Services } from './ServicesContext';

const STUB_LATENCY_MS = 150;

export function createStubServices(): Services {
  let token: string | null = null;
  const tokenExpiredHandlers = new Set<() => void>();

  const authClient: AuthClient = {
    async signIn() {
      await sleep(300);
      const tk = `stub-token-${Date.now()}`;
      token = tk;
      return {
        accessToken: tk,
        expiresAt: Date.now() + 3600_000,
        user: { id: 'stub-user', email: 'stub@example.com', name: 'Stub User' },
      };
    },
    signOut: () => {
      token = null;
    },
    getToken: () => token,
    isExpired: () => false,
    onTokenExpired: (handler) => {
      tokenExpiredHandlers.add(handler);
      return () => tokenExpiredHandlers.delete(handler);
    },
    notifyTokenExpired: () => {
      token = null;
      for (const h of tokenExpiredHandlers) h();
    },
  };

  const driveApi = createStubDriveApi();
  const copyEngine = createCopyEngine({ driveApi });

  return { authClient, driveApi, copyEngine };
}

// ============================================================
// StubDriveApi（folderId パターンで挙動を振り分ける）
// ============================================================

type StubChildren = { files: DriveFileResource[]; folders: DriveFileResource[] };

function createStubDriveApi(): DriveApiClient {
  // 内部「ファイルシステム」: id → 子要素マップ。getFolder/listAllChildren で参照する
  const childrenMap = new Map<string, StubChildren>();
  let nextId = 1000;
  const allocId = (prefix: string) => `${prefix}-${++nextId}`;

  // 「正常」フォルダのデフォルト構造（サブフォルダ 1 + ファイル 4）
  function ensureNormalChildren(folderId: string): StubChildren {
    let entry = childrenMap.get(folderId);
    if (entry) return entry;
    const subId = allocId('sub');
    entry = {
      folders: [{ id: subId, name: 'サブフォルダ', mimeType: MIME.folder, parents: [folderId] }],
      files: [
        { id: allocId('file'), name: '議事録.docx', mimeType: 'text/plain', parents: [folderId] },
        { id: allocId('file'), name: '見積.xlsx', mimeType: 'text/plain', parents: [folderId] },
        { id: allocId('file'), name: '報告書.pdf', mimeType: 'application/pdf', parents: [folderId] },
        { id: allocId('file'), name: 'メモ.txt', mimeType: 'text/plain', parents: [folderId] },
      ],
    };
    childrenMap.set(folderId, entry);
    // サブフォルダの中身（2 ファイル）
    childrenMap.set(subId, {
      folders: [],
      files: [
        { id: allocId('file'), name: 'sub-1.txt', mimeType: 'text/plain', parents: [subId] },
        { id: allocId('file'), name: 'sub-2.txt', mimeType: 'text/plain', parents: [subId] },
      ],
    });
    return entry;
  }

  async function getFolder(
    folderId: string,
    options: GetFolderOptions = {},
  ): Promise<DriveFileResource> {
    await sleep(STUB_LATENCY_MS, options.signal);
    if (folderId.includes('shared')) throw new SharedDriveUnsupportedError();
    if (folderId.includes('404'))
      throw new DriveApiError({ status: 404, reason: 'notFound' });

    const isNoPerm = folderId.includes('nope');
    // 仮想的に root を親とする
    return {
      id: folderId,
      name: `スタブフォルダ_${folderId.slice(-6)}`,
      mimeType: MIME.folder,
      parents: isNoPerm ? ['readonly-parent'] : ['root'],
      capabilities: { canAddChildren: true, canCopy: true },
    };
  }

  async function listChildren(
    folderId: string,
    options: ListChildrenOptions = {},
  ): Promise<DriveListResponse> {
    // findAvailableName 用のクエリも来るため、name= を含む q なら空 list を返す
    if (options.q && options.q.includes("name='")) {
      return { files: [] };
    }
    await sleep(50, options.signal);
    const entry = ensureNormalChildren(folderId);
    return { files: [...entry.folders, ...entry.files] };
  }

  async function listAllChildren(
    folderId: string,
    options: SimpleOptions = {},
  ): Promise<DriveFileResource[]> {
    await sleep(50, options.signal);
    const entry = ensureNormalChildren(folderId);
    return [...entry.folders, ...entry.files];
  }

  async function createFolder(
    name: string,
    parentId: string,
    options: SimpleOptions = {},
  ): Promise<DriveFileResource> {
    await sleep(80, options.signal);
    const id = allocId('created');
    return { id, name, mimeType: MIME.folder, parents: [parentId] };
  }

  async function copyFile(
    fileId: string,
    newParentId: string,
    options: CopyFileOptions = {},
  ): Promise<DriveFileResource> {
    await sleep(80, options.signal);
    return {
      id: allocId('copy'),
      name: options.newName ?? `Copy of ${fileId}`,
      mimeType: 'text/plain',
      parents: [newParentId],
    };
  }

  async function findAvailableName(
    baseName: string,
    _parentId: string,
    options: SimpleOptions = {},
  ): Promise<string> {
    await sleep(30, options.signal);
    return baseName;
  }

  // 親階層フォルダのレスポンスを差し替える特殊ケース
  async function getFolderWithPermissionOverride(
    folderId: string,
    options: GetFolderOptions = {},
  ): Promise<DriveFileResource> {
    if (folderId === 'readonly-parent') {
      await sleep(STUB_LATENCY_MS, options.signal);
      return {
        id: folderId,
        name: '誰かのフォルダ',
        mimeType: MIME.folder,
        capabilities: { canAddChildren: false, canCopy: false },
      };
    }
    if (folderId === 'root') {
      // root は通常 getFolder で問い合わせない（fetchFolderPreview / CopyEngine がスキップする）が念のため
      return {
        id: 'root',
        name: 'マイドライブ',
        mimeType: MIME.folder,
        capabilities: { canAddChildren: true, canCopy: true },
      };
    }
    return getFolder(folderId, options);
  }

  return {
    getFolder: getFolderWithPermissionOverride,
    listChildren,
    listAllChildren,
    createFolder,
    copyFile,
    findAvailableName,
  };
}
