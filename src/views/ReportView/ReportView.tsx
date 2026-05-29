import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useJob, useRequireAuth } from '../../state/AppContext';
import { Button } from '../../components/Button/Button';
import { buildReport, formatDuration, toPlainText } from '../../domain/ReportBuilder';
import styles from './ReportView.module.css';

/**
 * SCR-004-report（UI 仕様書 §3.4）
 * job と jobItems から Report を組み立てて表示する。
 * Phase D ではモックの jobItems が無いため、progress カウンタから簡易表示。
 */
export function ReportView() {
  useRequireAuth();
  const { currentJob, jobItems } = useJob();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!currentJob) navigate('/', { replace: true });
  }, [currentJob, navigate]);

  const report = useMemo(() => {
    if (!currentJob) return null;
    return buildReport(currentJob, jobItems);
  }, [currentJob, jobItems]);

  if (!currentJob || !report) return null;

  const isCancelled = currentJob.status === 'cancelled';
  const hasSkipped = report.skipCount > 0;
  const heading = isCancelled
    ? '⚠ 複製を中止しました'
    : hasSkipped
      ? '✓ 複製が完了しました（一部スキップあり）'
      : '✓ 複製が完了しました';

  const handleNew = () => {
    dispatch({ type: 'job/reset' });
    dispatch({ type: 'ui/folderInputCleared' });
    navigate('/');
  };

  const handleCopy = async () => {
    const text = toPlainText(report);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      dispatch({
        type: 'ui/toastShown',
        payload: {
          id: `clip-${Date.now()}`,
          message: 'クリップボードへのコピーに失敗しました。',
          level: 'error',
        },
      });
    }
  };

  return (
    <main className={styles.root}>
      <h2 className={isCancelled ? styles.headingCancel : styles.headingSuccess}>{heading}</h2>
      <p className={styles.sub}>
        「{currentJob.destinationName}」
        {hasSkipped ? '（一部スキップあり）' : ''}
      </p>

      <div className={styles.summary}>
        <Card label="成功" value={String(report.successCount)} color="success" />
        <Card label="スキップ" value={String(report.skipCount)} color="warning" />
        <Card label="所要時間" value={formatDuration(report.durationMs)} color="default" />
      </div>

      {report.destinationUrl && (
        <a
          className={styles.destinationLink}
          href={report.destinationUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          <div className={styles.destinationLabel}>複製先フォルダ</div>
          <div className={styles.destinationName}>
            📁 {report.destinationName} — Drive で開く ↗
          </div>
        </a>
      )}

      {report.skippedItems.length > 0 && (
        <section aria-label="スキップしたアイテム">
          <h3 className={styles.subheading}>スキップしたアイテム ({report.skippedItems.length})</h3>
          <ul className={styles.skipList}>
            {report.skippedItems.map((item) => (
              <li key={item.id} className={styles.skipItem}>
                <div className={styles.skipName}>📄 {item.sourceName}</div>
                <div className={styles.skipReason}>{item.errorMessage ?? '(理由不明)'}</div>
                <div className={styles.skipPath}>所在: {item.sourcePath}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className={styles.actions}>
        <Button tone="primary" onClick={handleNew}>
          新しい複製を始める
        </Button>
        <Button tone="tertiary" onClick={handleCopy} aria-live="polite">
          {copied ? 'コピーしました' : 'レポートをコピー'}
        </Button>
      </div>
    </main>
  );
}

function Card({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: 'success' | 'warning' | 'default';
}) {
  const colorClass =
    color === 'success' ? styles.success : color === 'warning' ? styles.warning : '';
  return (
    <div className={styles.card}>
      <div className={styles.cardLabel}>{label}</div>
      <div className={`${styles.cardValue} ${colorClass}`}>{value}</div>
    </div>
  );
}
