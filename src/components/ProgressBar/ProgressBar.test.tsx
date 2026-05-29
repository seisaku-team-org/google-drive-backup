import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('role=progressbar と aria-valuenow が設定される', () => {
    render(<ProgressBar value={3} max={10} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemax', '10');
    expect(bar).toHaveAttribute('aria-valuetext', '30% (3 / 10)');
  });

  it('value > max でも max を超えない', () => {
    render(<ProgressBar value={20} max={10} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '10');
  });

  it('value < 0 は 0 にクランプ', () => {
    render(<ProgressBar value={-5} max={10} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('max=0 でも壊れない', () => {
    render(<ProgressBar value={0} max={0} />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '1');
  });
});
