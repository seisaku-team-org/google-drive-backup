import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '../../../tests/test-utils';
import { LoginView } from './LoginView';

describe('LoginView', () => {
  it('ウェルカム見出しとログインボタンが描画される', () => {
    renderWithProviders(<LoginView />);
    expect(screen.getByText('ようこそ')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Google でログイン' })).toBeInTheDocument();
  });

  it('「元フォルダを書き換えません」の安全性注記が見える', () => {
    renderWithProviders(<LoginView />);
    expect(screen.getByText(/書き換えません/)).toBeInTheDocument();
  });
});
