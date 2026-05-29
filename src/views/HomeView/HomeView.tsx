import { useEffect, useRef, type ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAuth, useUI } from '../../state/AppContext';
import { useServices } from '../../services/ServicesContext';
import { Button } from '../../components/Button/Button';
import { Spinner } from '../../components/Spinner/Spinner';
import { parseFolderUrl } from '../../domain/UrlParser';
import { fetchFolderPreview } from '../../domain/fetchFolderPreview';
import { startCopyJob } from '../../services/jobRunner';
import { isAbortError } from '../../utils/abortable';
import {
  DriveApiError,
  NoParentWritePermissionError,
  SharedDriveUnsupportedError,
} from '../../infra/driveTypes';
import type { FolderMetadata } from '../../types';
import styles from './HomeView.module.css';

const DEBOUNCE_MS = 500;

/**
 * SCR-002-home（UI 仕様書 §3.2）
 * 自動取得方式（取得ボタン無し）。debounce 500ms。
 * 親階層書込権限なしの場合は「複製を開始」を disabled。
 */
export function HomeView() {
  const dispatch = useAppDispatch();
  const auth = useAuth();
  const { folderInput, folderPreview, folderPreviewError, folderPreviewLoading } = useUI();
  const { driveApi, copyEngine } = useServices();
  const navigate = useNavigate();
  const fetchControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (auth.status === 'unauthenticated') navigate('/login', { replace: true });
  }, [auth.status, navigate]);

  useEffect(() => {
    const trimmed = folderInput.trim();
    if (!trimmed) {
      dispatch({ type: 'ui/folderInputCleared' });
      return;
    }
    fetchControllerRef.current?.abort();
    const controller = new AbortController();
    fetchControllerRef.current = controller;

    const timer = setTimeout(async () => {
      if (controller.signal.aborted) return;
      const parsed = parseFolderUrl(trimmed);
      if (!parsed.ok) {
        dispatch({
          type: 'ui/folderPreviewFailed',
          payload: { message: previewErrorMessage(parsed.reason) },
        });
        return;
      }
      dispatch({ type: 'ui/folderPreviewFetching' });
      try {
        const meta = await fetchFolderPreview(driveApi, parsed.folderId, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        dispatch({ type: 'ui/folderPreviewSucceeded', payload: meta });
      } catch (err) {
        if (controller.signal.aborted || isAbortError(err)) return;
        dispatch({ type: 'ui/folderPreviewFailed', payload: { message: explainError(err) } });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [folderInput, dispatch, driveApi]);

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'ui/folderInputChanged', payload: { value: e.target.value } });
  };

  const handleClear = () => {
    fetchControllerRef.current?.abort();
    dispatch({ type: 'ui/folderInputCleared' });
  };

  const handleStartCopy = () => {
    if (!folderPreview || !folderPreview.canDuplicateHere) return;
    navigate('/progress');
    startCopyJob(copyEngine, folderPreview.id, dispatch, {
      onJobSettled: (outcome) => {
        if (outcome !== 'failed') navigate('/report');
      },
      onFatalError: (message) => {
        dispatch({
          type: 'ui/toastShown',
          payload: { id: `copy-fail-${Date.now()}`, message, level: 'error' },
        });
        navigate('/');
      },
    });
  };

  const canStart = !!folderPreview && folderPreview.canDuplicateHere;

  return (
    <main className={styles.root}>
      <h2 className={styles.heading}>複製したいフォルダを指定してください</h2>
      <p className={styles.lead}>共有 URL を貼り付けると、自動的にフォルダ情報を取得します。</p>

      <label className={styles.label} htmlFor="folder-url">
        フォルダの共有 URL（貼り付けで自動取得）
      </label>
      <div className={styles.inputRow}>
        <input
          id="folder-url"
          type="url"
          className={styles.input}
          placeholder="https://drive.google.com/drive/folders/..."
          value={folderInput}
          onChange={onChange}
          autoComplete="off"
          spellCheck={false}
        />
        {folderPreviewLoading && (
          <span className={styles.loadingIndicator}>
            <Spinner label="取得中" size="sm" />
            <span>取得中…</span>
          </span>
        )}
      </div>

      <div aria-live="polite" className={styles.statusRegion}>
        {folderPreviewError && <p className={styles.error}>{folderPreviewError}</p>}
        {folderPreview && <PreviewCard meta={folderPreview} />}
      </div>

      <div className={styles.actions}>
        <Button tone="primary" onClick={handleStartCopy} disabled={!canStart}>
          複製を開始
        </Button>
        {folderInput && (
          <Button tone="tertiary" onClick={handleClear}>
            キャンセル
          </Button>
        )}
      </div>

      <p className={styles.notice}>※ 元フォルダには変更を加えません（読み取りのみ）</p>
    </main>
  );
}

function PreviewCard({ meta }: { meta: FolderMetadata }) {
  return (
    <section className={styles.preview} aria-label="フォルダプレビュー">
      <p className={styles.previewLabel}>プレビュー</p>
      <h3 className={styles.previewName}>📁 {meta.name}</h3>
      <p className={styles.previewLine}>所在: {meta.pathDisplay}</p>
      <p className={styles.previewLine}>直下のアイテム数: {meta.itemCount} 件</p>
      <p className={styles.previewLine}>
        複製先名（自動）: Copy of {meta.name}{' '}
        <span className={styles.note}>※同名あれば (2) を付与</span>
      </p>
      {meta.canDuplicateHere ? (
        <p className={styles.ok}>✓ 複製可能（親階層への書き込み権限あり）</p>
      ) : (
        <p className={styles.warn}>
          ⚠ 親階層への書き込み権限がありません。
          所有者に親フォルダの編集権限を依頼するか、自分のドライブにコピーを置いてから複製してください。
        </p>
      )}
    </section>
  );
}

function previewErrorMessage(reason: 'INVALID_URL' | 'NOT_A_FOLDER'): string {
  if (reason === 'NOT_A_FOLDER') {
    return 'これはフォルダではありません。フォルダの共有 URL を指定してください。';
  }
  return 'URL からフォルダ ID を読み取れませんでした。共有 URL を貼り付けたかご確認ください。';
}

function explainError(err: unknown): string {
  if (err instanceof SharedDriveUnsupportedError) return err.message;
  if (err instanceof NoParentWritePermissionError) return err.message;
  if (err instanceof DriveApiError) {
    if (err.status === 404) return 'フォルダが見つかりませんでした。URL をご確認ください。';
    if (err.status === 403)
      return 'このフォルダへのアクセス権がありません。所有者に確認してください。';
    if (err.status === 401)
      return '認証が切れました。再度ログインしてください。';
    return `Drive API エラー (${err.status}: ${err.reason})`;
  }
  return err instanceof Error ? err.message : '不明なエラーが発生しました。';
}
