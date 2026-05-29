import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { renderWithProviders } from '../../../tests/test-utils';
import { HomeView } from './HomeView';

const VALID_FOLDER_URL = 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz_-abc';
const NO_PERM_URL =
  'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz_nope11';

describe('HomeView', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('「情報を取得」ボタンを持たない（自動取得方式）', () => {
    renderWithProviders(<HomeView />);
    expect(screen.queryByRole('button', { name: /情報を取得/ })).toBeNull();
  });

  it('初期状態では「複製を開始」は disabled', () => {
    renderWithProviders(<HomeView />);
    expect(screen.getByRole('button', { name: '複製を開始' })).toBeDisabled();
  });

  it('有効な URL を貼り付け → debounce 後に取得が走り、プレビューが出る', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<HomeView />);
    const input = screen.getByLabelText(/フォルダの共有 URL/);
    await user.type(input, VALID_FOLDER_URL);
    // debounce 500ms + モック 200ms を超えて待機
    await waitFor(
      () => {
        expect(screen.getByLabelText('フォルダプレビュー')).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
    expect(screen.getByRole('button', { name: '複製を開始' })).not.toBeDisabled();
  });

  it('書込権限なし URL では「複製を開始」が disabled、警告文が表示される', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<HomeView />);
    const input = screen.getByLabelText(/フォルダの共有 URL/);
    await user.type(input, NO_PERM_URL);
    await waitFor(
      () => {
        expect(screen.getByText(/親階層への書き込み権限がありません/)).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
    expect(screen.getByRole('button', { name: '複製を開始' })).toBeDisabled();
  });

  it('不正な URL では INVALID_URL のエラー文言が出る', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderWithProviders(<HomeView />);
    const input = screen.getByLabelText(/フォルダの共有 URL/);
    await user.type(input, 'not-a-drive-url');
    await waitFor(
      () => {
        expect(screen.getByText(/URL からフォルダ ID を読み取れませんでした/)).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
    expect(screen.getByRole('button', { name: '複製を開始' })).toBeDisabled();
  });
});
