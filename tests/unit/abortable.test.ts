import { describe, it, expect } from 'vitest';
import { sleep, throwIfAborted, createAbortError, isAbortError } from '../../src/utils/abortable';

describe('abortable.sleep', () => {
  it('指定ミリ秒後に resolve する', async () => {
    const t0 = performance.now();
    await sleep(30);
    expect(performance.now() - t0).toBeGreaterThanOrEqual(25);
  });

  it('signal が abort されたら即座に AbortError で reject する', async () => {
    const controller = new AbortController();
    const p = sleep(1000, controller.signal);
    controller.abort();
    await expect(p).rejects.toSatisfy(isAbortError);
  });

  it('signal が既に abort 済みなら同期的に reject する', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(sleep(1000, controller.signal)).rejects.toSatisfy(isAbortError);
  });
});

describe('abortable.throwIfAborted', () => {
  it('未 abort なら何も投げない', () => {
    const controller = new AbortController();
    expect(() => throwIfAborted(controller.signal)).not.toThrow();
  });

  it('abort 済みなら AbortError を同期的に投げる', () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => throwIfAborted(controller.signal)).toThrow();
  });
});

describe('abortable.isAbortError', () => {
  it('createAbortError の結果を真と判定する', () => {
    expect(isAbortError(createAbortError())).toBe(true);
  });
  it('通常の Error は偽と判定する', () => {
    expect(isAbortError(new Error('boom'))).toBe(false);
  });
});
