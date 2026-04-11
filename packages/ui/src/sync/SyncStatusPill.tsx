import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

interface SyncStatusPillProps {
  label: string;
  tone?: 'muted' | 'positive' | 'warning';
  onClick?: () => void;
}

const toneMap: Record<NonNullable<SyncStatusPillProps['tone']>, CSSProperties> = {
  muted: {
    background: 'rgba(231, 222, 208, 0.55)',
    color: 'var(--color-text-primary)',
    borderColor: 'var(--color-border-subtle)',
  },
  positive: {
    background: 'rgba(90, 156, 124, 0.18)',
    color: 'var(--color-accent-strong)',
    borderColor: 'rgba(90, 156, 124, 0.35)',
  },
  warning: {
    background: 'rgba(180, 107, 53, 0.14)',
    color: '#8f4e1d',
    borderColor: 'rgba(180, 107, 53, 0.3)',
  },
};

export function SyncStatusPill({ label, tone = 'muted', onClick }: SyncStatusPillProps) {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: '1px solid',
        borderRadius: '999px',
        padding: '8px 12px',
        fontSize: 'var(--type-label)',
        fontWeight: 'var(--weight-semibold)',
        cursor: 'pointer',
        ...toneMap[tone],
      }}
    >
      {label || t('sync.statusLocalOnly')}
    </button>
  );
}
