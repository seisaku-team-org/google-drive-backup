import styles from './ProgressBar.module.css';

export type ProgressBarProps = {
  value: number;
  max: number;
  /** スクリーンリーダー用ラベル */
  label?: string;
};

export function ProgressBar({ value, max, label = '進捗' }: ProgressBarProps) {
  const safeMax = Math.max(1, max);
  const safeValue = Math.max(0, Math.min(value, safeMax));
  const percent = Math.round((safeValue / safeMax) * 100);
  return (
    <div
      className={styles.track}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={safeValue}
      aria-valuetext={`${percent}% (${safeValue} / ${safeMax})`}
    >
      <div className={styles.fill} style={{ width: `${percent}%` }} />
    </div>
  );
}
