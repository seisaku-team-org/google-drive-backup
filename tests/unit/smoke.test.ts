import { describe, it, expect } from 'vitest';

describe('Smoke test', () => {
  it('Vitest が起動して基本のアサーションが通る', () => {
    expect(1 + 1).toBe(2);
  });
});
