import type { SyncRoundRecord } from '@perchlink/core';
import { useTranslation } from 'react-i18next';

interface SyncHistoryPanelProps {
  rounds: SyncRoundRecord[];
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getRoundStatusLabel(status: SyncRoundRecord['status'], t: (key: string) => string): string {
  switch (status) {
    case 'running':
      return t('sync.historyStatusRunning');
    case 'failed':
      return t('sync.historyStatusFailed');
    default:
      return t('sync.historyStatusSucceeded');
  }
}

export function SyncHistoryPanel({ rounds }: SyncHistoryPanelProps) {
  const { t } = useTranslation();

  return (
    <section style={{ display: 'grid', gap: 'var(--space-md)' }}>
      <header>
        <h2 style={{ margin: 0 }}>{t('sync.historyTitle')}</h2>
        <p style={{ margin: 'var(--space-xs) 0 0', color: 'var(--color-text-muted)' }}>
          {t('sync.historyBody')}
        </p>
      </header>

      {rounds.length === 0 ? (
        <article
          style={{
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--color-border-subtle)',
            background: 'rgba(231, 222, 208, 0.25)',
            padding: 'var(--space-xl)',
          }}
        >
          <strong>{t('sync.historyEmptyTitle')}</strong>
          <p style={{ marginBottom: 0, color: 'var(--color-text-muted)' }}>{t('sync.historyEmptyBody')}</p>
        </article>
      ) : (
        <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
          {rounds.map((round) => (
            <article
              key={round.id}
              style={{
                display: 'grid',
                gap: 'var(--space-sm)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--color-border-subtle)',
                background: 'var(--color-surface-raised)',
                padding: 'var(--space-lg)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 'var(--space-md)',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <strong>{formatDateTime(round.finishedAt ?? round.startedAt)}</strong>
                <span
                  style={{
                    borderRadius: 999,
                    padding: '4px 10px',
                    background:
                      round.status === 'failed'
                        ? 'rgba(183, 75, 59, 0.12)'
                        : round.status === 'running'
                          ? 'rgba(47, 107, 98, 0.12)'
                          : 'rgba(47, 107, 98, 0.08)',
                    color: round.status === 'failed' ? 'var(--color-destructive)' : 'var(--color-accent)',
                    fontSize: 'var(--type-label)',
                    fontWeight: 'var(--weight-semibold)',
                  }}
                >
                  {getRoundStatusLabel(round.status, t)}
                </span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: 'var(--space-md)',
                }}
              >
                <div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--type-label)' }}>
                    {t('sync.historyPushCount')}
                  </div>
                  <div>{round.pushCount}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--type-label)' }}>
                    {t('sync.historyPullCount')}
                  </div>
                  <div>{round.pullCount}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--type-label)' }}>
                    {t('sync.historyDirection')}
                  </div>
                  <div>{round.direction}</div>
                </div>
              </div>
              {round.message ? (
                <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
                  {t('sync.historyOutcomePrefix')} {round.message}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
