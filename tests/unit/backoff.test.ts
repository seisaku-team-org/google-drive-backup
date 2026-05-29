import { describe, it, expect, vi } from 'vitest';
import { retry, isDriveRetryable } from '../../src/utils/backoff';
import { isAbortError } from '../../src/utils/abortable';

describe('retry', () => {
  it('初回成功なら fn は 1 回しか呼ばれない', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await retry(fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('リトライ可能なエラーは最大 maxRetries+1 回試行する', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(
      retry(fn, {
        maxRetries: 3,
        initialMs: 1,
        maxMs: 2,
        randomFn: () => 0,
        isRetryable: () => true,
      }),
    ).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(4); // 初回 + 3 リトライ
  });

  it('isRetryable=false ならリトライしない', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('do-not-retry'));
    await expect(
      retry(fn, { isRetryable: () => false, initialMs: 1, randomFn: () => 0 }),
    ).rejects.toThrow('do-not-retry');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('signal が abort されたら待機中でも即座に AbortError を投げる', async () => {
    const controller = new AbortController();
    const fn = vi.fn().mockRejectedValue(new Error('retry me'));
    const p = retry(fn, {
      maxRetries: 5,
      initialMs: 10_000, // 長い待機にする
      isRetryable: () => true,
      signal: controller.signal,
      randomFn: () => 0,
    });
    // 少し待ってから abort
    queueMicrotask(() => controller.abort());
    await expect(p).rejects.toSatisfy(isAbortError);
  });

  it('AbortError はリトライ対象に含めず即座に伝播する', async () => {
    const fn = vi.fn().mockImplementation(async () => {
      throw new DOMException('Aborted', 'AbortError');
    });
    await expect(retry(fn, { initialMs: 1, randomFn: () => 0 })).rejects.toSatisfy(isAbortError);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('isDriveRetryable', () => {
  it('429 はリトライ対象', () => {
    expect(isDriveRetryable({ status: 429 })).toBe(true);
  });
  it('5xx はリトライ対象', () => {
    expect(isDriveRetryable({ status: 503 })).toBe(true);
  });
  it('4xx (429除く) はリトライ対象外', () => {
    expect(isDriveRetryable({ status: 403 })).toBe(false);
    expect(isDriveRetryable({ status: 404 })).toBe(false);
  });
  it('TypeError（ネットワーク例外）はリトライ対象', () => {
    expect(isDriveRetryable(new TypeError('Failed to fetch'))).toBe(true);
  });
  it('AbortError はリトライ対象外', () => {
    expect(isDriveRetryable(new DOMException('Aborted', 'AbortError'))).toBe(false);
  });
});
