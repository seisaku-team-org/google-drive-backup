/**
 * 並列実行数を制限するセマフォ。
 * 機能設計書 §7.2 の「同階層内 4 並列」のために使う。
 */

export type Semaphore = {
  /** 同時実行枠を確保して fn を実行。完了したら枠を返す */
  run: <T>(fn: () => Promise<T>) => Promise<T>;
  /** 現在進行中の数（テスト・デバッグ用） */
  active: () => number;
  /** 待機キューの長さ（同上） */
  waiting: () => number;
};

export function createSemaphore(maxConcurrent: number): Semaphore {
  if (!Number.isInteger(maxConcurrent) || maxConcurrent < 1) {
    throw new Error(`Semaphore: maxConcurrent must be a positive integer, got ${maxConcurrent}`);
  }

  let active = 0;
  const queue: Array<() => void> = [];

  function tryAcquire(resolve: () => void): void {
    if (active < maxConcurrent) {
      active++;
      resolve();
    } else {
      queue.push(resolve);
    }
  }

  function release(): void {
    active--;
    const next = queue.shift();
    if (next) {
      active++;
      next();
    }
  }

  return {
    async run<T>(fn: () => Promise<T>): Promise<T> {
      await new Promise<void>(tryAcquire);
      try {
        return await fn();
      } finally {
        release();
      }
    },
    active: () => active,
    waiting: () => queue.length,
  };
}
