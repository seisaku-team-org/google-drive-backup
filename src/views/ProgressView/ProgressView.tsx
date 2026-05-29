import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useJob, useRequireAuth } from '../../state/AppContext';
import { Button } from '../../components/Button/Button';
import { Spinner } from '../../components/Spinner/Spinner';
import { ProgressBar } from '../../components/ProgressBar/ProgressBar';
import styles from './ProgressView.module.css';

/**
 * SCR-003-progress（UI 仕様書 §3.3）
 * 2 フェーズ表示：
 *   - counting: 「集計中… X 件発見」スピナー + 件数
 *   - copying: 進捗バー（正確な %）+ カウンター
 */
export function ProgressView() {
  useRequireAuth();
  const { currentJob, progress } = useJob();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    if (!currentJob) navigate('/', { replace: true });
  }, [currentJob, navigate]);

  if (!currentJob || !progress) return null;

  const handleCancel = () => {
    dispatch({
      type: 'ui/modalOpened',
      payload: {
        kind: 'cancel-confirm',
        title: '複製を中止しますか？',
        body: '進行中の処理を速やかに中断します。途中まで作成された「Copy of …」フォルダおよび複製済みのアイテムは Drive に残ります。',
        confirmLabel: '中止する',
        cancelLabel: '続行',
        confirmTone: 'danger',
      },
    });
  };

  const isCancelling = currentJob.status === 'cancelling';

  if (progress.phase === 'counting') {
    return (
      <main className={styles.root}>
        <h2 className={styles.heading}>集計中…</h2>
        <p className={styles.sub}>
          複製するアイテムを数えています。サブフォルダを含めた合計件数が確定するまでお待ちください。
        </p>

        <div className={styles.countingBlock}>
          <Spinner label="集計中" />
          <div className={styles.countingText}>
            <strong>{progress.total} 件</strong> 発見
          </div>
        </div>

        {progress.currentItemName && (
          <>
            <p className={styles.currentLabel}>集計中のフォルダ</p>
            <p className={styles.currentItem} aria-live="polite">
              📁 {progress.currentItemName}
            </p>
          </>
        )}

        <div className={styles.actions}>
          <Button tone="danger" onClick={handleCancel} disabled={isCancelling}>
            {isCancelling ? '中止しています…' : '中止'}
          </Button>
        </div>

        <p className={styles.notice}>
          ※ 大規模なフォルダの場合は数秒〜数十秒かかることがあります
        </p>
      </main>
    );
  }

  // phase === 'copying'
  const remaining = Math.max(0, progress.total - progress.done);

  return (
    <main className={styles.root}>
      <h2 className={styles.heading}>複製中…</h2>
      <p className={styles.sub}>
        「{currentJob.destinationName.replace(/^Copy of /, '') || '元フォルダ'}」を「
        {currentJob.destinationName || '(複製先準備中)'}」に複製しています。
      </p>

      <div className={styles.progressRow}>
        <ProgressBar value={progress.done} max={Math.max(1, progress.total)} />
        <div className={styles.progressLabel}>
          {progress.total > 0
            ? `${Math.round((progress.done / progress.total) * 100)}% (${progress.done} / ${progress.total})`
            : '準備中…'}
        </div>
      </div>

      <p className={styles.currentLabel}>処理中のアイテム</p>
      <p className={styles.currentItem} aria-live="polite">
        📄 {progress.currentItemName ?? '—'}
      </p>

      <div className={styles.counters}>
        <Counter label="成功" value={progress.successCount} color="success" />
        <Counter label="スキップ" value={progress.skipCount} color="warning" />
        <Counter label="残り" value={remaining} color="default" />
      </div>

      <div className={styles.actions}>
        <Button tone="danger" onClick={handleCancel} disabled={isCancelling}>
          {isCancelling ? '中止しています…' : '中止'}
        </Button>
      </div>

      <p className={styles.notice}>※ 画面を閉じても、Drive 側の処理は継続できません（再実行が必要）</p>
    </main>
  );
}

function Counter({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: 'success' | 'warning' | 'default';
}) {
  const colorClass =
    color === 'success' ? styles.success : color === 'warning' ? styles.warning : '';
  return (
    <div className={styles.counter}>
      <div className={styles.counterLabel}>{label}</div>
      <div className={`${styles.counterValue} ${colorClass}`}>{value}</div>
    </div>
  );
}
