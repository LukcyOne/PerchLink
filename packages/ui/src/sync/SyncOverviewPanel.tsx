import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface SyncOverviewPanelProps {
  remoteAddress: string | null;
  accountName: string | null;
  connectionState: string;
  currentDeviceName: string | null;
  pendingPushCount: number;
  unreadConflictCount: number;
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastError: string | null;
  onSyncNow?: () => void;
  extra?: ReactNode;
}

export function SyncOverviewPanel(props: SyncOverviewPanelProps) {
  const { t } = useTranslation();
  const items = [
    [t('sync.overviewConnection'), props.connectionState],
    [t('sync.overviewAccount'), props.accountName ?? t('sync.notSignedIn')],
    [t('sync.overviewRemote'), props.remoteAddress ?? t('sync.notConnected')],
    [t('sync.overviewCurrentDevice'), props.currentDeviceName ?? t('sync.statusLocalOnly')],
    [t('sync.overviewPendingPushes'), String(props.pendingPushCount)],
    [t('sync.overviewUnreadConflicts'), String(props.unreadConflictCount)],
    [t('sync.overviewLastPush'), props.lastPushAt ?? t('sync.notYet')],
    [t('sync.overviewLastPull'), props.lastPullAt ?? t('sync.notYet')],
  ] as const;

  return (
    <section style={{ display: 'grid', gap: 'var(--space-lg)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-md)' }}>
        <div>
          <h2 style={{ margin: 0 }}>{t('sync.overviewTitle')}</h2>
          <p style={{ margin: 'var(--space-xs) 0 0', color: 'var(--color-text-muted)' }}>
            {t('sync.overviewBody')}
          </p>
        </div>
        <button
          type="button"
          onClick={props.onSyncNow}
          style={{
            border: 'none',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-accent)',
            color: '#fff',
            padding: '12px 16px',
            cursor: 'pointer',
            fontWeight: 'var(--weight-semibold)',
          }}
        >
          {t('sync.syncNow')}
        </button>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 'var(--space-md)',
        }}
      >
        {items.map(([label, value]) => (
          <article
            key={label}
            style={{
              padding: 'var(--space-lg)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-border-subtle)',
              background: 'var(--color-surface-raised)',
            }}
          >
            <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--type-label)' }}>{label}</div>
            <div style={{ marginTop: 'var(--space-sm)', fontWeight: 'var(--weight-semibold)' }}>{value}</div>
          </article>
        ))}
      </div>

      {props.lastError ? (
        <section
          style={{
            borderRadius: 'var(--radius-md)',
            border: '1px solid rgba(180, 107, 53, 0.3)',
            background: 'rgba(180, 107, 53, 0.08)',
            padding: 'var(--space-lg)',
          }}
        >
          <strong>{t('sync.overviewLatestError')}</strong>
          <p style={{ marginBottom: 0 }}>{props.lastError}</p>
        </section>
      ) : null}

      {props.extra}
    </section>
  );
}
