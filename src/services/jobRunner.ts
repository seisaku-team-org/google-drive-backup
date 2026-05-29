/**
 * CopyEngine の起動・キャンセルと、コールバックで状態ストアへの dispatch を中継する。
 * UI からは startCopyJob / cancelCurrentJob の 2 関数を呼ぶだけになる。
 */

import type { Dispatch } from 'react';
import type { Action } from '../state/AppContext';
import type { CopyEngine, RunningJob } from '../domain/CopyEngine';
import { isAbortError } from '../utils/abortable';

let currentRunningJob: RunningJob | null = null;

export type StartJobOptions = {
  /** 完了/中止/失敗のいずれかで呼ばれる（フォーカス移動や navigate に使う）*/
  onJobSettled?: (outcome: 'completed' | 'cancelled' | 'failed') => void;
  /** 致命的エラーの内容を UI に伝えたい場合 */
  onFatalError?: (message: string) => void;
};

export function startCopyJob(
  copyEngine: CopyEngine,
  sourceFolderId: string,
  dispatch: Dispatch<Action>,
  options: StartJobOptions = {},
): void {
  // 念のため既存ジョブを中断
  currentRunningJob?.cancel();

  const handle = copyEngine.start(sourceFolderId, {
    onJobStarted: (job) => dispatch({ type: 'job/started', payload: job }),
    onDestinationCreated: (destinationFolderId, destinationName) =>
      dispatch({
        type: 'job/destinationCreated',
        payload: { destinationFolderId, destinationName },
      }),
    onItemStarted: (item) => dispatch({ type: 'job/itemAdded', payload: item }),
    onItemFinished: (item) =>
      dispatch({ type: 'job/itemUpdated', payload: { itemId: item.id, updates: item } }),
    onProgress: (snapshot) => dispatch({ type: 'job/progressUpdated', payload: snapshot }),
    onJobFinished: (job) => {
      dispatch({
        type: 'job/finished',
        payload: { status: job.status, finishedAt: job.finishedAt ?? Date.now() },
      });
    },
  });

  currentRunningJob = handle;
  handle.done
    .then(() => {
      // 中止 or 完了。状態は onJobFinished 経由で既に反映されている
      options.onJobSettled?.('completed');
    })
    .catch((err: unknown) => {
      // 致命的エラー（共有ドライブ / 書込権限なし / 認証失効など）
      if (isAbortError(err)) {
        options.onJobSettled?.('cancelled');
        return;
      }
      const message = err instanceof Error ? err.message : '不明なエラーが発生しました';
      options.onFatalError?.(message);
      options.onJobSettled?.('failed');
    })
    .finally(() => {
      if (currentRunningJob === handle) currentRunningJob = null;
    });
}

export function cancelCurrentJob(): void {
  currentRunningJob?.cancel();
}

export function hasRunningJob(): boolean {
  return currentRunningJob !== null;
}
