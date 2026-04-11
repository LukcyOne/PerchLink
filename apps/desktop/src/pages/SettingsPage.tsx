import { useTranslation } from '@perchlink/i18n';
import { useSyncStore } from '@perchlink/store';

interface SettingsPageProps {
  onOpenSyncCenter: () => void;
}

export function SettingsPage({ onOpenSyncCenter }: SettingsPageProps) {
  const { t } = useTranslation();
  const { status } = useSyncStore();

  return (
    <section style={{ display: 'grid', gap: 'var(--space-lg)' }}>
      <header>
        <h2 style={{ marginTop: 0 }}>Settings</h2>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Keep desktop preferences light here, and route sync health into a dedicated center.
        </p>
      </header>

      <article
        style={{
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-subtle)',
          background: 'var(--color-surface-raised)',
          padding: 'var(--space-xl)',
          display: 'grid',
          gap: 'var(--space-md)',
        }}
        >
          <div>
          <strong>{t('sync.settingsSyncTitle')}</strong>
          <p style={{ color: 'var(--color-text-muted)', marginBottom: 0 }}>
            {t('sync.settingsSyncBody')} Current status: {status?.connectionState ?? 'local-only'}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenSyncCenter}
          style={{
            justifySelf: 'start',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-accent)',
            color: '#fff',
            padding: '12px 16px',
            cursor: 'pointer',
            fontWeight: 'var(--weight-semibold)',
          }}
        >
          {t('sync.settingsSyncAction')}
        </button>
      </article>
    </section>
  );
}
