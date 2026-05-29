/**
 * CopyEngine — フォルダ複製の中核ロジック。
 * 機能設計書 §7 / §8 / §9.4 に対応。
 *
 * 設計：
 *   - 内部に AbortController を 1 個保持。全 driveApi 呼び出しに signal を渡す
 *   - 事前バリデーション 3 ステップ（共有ドライブ判定 / 親階層書込権限 / findAvailableName）
 *   - **2 フェーズ進捗**:
 *       Phase 1 (counting): 元フォルダの全アイテムを BFS 列挙してキャッシュ + total を確定
 *       Phase 2 (copying):  キャッシュを使って再帰的に複製
 *   - 個別アイテムのエラーはスキップして続行。AbortError のみ中断扱い
 *   - 完了/中止/失敗で onJobFinished を発火し done Promise を解決
 */

import { isAbortError, throwIfAborted } from '../utils/abortable';
import {
  MIME,
  NoParentWritePermissionError,
  type DriveFileResource,
} from '../infra/driveTypes';
import type { DriveApiClient } from '../infra/DriveApiClient';
import type {
  CopyJob,
  CopyJobItem,
  CopyJobItemStatus,
  JobPhase,
  ProgressSnapshot,
} from '../types';

const ROOT_PARENT = 'root';

export type CopyEngineCallbacks = {
  onJobStarted?: (job: CopyJob) => void;
  /** 複製先フォルダ作成完了時。job.destinationFolderId 確定 */
  onDestinationCreated?: (destinationFolderId: string, destinationName: string) => void;
  onItemStarted?: (item: CopyJobItem) => void;
  onItemFinished?: (item: CopyJobItem) => void;
  onProgress?: (snapshot: ProgressSnapshot) => void;
  /** 'completed' / 'cancelled' / 'failed' いずれかで呼ばれる */
  onJobFinished?: (job: CopyJob, items: CopyJobItem[]) => void;
};

export type CopyEngineDependencies = {
  driveApi: DriveApiClient;
  /** UUID 生成（テストで固定可能にする）。既定: crypto.randomUUID */
  generateId?: () => string;
  /** 現在時刻 ms（テストで固定可能にする）。既定: Date.now */
  now?: () => number;
};

export type RunningJob = {
  /** 進行中のすべての fetch を AbortController で中断する */
  cancel: () => void;
  /**
   * 完了/中止のいずれかで resolve。
   * 致命的エラー（共有ドライブ / 書込権限なし / 認証失効など）で reject。
   */
  done: Promise<void>;
};

export type CopyEngine = {
  start: (sourceFolderId: string, callbacks?: CopyEngineCallbacks) => RunningJob;
};

export function createCopyEngine(deps: CopyEngineDependencies): CopyEngine {
  const generateId =
    deps.generateId ??
    (() =>
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`);
  const now = deps.now ?? (() => Date.now());

  return {
    start(sourceFolderId, callbacks = {}) {
      const controller = new AbortController();
      const done = runJob(
        sourceFolderId,
        deps.driveApi,
        callbacks,
        controller.signal,
        generateId,
        now,
      );
      return {
        cancel: () => controller.abort(),
        done,
      };
    },
  };
}

type QueueEntry = { srcId: string; dstId: string; path: string };

async function runJob(
  sourceFolderId: string,
  driveApi: DriveApiClient,
  callbacks: CopyEngineCallbacks,
  signal: AbortSignal,
  generateId: () => string,
  now: () => number,
): Promise<void> {
  const job: CopyJob = {
    id: generateId(),
    sourceFolderId,
    destinationFolderId: null,
    destinationName: '',
    status: 'preparing',
    startedAt: now(),
    finishedAt: null,
    cancelRequested: false,
  };
  const items: CopyJobItem[] = [];
  const itemIndex = new Map<string, number>();
  const progress: ProgressSnapshot = {
    phase: 'counting',
    total: 0,
    done: 0,
    currentItemName: null,
    successCount: 0,
    skipCount: 0,
    abortedCount: 0,
  };

  const emitProgress = () => callbacks.onProgress?.({ ...progress });

  const recordItem = (item: CopyJobItem): void => {
    itemIndex.set(item.id, items.length);
    items.push(item);
    callbacks.onItemStarted?.(item);
  };

  const updateItem = (itemId: string, updates: Partial<CopyJobItem>): void => {
    const idx = itemIndex.get(itemId);
    if (idx === undefined) return;
    const prev = items[idx];
    if (!prev) return;
    const updated: CopyJobItem = { ...prev, ...updates };
    items[idx] = updated;
    callbacks.onItemFinished?.(updated);
  };

  // 列挙キャッシュ: folderId -> 直下の子要素一覧。counting と copying で共有
  const childrenCache = new Map<string, DriveFileResource[]>();

  let fatalError: unknown = null;
  try {
    callbacks.onJobStarted?.(job);

    // (1) 元フォルダ取得 — driveApi.getFolder が driveId 検出時に SharedDriveUnsupportedError を投げる
    const src = await driveApi.getFolder(sourceFolderId, { signal });

    // (2) 複製先親階層の決定
    const destinationParent =
      src.parents && src.parents.length > 0 ? (src.parents[0] ?? ROOT_PARENT) : ROOT_PARENT;

    // (3) 親階層書込権限の事前チェック（root は自分のマイドライブなので常に書込可）
    if (destinationParent !== ROOT_PARENT) {
      const parent = await driveApi.getFolder(destinationParent, {
        fields: 'id,capabilities',
        signal,
      });
      if (!parent.capabilities?.canAddChildren) {
        throw new NoParentWritePermissionError();
      }
    }

    // (4) 連番付与で衝突しない名前を決定
    const destinationName = await driveApi.findAvailableName(
      `Copy of ${src.name}`,
      destinationParent,
      { signal },
    );

    // ============================================================
    // Phase 1: 集計（BFS で全アイテムを列挙してキャッシュ + total 確定）
    // ============================================================
    progress.phase = 'counting';
    progress.currentItemName = src.name;
    emitProgress();
    await countAllItems(sourceFolderId, src.name, driveApi, childrenCache, progress, emitProgress, signal);

    // (5) 複製先フォルダ作成（集計後に作る → ユーザー中止時に空フォルダが残らない）
    const dst = await driveApi.createFolder(destinationName, destinationParent, { signal });
    job.destinationFolderId = dst.id;
    job.destinationName = destinationName;
    job.status = 'running';
    callbacks.onDestinationCreated?.(dst.id, destinationName);

    // ============================================================
    // Phase 2: 複製（キャッシュした children を使い、API 呼び出しを増やさない）
    // ============================================================
    progress.phase = 'copying';
    progress.currentItemName = null;
    emitProgress();

    const queue: QueueEntry[] = [{ srcId: sourceFolderId, dstId: dst.id, path: src.name }];

    while (queue.length > 0) {
      if (signal.aborted) break;
      const current = queue.shift();
      if (!current) break;

      const children = childrenCache.get(current.srcId) ?? [];

      // 同階層の子要素を並列で処理（実効並列度は DriveApiClient のセマフォで 4 に制限）
      const results = await Promise.allSettled(
        children.map((child) =>
          processChild({
            child,
            parent: current,
            driveApi,
            signal,
            queue,
            progress,
            recordItem,
            updateItem,
            emitProgress,
            generateId,
            jobId: job.id,
          }),
        ),
      );

      if (results.some((r) => r.status === 'rejected' && isAbortError(r.reason))) break;
    }

    job.status = signal.aborted ? 'cancelled' : 'completed';
  } catch (err) {
    if (isAbortError(err)) {
      job.status = 'cancelled';
    } else {
      job.status = 'failed';
      fatalError = err;
    }
  } finally {
    job.finishedAt = now();
    progress.currentItemName = null;
    emitProgress();
    callbacks.onJobFinished?.(job, items);
  }

  if (fatalError) throw fatalError;
}

// ============================================================
// Phase 1: 全アイテム列挙
// ============================================================

async function countAllItems(
  sourceFolderId: string,
  sourceName: string,
  driveApi: DriveApiClient,
  childrenCache: Map<string, DriveFileResource[]>,
  progress: ProgressSnapshot,
  emitProgress: () => void,
  signal: AbortSignal,
): Promise<void> {
  const queue: Array<{ id: string; name: string }> = [{ id: sourceFolderId, name: sourceName }];
  while (queue.length > 0) {
    throwIfAborted(signal);
    const current = queue.shift();
    if (!current) break;

    progress.currentItemName = current.name;
    emitProgress();

    const children = await driveApi.listAllChildren(current.id, { signal });
    childrenCache.set(current.id, children);
    progress.total += children.length;
    emitProgress();

    for (const child of children) {
      if (child.mimeType === MIME.folder) {
        queue.push({ id: child.id, name: child.name });
      }
    }
  }
}

// ============================================================
// Phase 2: 個別アイテム処理
// ============================================================

type ProcessChildArgs = {
  child: DriveFileResource;
  parent: QueueEntry;
  driveApi: DriveApiClient;
  signal: AbortSignal;
  queue: QueueEntry[];
  progress: ProgressSnapshot;
  recordItem: (item: CopyJobItem) => void;
  updateItem: (itemId: string, updates: Partial<CopyJobItem>) => void;
  emitProgress: () => void;
  generateId: () => string;
  jobId: string;
};

async function processChild(args: ProcessChildArgs): Promise<void> {
  const {
    child,
    parent,
    driveApi,
    signal,
    queue,
    progress,
    recordItem,
    updateItem,
    emitProgress,
    generateId,
    jobId,
  } = args;

  const kind: CopyJobItem['kind'] = child.mimeType === MIME.folder ? 'folder' : 'file';
  const item: CopyJobItem = {
    id: generateId(),
    jobId,
    sourceId: child.id,
    sourceName: child.name,
    sourcePath: parent.path,
    kind,
    status: 'in_progress',
    errorMessage: null,
  };
  recordItem(item);
  progress.currentItemName = child.name;
  emitProgress();

  const finalize = (status: CopyJobItemStatus, errorMessage: string | null = null): void => {
    progress.done += 1;
    if (status === 'success') progress.successCount += 1;
    else if (status === 'skipped') progress.skipCount += 1;
    else if (status === 'aborted') progress.abortedCount += 1;
    updateItem(item.id, { status, errorMessage });
    emitProgress();
  };

  try {
    throwIfAborted(signal);
    if (kind === 'folder') {
      const newFolder = await driveApi.createFolder(child.name, parent.dstId, { signal });
      queue.push({
        srcId: child.id,
        dstId: newFolder.id,
        path: `${parent.path}/${child.name}`,
      });
    } else {
      await driveApi.copyFile(child.id, parent.dstId, { signal });
    }
    finalize('success');
  } catch (err) {
    if (isAbortError(err)) {
      finalize('aborted', 'ユーザーによる中止');
      throw err;
    }
    const message = err instanceof Error ? err.message : String(err);
    finalize('skipped', message);
  }
}

// JobPhase 型を再エクスポート（呼び出し側の便宜）
export type { JobPhase };
