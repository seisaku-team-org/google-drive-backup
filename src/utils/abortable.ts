/**
 * AbortSignal 対応の小さなヘルパー群。
 * 待機や非同期処理を「中止」に応答可能にする。
 */

/** ブラウザ・Node 共通の AbortError を生成する */
export function createAbortError(reason?: string): DOMException {
  return new DOMException(reason ?? 'Aborted', 'AbortError');
}

/** 値が AbortError か */
export function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  if (err && typeof err === 'object' && 'name' in err) {
    return (err as { name?: unknown }).name === 'AbortError';
  }
  return false;
}

/**
 * 指定ミリ秒待機する。signal が abort されたら即座に AbortError で reject する。
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      reject(createAbortError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * signal が既に abort されていたら同期的に throw する。
 * ループの先頭などで「中止確認」する際に使う。
 */
export function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw createAbortError();
}
