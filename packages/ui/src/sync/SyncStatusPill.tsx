import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';

interface SyncStatusPillProps {
  label: string;
  tone?: 'muted' | 'positive' | 'warning';
  unreadCount?: number;
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

export function SyncStatusPill({ label, tone = 'muted', unreadCount = 0, onClick }: SyncStatusPillProps) {
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
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        ...toneMap[tone],
      }}
    >
      {label || t('sync.statusLocalOnly')}
      {unreadCount > 0 ? (
        <span
          style={{
            minWidth: 20,
            height: 20,
            padding: '0 6px',
            borderRadius: 999,
            background: 'var(--color-accent)',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            lineHeight: 1,
          }}
        >
          {unreadCount}
        </span>
      ) : null}
    </button>
  );
}
