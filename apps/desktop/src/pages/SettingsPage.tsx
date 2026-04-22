import { useTranslation } from '@perchlink/i18n';
import { useEffect } from 'react';
import { useAiSettingsStore, useSyncStore } from '@perchlink/store';
import { AiExecutionModePanel, AiProviderDetailPanel, AiProviderList } from '@perchlink/ui';
import { desktopAiSettingsRepository } from '../lib/repositories/desktopAiSettingsRepository';

interface SettingsPageProps {
  onOpenSyncCenter: () => void;
}

export function SettingsPage({ onOpenSyncCenter }: SettingsPageProps) {
  const { t } = useTranslation();
  const { status } = useSyncStore();
  const {
    profiles,
    selectedProfileId,
    draft,
    executionPreferences,
    isLoading,
    isSaving,
    error,
    configureRepository,
    hydrate,
    selectProfile,
    createProfileFromPreset,
    updateDraft,
    saveDraft,
    deleteSelectedProfile,
    clearSelectedSecret,
    saveExecutionMode,
  } = useAiSettingsStore();

  useEffect(() => {
    configureRepository(desktopAiSettingsRepository);
  }, [configureRepository]);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <section style={{ display: 'grid', gap: 'var(--space-lg)' }}>
      <header>
        <h2 style={{ marginTop: 0 }}>{t('settings.title')}</h2>
        <p style={{ color: 'var(--color-text-muted)' }}>
          {t('settings.body')}
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gap: 'var(--space-lg)',
          gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)',
          alignItems: 'start',
        }}
      >
        <AiProviderList
          profiles={profiles}
          selectedProfileId={selectedProfileId}
          isLoading={isLoading}
          onSelect={selectProfile}
          onCreateFromPreset={createProfileFromPreset}
        />

        <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
          <AiExecutionModePanel
            mode={executionPreferences.mode}
            isBusy={isSaving}
            onChange={(mode) => void saveExecutionMode(mode)}
          />

          <AiProviderDetailPanel
            profile={selectedProfileId ? profiles.find((profile) => profile.id === selectedProfileId) ?? null : null}
            draft={draft}
            isSaving={isSaving}
            error={error}
            onChange={updateDraft}
            onSave={() => void saveDraft()}
            onDelete={() => void deleteSelectedProfile()}
            onClearSecret={() => void clearSelectedSecret()}
          />
        </div>
      </div>

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
            {t('sync.settingsSyncBody')} {t('settings.syncStatusPrefix')} {status?.connectionState ?? 'local-only'}
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
