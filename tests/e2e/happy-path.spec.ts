import { test, expect } from '@playwright/test';

/**
 * E2E ハッピーパス（スタブモード）
 * UI 仕様書 §2.1 の主フロー: ログイン → URL貼付 → プレビュー → 複製開始 → レポート
 *
 * スタブモードは window.__USE_STUB__ で有効化される。
 * stubServices が folderId のパターンで挙動を振り分け、本物の Drive API には繋がらない。
 */

const VALID_FOLDER_URL =
  'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz_-happy';

test.describe('Happy path (stub mode)', () => {
  test.beforeEach(async ({ page }) => {
    // App ブート前にスタブフラグを注入
    await page.addInitScript(() => {
      (window as Window & { __USE_STUB__?: boolean }).__USE_STUB__ = true;
    });
  });

  test('ログイン → URL貼付 → プレビュー → 複製 → レポート の単線フロー', async ({ page }) => {
    await page.goto('/');

    // 未認証ならログイン画面にリダイレクトされる
    await expect(page.getByRole('heading', { name: 'ようこそ' })).toBeVisible();
    await page.getByRole('button', { name: 'Google でログイン' }).click();

    // 認証成功 → ホーム画面
    await expect(
      page.getByRole('heading', { name: '複製したいフォルダを指定してください' }),
    ).toBeVisible({ timeout: 5000 });

    // URL 貼り付け → 自動取得 → プレビュー表示
    await page.getByLabel(/フォルダの共有 URL/).fill(VALID_FOLDER_URL);
    await expect(page.getByLabel('フォルダプレビュー')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('✓ 複製可能（親階層への書き込み権限あり）')).toBeVisible();

    // 「複製を開始」が活性化
    const startButton = page.getByRole('button', { name: '複製を開始' });
    await expect(startButton).toBeEnabled();
    await startButton.click();

    // 進捗画面（2 フェーズ: 集計中 → 複製中）
    // 「集計中…」または「複製中…」のいずれかが見えれば OK
    await expect(
      page.getByRole('heading', { name: /集計中…|複製中…/ }),
    ).toBeVisible({ timeout: 5000 });

    // レポート画面（数件規模のスタブなので 15 秒以内に完了する想定）
    await expect(page.getByText('✓ 複製が完了しました')).toBeVisible({ timeout: 15_000 });
    // 複製先リンクが見える
    await expect(page.getByText(/📁 Copy of スタブフォルダ/)).toBeVisible();
    // 成功カードに 1 以上
    await expect(page.getByText('成功').first()).toBeVisible();
  });

  test('Invalid な URL は INVALID_URL のエラー文言を表示する', async ({ page }) => {
    await page.addInitScript(() => {
      // 既に認証済み状態でスタートしたいが、今回はログイン画面から
    });
    await page.goto('/');
    await page.getByRole('button', { name: 'Google でログイン' }).click();
    await expect(
      page.getByRole('heading', { name: '複製したいフォルダを指定してください' }),
    ).toBeVisible();
    await page.getByLabel(/フォルダの共有 URL/).fill('not-a-drive-url');
    await expect(
      page.getByText(/URL からフォルダ ID を読み取れませんでした/),
    ).toBeVisible({ timeout: 3000 });
    await expect(page.getByRole('button', { name: '複製を開始' })).toBeDisabled();
  });
});
