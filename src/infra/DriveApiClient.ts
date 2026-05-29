/**
 * Google Drive API v3 への薄い fetch ラッパー。
 * 機能設計書 §9.3 / §10 に対応。
 *
 * 機能：
 *   - Bearer トークン付与
 *   - 429 / 5xx を指数バックオフでリトライ
 *   - 並列セマフォ（既定 4 並列）
 *   - AbortSignal を全リクエストに伝搬
 *   - 401 検知時は onTokenExpired を発火
 *   - getFolder で driveId 検出 → SharedDriveUnsupportedError
 *   - findAvailableName（連番付与アルゴリズム、機能設計書 §7.5）
 */

import { createSemaphore } from '../utils/semaphore';
import { retry, isDriveRetryable } from '../utils/backoff';
import { isAbortError } from '../utils/abortable';
import {
  DriveApiError,
  SharedDriveUnsupportedError,
  TooManyDuplicatesError,
  MIME,
  type DriveFileResource,
  type DriveListResponse,
} from './driveTypes';

const DRIVE_API_BASE = 'https://www.googleapis.com/drive/v3';
const DEFAULT_FOLDER_FIELDS =
  'id,name,mimeType,parents,driveId,capabilities(canAddChildren,canCopy)';
const DEFAULT_LIST_FIELDS = 'files(id,name,mimeType,parents,driveId),nextPageToken';
const DEFAULT_PAGE_SIZE = 200;
const DEFAULT_CONCURRENCY = 4;
const FIND_NAME_BATCH_LIMIT = 10;
const FIND_NAME_HARD_LIMIT = 99;

export type DriveApiClientConfig = {
  getToken: () => string | null;
  onTokenExpired?: () => void;
  maxConcurrent?: number;
  /** fetch を差し替えるためのフック（テスト用）*/
  fetchImpl?: typeof fetch;
};

export type GetFolderOptions = { fields?: string; signal?: AbortSignal };
export type ListChildrenOptions = {
  pageToken?: string;
  q?: string;
  fields?: string;
  pageSize?: number;
  signal?: AbortSignal;
};
export type SimpleOptions = { signal?: AbortSignal };
export type CopyFileOptions = { newName?: string; signal?: AbortSignal };

export type DriveApiClient = {
  getFolder: (folderId: string, options?: GetFolderOptions) => Promise<DriveFileResource>;
  listChildren: (folderId: string, options?: ListChildrenOptions) => Promise<DriveListResponse>;
  listAllChildren: (folderId: string, options?: SimpleOptions) => Promise<DriveFileResource[]>;
  createFolder: (
    name: string,
    parentId: string,
    options?: SimpleOptions,
  ) => Promise<DriveFileResource>;
  copyFile: (
    fileId: string,
    newParentId: string,
    options?: CopyFileOptions,
  ) => Promise<DriveFileResource>;
  findAvailableName: (
    baseName: string,
    parentId: string,
    options?: SimpleOptions,
  ) => Promise<string>;
};

export function createDriveApiClient(config: DriveApiClientConfig): DriveApiClient {
  const semaphore = createSemaphore(config.maxConcurrent ?? DEFAULT_CONCURRENCY);
  const fetchFn = config.fetchImpl ?? globalThis.fetch.bind(globalThis);

  async function callApi<T>(
    path: string,
    init: RequestInit & { signal?: AbortSignal } = {},
  ): Promise<T> {
    return semaphore.run(() =>
      retry(
        async () => {
          const token = config.getToken();
          if (!token) {
            throw new DriveApiError({ status: 401, reason: 'noToken' });
          }
          const headers = new Headers(init.headers);
          headers.set('Authorization', `Bearer ${token}`);
          if (init.body && !headers.has('Content-Type')) {
            headers.set('Content-Type', 'application/json');
          }
          const res = await fetchFn(`${DRIVE_API_BASE}${path}`, {
            ...init,
            headers,
          });
          if (res.status === 401) {
            config.onTokenExpired?.();
            throw new DriveApiError({ status: 401, reason: 'unauthenticated' });
          }
          if (!res.ok) {
            const reason = await extractReason(res);
            throw new DriveApiError({ status: res.status, reason });
          }
          return (await res.json()) as T;
        },
        { signal: init.signal, isRetryable: isDriveRetryable },
      ),
    );
  }

  async function getFolder(
    folderId: string,
    options: GetFolderOptions = {},
  ): Promise<DriveFileResource> {
    const fields = options.fields ?? DEFAULT_FOLDER_FIELDS;
    const params = new URLSearchParams({ fields, supportsAllDrives: 'true' });
    const result = await callApi<DriveFileResource>(
      `/files/${encodeURIComponent(folderId)}?${params}`,
      { method: 'GET', signal: options.signal },
    );
    if (result.driveId) {
      throw new SharedDriveUnsupportedError();
    }
    return result;
  }

  async function listChildren(
    folderId: string,
    options: ListChildrenOptions = {},
  ): Promise<DriveListResponse> {
    const q = options.q ?? `'${folderId}' in parents and trashed=false`;
    const fields = options.fields ?? DEFAULT_LIST_FIELDS;
    const params = new URLSearchParams({
      q,
      fields,
      pageSize: String(options.pageSize ?? DEFAULT_PAGE_SIZE),
      supportsAllDrives: 'true',
      includeItemsFromAllDrives: 'false',
    });
    if (options.pageToken) params.set('pageToken', options.pageToken);
    return callApi<DriveListResponse>(`/files?${params}`, {
      method: 'GET',
      signal: options.signal,
    });
  }

  async function listAllChildren(
    folderId: string,
    options: SimpleOptions = {},
  ): Promise<DriveFileResource[]> {
    const all: DriveFileResource[] = [];
    let pageToken: string | undefined;
    do {
      const page = await listChildren(folderId, { pageToken, signal: options.signal });
      all.push(...page.files);
      pageToken = page.nextPageToken;
    } while (pageToken);
    return all;
  }

  async function createFolder(
    name: string,
    parentId: string,
    options: SimpleOptions = {},
  ): Promise<DriveFileResource> {
    const params = new URLSearchParams({ fields: 'id,name,parents' });
    return callApi<DriveFileResource>(`/files?${params}`, {
      method: 'POST',
      body: JSON.stringify({
        name,
        mimeType: MIME.folder,
        parents: [parentId],
      }),
      signal: options.signal,
    });
  }

  async function copyFile(
    fileId: string,
    newParentId: string,
    options: CopyFileOptions = {},
  ): Promise<DriveFileResource> {
    const params = new URLSearchParams({ fields: 'id,name,parents' });
    const body: Record<string, unknown> = { parents: [newParentId] };
    if (options.newName) body.name = options.newName;
    return callApi<DriveFileResource>(`/files/${encodeURIComponent(fileId)}/copy?${params}`, {
      method: 'POST',
      body: JSON.stringify(body),
      signal: options.signal,
    });
  }

  async function findAvailableName(
    baseName: string,
    parentId: string,
    options: SimpleOptions = {},
  ): Promise<string> {
    // バッチ 1: baseName と "(2)" 〜 "(10)" を 1 回のクエリで取得
    const candidates = [baseName];
    for (let n = 2; n <= FIND_NAME_BATCH_LIMIT; n++) {
      candidates.push(`${baseName} (${n})`);
    }
    const nameClauses = candidates.map((c) => `name='${escapeQuery(c)}'`).join(' or ');
    const q = `'${parentId}' in parents and trashed=false and (${nameClauses})`;
    const batch = await listChildren(parentId, {
      q,
      fields: 'files(name)',
      pageSize: candidates.length,
      signal: options.signal,
    });
    const existing = new Set(batch.files.map((f) => f.name));
    for (const candidate of candidates) {
      if (!existing.has(candidate)) return candidate;
    }
    // バッチ 2: (11) 以降は逐次照会（実用上ほぼ到達しない）
    for (let n = FIND_NAME_BATCH_LIMIT + 1; n <= FIND_NAME_HARD_LIMIT; n++) {
      const candidate = `${baseName} (${n})`;
      const oneQuery = `'${parentId}' in parents and trashed=false and name='${escapeQuery(candidate)}'`;
      const result = await listChildren(parentId, {
        q: oneQuery,
        fields: 'files(id)',
        pageSize: 1,
        signal: options.signal,
      });
      if (result.files.length === 0) return candidate;
    }
    throw new TooManyDuplicatesError(baseName);
  }

  return {
    getFolder,
    listChildren,
    listAllChildren,
    createFolder,
    copyFile,
    findAvailableName,
  };
}

// ============================================================
// 補助
// ============================================================

/** Drive クエリでの ' とバックスラッシュをエスケープする */
export function escapeQuery(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function extractReason(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const error = (body as { error?: { errors?: Array<{ reason?: string }>; message?: string } })
      .error;
    return error?.errors?.[0]?.reason ?? error?.message ?? res.statusText;
  } catch {
    return res.statusText || 'unknown';
  }
}

/** 互換のため、テスト等から isAbortError を再エクスポート */
export { isAbortError };
