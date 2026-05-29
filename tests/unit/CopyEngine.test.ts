import { describe, it, expect, vi } from 'vitest';
import { createCopyEngine } from '../../src/domain/CopyEngine';
import {
  MIME,
  NoParentWritePermissionError,
  SharedDriveUnsupportedError,
  type DriveFileResource,
  type DriveListResponse,
} from '../../src/infra/driveTypes';
import type { DriveApiClient } from '../../src/infra/DriveApiClient';
import { createAbortError } from '../../src/utils/abortable';
import type { CopyJob, CopyJobItem } from '../../src/types';

/** テスト用 fakeApi 作成。フォルダ階層を表現する宣言的な構造から DriveApiClient を生成する */
type FakeNode = {
  id: string;
  name: string;
  kind: 'folder' | 'file';
  parents?: string[];
  driveId?: string;
  capabilities?: { canAddChildren?: boolean; canCopy?: boolean };
  children?: FakeNode[];
  /** copyFile / createFolder がこの子で失敗する HTTP ステータス */
  failureStatus?: number;
};

function buildFakeApi(nodes: FakeNode[]) {
  const map = new Map<string, FakeNode>();
  const childrenOf = new Map<string, FakeNode[]>();

  function walk(node: FakeNode, parent?: string) {
    map.set(node.id, { ...node });
    if (parent) {
      const arr = childrenOf.get(parent) ?? [];
      arr.push(node);
      childrenOf.set(parent, arr);
    }
    for (const c of node.children ?? []) walk(c, node.id);
  }
  for (const n of nodes) walk(n);

  let nextId = 100;

  const api: DriveApiClient = {
    async getFolder(id) {
      const n = map.get(id);
      if (!n) throw new Error(`Not found: ${id}`);
      if (n.driveId) throw new SharedDriveUnsupportedError();
      return toResource(n);
    },
    async listChildren() {
      throw new Error('listChildren is not used in CopyEngine');
    },
    async listAllChildren(id) {
      const ch = childrenOf.get(id) ?? [];
      return ch.map(toResource);
    },
    async createFolder(name, parentId) {
      const n = map.get(parentId);
      if (n?.failureStatus) throw makeApiError(n.failureStatus);
      const id = `created-${++nextId}`;
      return { id, name, mimeType: MIME.folder, parents: [parentId] };
    },
    async copyFile(fileId, newParentId) {
      const n = map.get(fileId);
      if (n?.failureStatus) throw makeApiError(n.failureStatus);
      return {
        id: `copied-${++nextId}`,
        name: n?.name ?? 'unknown',
        mimeType: 'text/plain',
        parents: [newParentId],
      };
    },
    async findAvailableName(baseName) {
      return baseName;
    },
  };
  return api;
}

function toResource(n: FakeNode): DriveFileResource {
  return {
    id: n.id,
    name: n.name,
    mimeType: n.kind === 'folder' ? MIME.folder : 'text/plain',
    parents: n.parents,
    driveId: n.driveId,
    capabilities: n.capabilities,
  };
}

function makeApiError(status: number): Error {
  const e = new Error(`HTTP ${status}`);
  (e as Error & { status?: number }).status = status;
  return e;
}

function makeEngine(api: DriveApiClient) {
  let idCounter = 0;
  return createCopyEngine({
    driveApi: api,
    generateId: () => `id-${++idCounter}`,
    now: () => 1_000_000,
  });
}

/** onJobFinished から CopyJob を取り出す */
function lastFinishedJob(
  spy: ReturnType<typeof vi.fn>,
): { job: CopyJob | undefined; items: CopyJobItem[] } {
  const last = spy.mock.lastCall;
  return {
    job: last?.[0] as CopyJob | undefined,
    items: (last?.[1] as CopyJobItem[]) ?? [],
  };
}

// ============================================================
// F-05: 基本テスト
// ============================================================

describe('CopyEngine — 基本動作', () => {
  it('F-05a: 3 階層の小さな構造を再帰的に複製できる', async () => {
    const api = buildFakeApi([
      {
        id: 'src-root',
        name: 'XXX',
        kind: 'folder',
        parents: ['parent-1'],
        children: [
          { id: 'f1', name: 'a.txt', kind: 'file' },
          {
            id: 'sub1',
            name: 'sub',
            kind: 'folder',
            children: [
              { id: 'f2', name: 'b.txt', kind: 'file' },
              {
                id: 'sub2',
                name: 'sub2',
                kind: 'folder',
                children: [{ id: 'f3', name: 'c.txt', kind: 'file' }],
              },
            ],
          },
        ],
      },
      {
        id: 'parent-1',
        name: '仕事',
        kind: 'folder',
        capabilities: { canAddChildren: true },
      },
    ]);

    const onJobFinished = vi.fn();
    const job = makeEngine(api).start('src-root', { onJobFinished });
    await job.done;

    const { job: finalJob, items } = lastFinishedJob(onJobFinished);
    expect(finalJob?.status).toBe('completed');
    const successItems = items.filter((it) => it.status === 'success');
    // f1, sub1, f2, sub2, f3 の 5 アイテム
    expect(successItems).toHaveLength(5);
  });

  it('F-05b: 403 / 404 はスキップして続行する', async () => {
    const api = buildFakeApi([
      {
        id: 'src-root',
        name: 'XXX',
        kind: 'folder',
        parents: ['parent-1'],
        children: [
          { id: 'f1', name: 'ok.txt', kind: 'file' },
          { id: 'f2', name: 'forbidden.txt', kind: 'file', failureStatus: 403 },
          { id: 'f3', name: 'notfound.txt', kind: 'file', failureStatus: 404 },
          { id: 'f4', name: 'ok2.txt', kind: 'file' },
        ],
      },
      { id: 'parent-1', name: '親', kind: 'folder', capabilities: { canAddChildren: true } },
    ]);

    const onJobFinished = vi.fn();
    const job = makeEngine(api).start('src-root', { onJobFinished });
    await job.done;
    const { job: finalJob, items } = lastFinishedJob(onJobFinished);
    expect(finalJob?.status).toBe('completed');
    expect(items.filter((i) => i.status === 'skipped')).toHaveLength(2);
    expect(items.filter((i) => i.status === 'success')).toHaveLength(2);
  });

  it('F-05c: cancel() で進行中の処理が中断され、aborted で記録される', async () => {
    // listAllChildren が永遠に待機（abort で reject）するモック
    const slowApi: DriveApiClient = {
      async getFolder(id) {
        return {
          id,
          name: 'XXX',
          mimeType: MIME.folder,
          parents: ['root'],
        };
      },
      listChildren: async () => ({ files: [] }) as DriveListResponse,
      listAllChildren: (_id, options) =>
        new Promise<DriveFileResource[]>((_, reject) => {
          options?.signal?.addEventListener('abort', () => reject(createAbortError()));
        }),
      createFolder: async (name, parentId) => ({
        id: 'dst-1',
        name,
        mimeType: MIME.folder,
        parents: [parentId],
      }),
      copyFile: async () => ({ id: 'x', name: 'x', mimeType: 'text/plain' }),
      findAvailableName: async (baseName) => baseName,
    };
    const onJobFinished = vi.fn();
    const job = makeEngine(slowApi).start('src-root', { onJobFinished });
    queueMicrotask(() => job.cancel());
    await job.done;
    const { job: finalJob } = lastFinishedJob(onJobFinished);
    expect(finalJob?.status).toBe('cancelled');
  });

  it('F-05d: onProgress が呼ばれ、total が処理中に増加する', async () => {
    const api = buildFakeApi([
      {
        id: 'src-root',
        name: 'XXX',
        kind: 'folder',
        parents: ['parent-1'],
        children: [
          { id: 'f1', name: 'a', kind: 'file' },
          {
            id: 'sub',
            name: 'sub',
            kind: 'folder',
            children: [
              { id: 'f2', name: 'b', kind: 'file' },
              { id: 'f3', name: 'c', kind: 'file' },
            ],
          },
        ],
      },
      { id: 'parent-1', name: '親', kind: 'folder', capabilities: { canAddChildren: true } },
    ]);
    const totals: number[] = [];
    const job = makeEngine(api).start('src-root', {
      onProgress: (snap) => totals.push(snap.total),
    });
    await job.done;
    // ルート直下 2 (f1, sub) → サブ展開で +2 (f2, f3) = 4
    expect(Math.max(...totals)).toBe(4);
    expect(totals[0]!).toBeLessThan(totals[totals.length - 1]!);
  });
});

// ============================================================
// F-07: 事前バリデーション
// ============================================================

describe('CopyEngine — 事前バリデーション', () => {
  it('F-07a: 共有ドライブのフォルダを指定したら開始失敗', async () => {
    const api = buildFakeApi([
      {
        id: 'src-root',
        name: 'XXX',
        kind: 'folder',
        parents: ['root'],
        driveId: 'shared-1',
      },
    ]);
    const onJobFinished = vi.fn();
    const job = makeEngine(api).start('src-root', { onJobFinished });
    await expect(job.done).rejects.toBeInstanceOf(SharedDriveUnsupportedError);
    expect(lastFinishedJob(onJobFinished).job?.status).toBe('failed');
  });

  it('F-07b: 親階層書込権限なしで開始失敗', async () => {
    const api = buildFakeApi([
      {
        id: 'src-root',
        name: 'XXX',
        kind: 'folder',
        parents: ['readonly-parent'],
      },
      {
        id: 'readonly-parent',
        name: '誰かの',
        kind: 'folder',
        capabilities: { canAddChildren: false },
      },
    ]);
    const onJobFinished = vi.fn();
    const job = makeEngine(api).start('src-root', { onJobFinished });
    await expect(job.done).rejects.toBeInstanceOf(NoParentWritePermissionError);
    expect(lastFinishedJob(onJobFinished).job?.status).toBe('failed');
  });

  it('F-07c: 同名なし → "Copy of XXX" になる', async () => {
    const api = buildFakeApi([
      {
        id: 'src-root',
        name: 'XXX',
        kind: 'folder',
        parents: ['parent-1'],
      },
      { id: 'parent-1', name: '親', kind: 'folder', capabilities: { canAddChildren: true } },
    ]);
    const onDestinationCreated = vi.fn();
    const job = makeEngine(api).start('src-root', { onDestinationCreated });
    await job.done;
    expect(onDestinationCreated).toHaveBeenCalledWith(expect.any(String), 'Copy of XXX');
  });

  it('F-07d: "Copy of XXX" がすでにある → "Copy of XXX (2)" になる', async () => {
    const api = buildFakeApi([
      {
        id: 'src-root',
        name: 'XXX',
        kind: 'folder',
        parents: ['parent-1'],
      },
      { id: 'parent-1', name: '親', kind: 'folder', capabilities: { canAddChildren: true } },
    ]);
    // findAvailableName をオーバーライドして連番付与を模倣
    api.findAvailableName = async (baseName) => `${baseName} (2)`;
    const onDestinationCreated = vi.fn();
    const job = makeEngine(api).start('src-root', { onDestinationCreated });
    await job.done;
    expect(onDestinationCreated).toHaveBeenCalledWith(expect.any(String), 'Copy of XXX (2)');
  });

  it('F-07e: マイドライブ直下フォルダ → 複製先親が "root"、書込権限チェックスキップ', async () => {
    const getFolderSpy = vi.fn(async (id: string) => ({
      id,
      name: 'XXX',
      mimeType: MIME.folder,
      parents: ['root'],
    }));
    const api: DriveApiClient = {
      getFolder: getFolderSpy,
      listChildren: async () => ({ files: [] }) as DriveListResponse,
      listAllChildren: async () => [],
      createFolder: async (name) => ({
        id: 'dst-1',
        name,
        mimeType: MIME.folder,
        parents: ['root'],
      }),
      copyFile: async () => ({ id: 'x', name: 'x', mimeType: 'text/plain' }),
      findAvailableName: async (baseName) => baseName,
    };
    const job = makeEngine(api).start('src-root');
    await job.done;
    // getFolder は元フォルダの 1 回だけ（親階層チェックは skip）
    expect(getFolderSpy).toHaveBeenCalledTimes(1);
  });
});
