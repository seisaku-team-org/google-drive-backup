/**
 * 指数バックオフによるリトライ。
 * 機能設計書 §8.2 の仕様：
 *   初回 1s + ジッタ 0〜500ms ／ 以降 ×2 ＋ ジッタ ／ 上限 30s ／ 最大 5 回
 */

import { isAbortError, sleep, throwIfAborted } from './abortable';

export type RetryOptions = {
  maxRetries?: number;
  initialMs?: number;
  maxMs?: number;
  /** リトライ対象かを判定する関数。デフォルトは isAbortError 以外すべて */
  isRetryable?: (err: unknown) => boolean;
  /** 待機・abort 用 */
  signal?: AbortSignal;
  /** 乱数注入（テスト用） */
  randomFn?: () => number;
};

export const DEFAULT_RETRY: Required<
  Omit<RetryOptions, 'isRetryable' | 'signal' | 'randomFn'>
> = {
  maxRetries: 5,
  initialMs: 1000,
  maxMs: 30_000,
};

/**
 * fn を最大 maxRetries+1 回実行する（初回 + リトライ）。
 * リトライ前に指数バックオフ ＋ ジッタで待機する。
 * signal が abort されたら待機を即座に中断し AbortError を throw する。
 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxRetries = options.maxRetries ?? DEFAULT_RETRY.maxRetries;
  const initialMs = options.initialMs ?? DEFAULT_RETRY.initialMs;
  const maxMs = options.maxMs ?? DEFAULT_RETRY.maxMs;
  const isRetryable = options.isRetryable ?? defaultIsRetryable;
  const random = options.randomFn ?? Math.random;

  let lastErr: unknown;
  let waitMs = initialMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    throwIfAborted(options.signal);
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (isAbortError(err)) throw err;
      if (attempt >= maxRetries || !isRetryable(err)) throw err;

      const jitter = Math.floor(random() * 500);
      await sleep(Math.min(waitMs + jitter, maxMs), options.signal);
      waitMs = Math.min(waitMs * 2, maxMs);
    }
  }

  /* istanbul ignore next */
  throw lastErr;
}

/** 既定: AbortError 以外はすべてリトライ可とみなす（呼び出し側で絞るのが望ましい）*/
function defaultIsRetryable(err: unknown): boolean {
  return !isAbortError(err);
}

/** Drive API 標準のリトライ判定: 429 / 5xx / ネットワーク例外 */
export function isDriveRetryable(err: unknown): boolean {
  if (isAbortError(err)) return false;
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status?: unknown }).status;
    if (typeof status === 'number') {
      return status === 429 || (status >= 500 && status < 600);
    }
  }
  // fetch のネットワーク例外（TypeError）
  if (err instanceof TypeError) return true;
  return false;
}
