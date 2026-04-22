import type { AiExecutionMode } from '@perchlink/core';
import { useTranslation } from 'react-i18next';

interface AiExecutionModePanelProps {
  mode: AiExecutionMode;
  isBusy?: boolean;
  onChange: (mode: AiExecutionMode) => void;
}

const MODES: AiExecutionMode[] = ['local', 'server', 'hybrid'];

function getModeLabel(mode: AiExecutionMode, t: ReturnType<typeof useTranslation>['t']) {
  switch (mode) {
    case 'server':
      return t('aiChannels.modeServer');
    case 'hybrid':
      return t('aiChannels.modeHybrid');
    default:
      return t('aiChannels.modeLocal');
  }
}

function getModeBody(mode: AiExecutionMode, t: ReturnType<typeof useTranslation>['t']) {
  switch (mode) {
    case 'server':
      return t('aiChannels.modeServerBody');
    case 'hybrid':
      return t('aiChannels.modeHybridBody');
    default:
      return t('aiChannels.modeLocalBody');
  }
}

export function AiExecutionModePanel({ mode, isBusy = false, onChange }: AiExecutionModePanelProps) {
  const { t } = useTranslation();

  return (
    <section
      style={{
        display: 'grid',
        gap: 'var(--space-md)',
        padding: 'var(--space-lg)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border-subtle)',
        background: 'var(--color-surface-raised)',
      }}
    >
      <header style={{ display: 'grid', gap: 'var(--space-xs)' }}>
        <h3 style={{ margin: 0 }}>{t('aiChannels.modeTitle')}</h3>
        <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>{t('aiChannels.modeBody')}</p>
      </header>

      <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        {MODES.map((candidate) => {
          const active = candidate === mode;

          return (
            <button
              key={candidate}
              type="button"
              onClick={() => onChange(candidate)}
              disabled={isBusy}
              style={{
                border: `1px solid ${active ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`,
                borderRadius: 'var(--radius-md)',
                background: active ? 'rgba(47, 107, 98, 0.1)' : '#fff',
                color: active ? 'var(--color-accent)' : 'var(--color-text-primary)',
                padding: '10px 14px',
                cursor: 'pointer',
                fontWeight: 'var(--weight-semibold)',
              }}
            >
              {getModeLabel(candidate, t)}
            </button>
          );
        })}
      </div>

      <div
        style={{
          borderRadius: 'var(--radius-md)',
          background: 'rgba(47, 107, 98, 0.08)',
          padding: 'var(--space-md)',
          color: 'var(--color-text-primary)',
        }}
      >
        {getModeBody(mode, t)}
      </div>
    </section>
  );
}
