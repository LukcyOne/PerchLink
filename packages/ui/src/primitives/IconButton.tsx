import type { ButtonHTMLAttributes } from 'react';

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  ariaLabel: string;
}

export function IconButton({ ariaLabel, style, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      {...props}
      type={type}
      aria-label={ariaLabel}
      title={ariaLabel}
      style={{
        width: '44px',
        height: '44px',
        minWidth: '44px',
        minHeight: '44px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--color-border-subtle)',
        background: 'var(--color-surface-raised)',
        color: 'var(--color-text-primary)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'var(--motion-nav)',
        ...style,
      }}
    />
  );
}
