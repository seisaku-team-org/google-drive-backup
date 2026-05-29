import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonTone = 'primary' | 'secondary' | 'tertiary' | 'danger';

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  tone?: ButtonTone;
  busy?: boolean;
  children: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { tone = 'primary', busy = false, disabled, className, type = 'button', children, ...rest },
  ref,
) {
  const isDisabled = disabled || busy;
  const classes = [styles.button, styles[tone], busy ? styles.busy : '', className ?? '']
    .filter(Boolean)
    .join(' ');
  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={isDisabled}
      aria-busy={busy || undefined}
      {...rest}
    >
      {busy ? <span className={styles.spinner} aria-hidden="true" /> : null}
      <span className={styles.label}>{children}</span>
    </button>
  );
});
