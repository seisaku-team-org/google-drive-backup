import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  it('children を描画する', () => {
    render(<Button>クリック</Button>);
    expect(screen.getByRole('button', { name: 'クリック' })).toBeInTheDocument();
  });

  it('disabled / busy の両方でクリックを受け付けない', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <Button disabled onClick={onClick}>
        x
      </Button>,
    );
    await user.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();

    rerender(
      <Button busy onClick={onClick}>
        x
      </Button>,
    );
    await user.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('busy のときに aria-busy=true', () => {
    render(<Button busy>x</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });

  it('クリックすると onClick が呼ばれる', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>x</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
