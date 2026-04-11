import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '@perchlink/i18n';

interface TopBarProps {
  title: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  utilities?: ReactNode;
  leadingControl?: ReactNode;
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

const primaryActionFallback = {
  'zh-CN': '添加书签',
  'en-US': 'Add Bookmark',
} as const;

export function TopBar({ title, primaryActionLabel, onPrimaryAction, utilities, leadingControl }: TopBarProps) {
  const { t } = useTranslation();
  const { locale, setLocale } = useLocale();
  const resolvedPrimaryAction = primaryActionLabel ?? t('shell.primaryCta', { defaultValue: primaryActionFallback[locale] });

  return (
    <header style={topBarStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        {leadingControl}
        <h1 style={{ margin: 0, fontSize: 'var(--type-heading)', fontWeight: 'var(--weight-semibold)' }}>{title}</h1>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        {utilities}
        <div style={{ display: 'inline-flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
          {(['zh-CN', 'en-US'] as const).map((option) => {
            const isActive = option === locale;

            return (
              <button
                key={option}
                type="button"
                onClick={() => void setLocale(option)}
                style={{
                  border: `1px solid ${isActive ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`,
                  borderRadius: '999px',
                  background: isActive ? 'var(--color-accent)' : 'transparent',
                  color: isActive ? '#FFFFFF' : 'var(--color-text-primary)',
                  padding: '8px 12px',
                  fontSize: 'var(--type-label)',
                  fontWeight: 'var(--weight-semibold)',
                  cursor: 'pointer',
                }}
              >
                {option}
              </button>
            );
          })}
        </div>
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
          {resolvedPrimaryAction}
        </button>
      </div>
    </header>
  );
}
