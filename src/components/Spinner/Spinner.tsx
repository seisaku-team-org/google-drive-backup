import styles from './Spinner.module.css';

export type SpinnerProps = {
  /** 補助テキスト（スクリーンリーダー向け）*/
  label?: string;
  size?: 'sm' | 'md';
};

export function Spinner({ label = '読込中', size = 'md' }: SpinnerProps) {
  const className = `${styles.spinner} ${size === 'sm' ? styles.sm : styles.md}`;
  return (
    <span role="status" className={className}>
      <span className={styles.visuallyHidden}>{label}</span>
    </span>
  );
}
