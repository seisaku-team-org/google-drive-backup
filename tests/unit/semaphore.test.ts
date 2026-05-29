import { describe, it, expect } from 'vitest';
import { createSemaphore } from '../../src/utils/semaphore';

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

describe('createSemaphore', () => {
  it('maxConcurrent=0 はエラー', () => {
    expect(() => createSemaphore(0)).toThrow();
    expect(() => createSemaphore(-1)).toThrow();
    expect(() => createSemaphore(1.5)).toThrow();
  });

  it('maxConcurrent を超えて同時実行しない', async () => {
    const sem = createSemaphore(2);
    let inFlight = 0;
    let peak = 0;
    const tasks = Array.from({ length: 5 }, () =>
      sem.run(async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await tick(10);
        inFlight--;
      }),
    );
    await Promise.all(tasks);
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('待機している関数は前のものが終わると順番に走る', async () => {
    const sem = createSemaphore(1);
    const order: number[] = [];
    const p1 = sem.run(async () => {
      await tick(20);
      order.push(1);
    });
    const p2 = sem.run(async () => {
      order.push(2);
    });
    const p3 = sem.run(async () => {
      order.push(3);
    });
    await Promise.all([p1, p2, p3]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('fn の例外は run に伝播し、枠は解放される', async () => {
    const sem = createSemaphore(1);
    await expect(
      sem.run(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(sem.active()).toBe(0);
    // 失敗後でも次の run が動くことを確認
    await expect(sem.run(async () => 'ok')).resolves.toBe('ok');
  });

  it('fn の戻り値を返す', async () => {
    const sem = createSemaphore(2);
    await expect(sem.run(async () => 42)).resolves.toBe(42);
  });
});
