import type { AiProviderPreset, AiProviderProfileRecord } from '@perchlink/core';
import { AI_PROVIDER_PRESETS } from '@perchlink/core';
import { useTranslation } from 'react-i18next';

interface AiProviderListProps {
  profiles: AiProviderProfileRecord[];
  selectedProfileId: string | null;
  isLoading?: boolean;
  onSelect: (profileId: string) => void;
  onCreateFromPreset: (presetId: AiProviderPreset['id']) => void;
}

function getScopeLabel(scope: AiProviderProfileRecord['executionScope'], t: ReturnType<typeof useTranslation>['t']) {
  return scope === 'local' ? t('aiChannels.scopeLocal') : t('aiChannels.scopeServer');
}

function getSecretStatusLabel(status: AiProviderProfileRecord['secretStatus'], t: ReturnType<typeof useTranslation>['t']) {
  if (status === 'configured') {
    return t('aiChannels.secretConfigured');
  }

  if (status === 'external') {
    return t('aiChannels.secretExternal');
  }

  return t('aiChannels.secretMissing');
}

export function AiProviderList({
  profiles,
  selectedProfileId,
  isLoading = false,
  onSelect,
  onCreateFromPreset,
}: AiProviderListProps) {
  const { t } = useTranslation();

  return (
    <section
      style={{
        display: 'grid',
        gap: 'var(--space-md)',
        alignContent: 'start',
      }}
    >
      <header style={{ display: 'grid', gap: 'var(--space-xs)' }}>
        <h3 style={{ margin: 0 }}>{t('aiChannels.listTitle')}</h3>
        <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>{t('aiChannels.listBody')}</p>
      </header>

      <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        {AI_PROVIDER_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onCreateFromPreset(preset.id)}
            style={{
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-md)',
              background: '#fff',
              padding: '10px 12px',
              cursor: 'pointer',
              fontWeight: 'var(--weight-semibold)',
            }}
          >
            {preset.providerKind === 'custom' ? t('aiChannels.addCustom') : t('aiChannels.addPreset', { label: preset.label })}
          </button>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gap: 'var(--space-sm)',
        }}
      >
        {profiles.length === 0 && !isLoading ? (
          <article
            style={{
              borderRadius: 'var(--radius-lg)',
              border: '1px dashed var(--color-border-subtle)',
              padding: 'var(--space-lg)',
              background: 'rgba(231, 222, 208, 0.25)',
              color: 'var(--color-text-muted)',
            }}
          >
            <strong>{t('aiChannels.emptyTitle')}</strong>
            <p style={{ marginBottom: 0 }}>{t('aiChannels.emptyBody')}</p>
          </article>
        ) : null}

        {profiles.map((profile) => {
          const isSelected = profile.id === selectedProfileId;

          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => onSelect(profile.id)}
              style={{
                textAlign: 'left',
                display: 'grid',
                gap: 'var(--space-xs)',
                borderRadius: 'var(--radius-lg)',
                border: `1px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`,
                background: isSelected ? 'rgba(47, 107, 98, 0.08)' : 'var(--color-surface-raised)',
                padding: 'var(--space-lg)',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-sm)', alignItems: 'center' }}>
                <strong>{profile.label}</strong>
                <span
                  style={{
                    borderRadius: 999,
                    padding: '4px 8px',
                    background: profile.enabled ? 'rgba(47, 107, 98, 0.12)' : 'rgba(31, 42, 36, 0.08)',
                    color: profile.enabled ? 'var(--color-accent)' : 'var(--color-text-muted)',
                    fontSize: 'var(--type-label)',
                    fontWeight: 'var(--weight-semibold)',
                  }}
                >
                  {profile.enabled ? t('aiChannels.enabled') : t('aiChannels.disabled')}
                </span>
              </div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--type-label)' }}>
                {profile.providerKind} · {getScopeLabel(profile.executionScope, t)} · {profile.model || t('aiChannels.modelMissing')}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-sm)', color: 'var(--color-text-muted)' }}>
                <span>
                  {t('aiChannels.priorityShort')}: {profile.priority}
                </span>
                <span>{getSecretStatusLabel(profile.secretStatus, t)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
