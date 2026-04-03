import type { CSSProperties, ReactNode } from 'react';

interface TopBarProps {
  title: string;
  primaryActionLabel: string;
  onPrimaryAction?: () => void;
  localeControl?: ReactNode;
  utilities?: ReactNode;
}

const topBarStyle: CSSProperties = {
  height: '72px',
  minHeight: '72px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 var(--space-xl)',
  borderBottom: '1px solid var(--color-border-subtle)',
  background: 'var(--color-surface-raised)',
};

export function TopBar({ title, primaryActionLabel, onPrimaryAction, localeControl, utilities }: TopBarProps) {
  return (
    <header style={topBarStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--type-heading)', fontWeight: 'var(--weight-semibold)' }}>{title}</h1>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        {utilities}
        {localeControl ?? <div data-locale-slot="pending" />}
        <button
          type="button"
          onClick={onPrimaryAction}
          style={{
            border: 'none',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-accent)',
            color: '#FFFFFF',
            padding: '12px 16px',
            fontSize: 'var(--type-label)',
            fontWeight: 'var(--weight-semibold)',
            cursor: 'pointer',
          }}
        >
          {primaryActionLabel}
        </button>
      </div>
    </header>
  );
}
