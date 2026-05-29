import { describe, it, expect, vi } from 'vitest';
import { createDriveApiClient, escapeQuery } from '../../src/infra/DriveApiClient';
import { DriveApiError, SharedDriveUnsupportedError } from '../../src/infra/driveTypes';
import { isAbortError } from '../../src/utils/abortable';

type FetchMock = ReturnType<typeof vi.fn>;

function buildClient(fetchImpl: FetchMock, opts: { token?: string | null } = {}) {
  const onTokenExpired = vi.fn();
  const client = createDriveApiClient({
    getToken: () => (opts.token === undefined ? 'tk' : opts.token),
    onTokenExpired,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    maxConcurrent: 4,
  });
  return { client, onTokenExpired };
}

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }): Response {
  return new Response(JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
}

describe('DriveApiClient.getFolder', () => {
  it('Bearer ヘッダーと fields クエリ付きでリクエストし、結果を返す', async () => {
    const fetchImpl: FetchMock = vi.fn(async () =>
      jsonResponse({
        id: 'f1',
        name: 'XXX',
        mimeType: 'application/vnd.google-apps.folder',
        parents: ['root'],
      }),
    );
    const { client } = buildClient(fetchImpl);
    const result = await client.getFolder('f1');
    expect(result.id).toBe('f1');
    const url = fetchImpl.mock.calls[0]?.[0] as string;
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(url).toContain('/files/f1');
    expect(url).toContain('capabilities');
    expect(url).toContain('driveId');
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe('Bearer tk');
  });

  it('driveId 付きレスポンスは SharedDriveUnsupportedError を投げる', async () => {
    const fetchImpl: FetchMock = vi.fn(async () =>
      jsonResponse({
        id: 'f1',
        name: 'XXX',
        mimeType: 'application/vnd.google-apps.folder',
        driveId: 'sd-1',
      }),
    );
    const { client } = buildClient(fetchImpl);
    await expect(client.getFolder('f1')).rejects.toBeInstanceOf(SharedDriveUnsupportedError);
  });

  it('401 で onTokenExpired を呼び、DriveApiError を投げる', async () => {
    const fetchImpl: FetchMock = vi.fn(async () => jsonResponse({}, { status: 401 }));
    const { client, onTokenExpired } = buildClient(fetchImpl);
    await expect(client.getFolder('f1')).rejects.toBeInstanceOf(DriveApiError);
    expect(onTokenExpired).toHaveBeenCalled();
  });

  it('トークン未取得時は 401 として fetch を呼ばずに失敗する', async () => {
    const fetchImpl: FetchMock = vi.fn();
    const { client } = buildClient(fetchImpl, { token: null });
    await expect(client.getFolder('f1')).rejects.toBeInstanceOf(DriveApiError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('signal abort で進行中の fetch を中断し AbortError を投げる', async () => {
    const fetchImpl: FetchMock = vi.fn(
      (_url, init) =>
        new Promise<Response>((_, reject) => {
          const signal = (init as RequestInit).signal as AbortSignal | undefined;
          signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          );
        }),
    );
    const { client } = buildClient(fetchImpl);
    const controller = new AbortController();
    const p = client.getFolder('f1', { signal: controller.signal });
    queueMicrotask(() => controller.abort());
    await expect(p).rejects.toSatisfy(isAbortError);
  });
});

describe('DriveApiClient.listChildren', () => {
  it('q とページサイズが正しく付与される', async () => {
    const fetchImpl: FetchMock = vi.fn(async () => jsonResponse({ files: [] }));
    const { client } = buildClient(fetchImpl);
    await client.listChildren('p1');
    const url = fetchImpl.mock.calls[0]?.[0] as string;
    // URLSearchParams は ' を %27、= を %3D、空白を + にエンコードする
    expect(url).toContain('%27p1%27+in+parents');
    expect(url).toContain('trashed%3Dfalse');
    expect(url).toContain('pageSize=200');
  });
});

describe('DriveApiClient.createFolder', () => {
  it('POST + parents + mimeType=folder の body', async () => {
    const fetchImpl: FetchMock = vi.fn(async () => jsonResponse({ id: 'new', name: 'X' }));
    const { client } = buildClient(fetchImpl);
    await client.createFolder('X', 'parent-1');
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string);
    expect(body.name).toBe('X');
    expect(body.mimeType).toBe('application/vnd.google-apps.folder');
    expect(body.parents).toEqual(['parent-1']);
  });
});

describe('DriveApiClient.copyFile', () => {
  it('POST /files/{id}/copy + parents body', async () => {
    const fetchImpl: FetchMock = vi.fn(async () => jsonResponse({ id: 'new', name: 'A' }));
    const { client } = buildClient(fetchImpl);
    await client.copyFile('src-1', 'dst-parent');
    const url = fetchImpl.mock.calls[0]?.[0] as string;
    expect(url).toContain('/files/src-1/copy');
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.parents).toEqual(['dst-parent']);
  });
});

describe('DriveApiClient.findAvailableName', () => {
  it('衝突無し → baseName を返す', async () => {
    const fetchImpl: FetchMock = vi.fn(async () => jsonResponse({ files: [] }));
    const { client } = buildClient(fetchImpl);
    await expect(client.findAvailableName('Copy of A', 'p1')).resolves.toBe('Copy of A');
    expect(fetchImpl).toHaveBeenCalledTimes(1); // バッチ 1 のみ
  });

  it('baseName だけ衝突 → (2) を返す', async () => {
    const fetchImpl: FetchMock = vi.fn(async () =>
      jsonResponse({ files: [{ name: 'Copy of A' }] }),
    );
    const { client } = buildClient(fetchImpl);
    await expect(client.findAvailableName('Copy of A', 'p1')).resolves.toBe('Copy of A (2)');
  });

  it('baseName と (2) まで衝突 → (3) を返す', async () => {
    const fetchImpl: FetchMock = vi.fn(async () =>
      jsonResponse({ files: [{ name: 'Copy of A' }, { name: 'Copy of A (2)' }] }),
    );
    const { client } = buildClient(fetchImpl);
    await expect(client.findAvailableName('Copy of A', 'p1')).resolves.toBe('Copy of A (3)');
  });

  it('1〜10 全てが埋まっている → 11 を確認しに行く', async () => {
    const allTen = Array.from({ length: 10 }, (_, i) =>
      i === 0 ? { name: 'Copy of A' } : { name: `Copy of A (${i + 1})` },
    );
    let call = 0;
    const fetchImpl: FetchMock = vi.fn(async (_url, _init) => {
      call += 1;
      if (call === 1) return jsonResponse({ files: allTen });
      // 2 回目以降: 11 番目は空き
      return jsonResponse({ files: [] });
    });
    const { client } = buildClient(fetchImpl);
    await expect(client.findAvailableName('Copy of A', 'p1')).resolves.toBe('Copy of A (11)');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('DriveApiClient: misc', () => {
  it('listAllChildren は nextPageToken を辿って全件取得する', async () => {
    let call = 0;
    const fetchImpl: FetchMock = vi.fn(async () => {
      call += 1;
      if (call === 1)
        return jsonResponse({ files: [{ id: 'a' }, { id: 'b' }], nextPageToken: 't2' });
      return jsonResponse({ files: [{ id: 'c' }] });
    });
    const { client } = buildClient(fetchImpl);
    const result = await client.listAllChildren('p1');
    expect(result).toHaveLength(3);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('escapeQuery が ' + ' とバックスラッシュをエスケープする', () => {
    expect(escapeQuery("Copy of 'X'")).toBe("Copy of \\'X\\'");
    expect(escapeQuery('a\\b')).toBe('a\\\\b');
  });
});
