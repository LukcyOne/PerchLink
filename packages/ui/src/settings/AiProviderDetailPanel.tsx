import type { AiProviderProfileDraft, AiProviderProfileRecord } from '@perchlink/core';
import { useTranslation } from 'react-i18next';

interface AiProviderDetailPanelProps {
  profile: AiProviderProfileRecord | null;
  draft: AiProviderProfileDraft | null;
  isSaving?: boolean;
  error?: string | null;
  onChange: (patch: Partial<AiProviderProfileDraft>) => void;
  onSave: () => void;
  onDelete: () => void;
  onClearSecret: () => void;
}

function getSecretStatusLabel(
  status: AiProviderProfileRecord['secretStatus'] | undefined,
  t: ReturnType<typeof useTranslation>['t'],
) {
  if (status === 'configured') {
    return t('aiChannels.secretConfigured');
  }

  if (status === 'external') {
    return t('aiChannels.secretExternal');
  }

  return t('aiChannels.secretMissing');
}

export function AiProviderDetailPanel({
  profile,
  draft,
  isSaving = false,
  error = null,
  onChange,
  onSave,
  onDelete,
  onClearSecret,
}: AiProviderDetailPanelProps) {
  const { t } = useTranslation();

  if (!draft) {
    return (
      <section
        style={{
          borderRadius: 'var(--radius-lg)',
          border: '1px dashed var(--color-border-subtle)',
          padding: 'var(--space-xl)',
          background: 'rgba(231, 222, 208, 0.25)',
        }}
      >
        <strong>{t('aiChannels.detailEmptyTitle')}</strong>
        <p style={{ marginBottom: 0, color: 'var(--color-text-muted)' }}>{t('aiChannels.detailEmptyBody')}</p>
      </section>
    );
  }

  const isServerScope = draft.executionScope === 'server';
  const secretStatus = profile?.secretStatus;

  return (
    <section
      style={{
        display: 'grid',
        gap: 'var(--space-lg)',
        padding: 'var(--space-xl)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border-subtle)',
        background: 'var(--color-surface-raised)',
      }}
    >
      <header style={{ display: 'grid', gap: 'var(--space-xs)' }}>
        <h3 style={{ margin: 0 }}>{profile ? profile.label : t('aiChannels.newProviderTitle')}</h3>
        <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>{t('aiChannels.detailBody')}</p>
      </header>

      <div style={{ display: 'grid', gap: 'var(--space-md)', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <label style={fieldStyle}>
          <span>{t('aiChannels.fieldLabel')}</span>
          <input value={draft.label} onChange={(event) => onChange({ label: event.target.value })} />
        </label>

        <label style={fieldStyle}>
          <span>{t('aiChannels.fieldProviderKind')}</span>
          <select value={draft.providerKind} onChange={(event) => onChange({ providerKind: event.target.value as AiProviderProfileDraft['providerKind'] })}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="gemini">Gemini</option>
            <option value="custom">{t('aiChannels.customOption')}</option>
          </select>
        </label>

        <label style={fieldStyle}>
          <span>{t('aiChannels.fieldProtocol')}</span>
          <select value={draft.protocolKind} onChange={(event) => onChange({ protocolKind: event.target.value as AiProviderProfileDraft['protocolKind'] })}>
            <option value="openai-compatible">OpenAI Compatible</option>
            <option value="anthropic-messages">Anthropic Messages</option>
            <option value="gemini-rest">Gemini REST</option>
          </select>
        </label>

        <label style={fieldStyle}>
          <span>{t('aiChannels.fieldScope')}</span>
          <select
            value={draft.executionScope}
            onChange={(event) => onChange({ executionScope: event.target.value as AiProviderProfileDraft['executionScope'] })}
          >
            <option value="local">{t('aiChannels.scopeLocal')}</option>
            <option value="server">{t('aiChannels.scopeServer')}</option>
          </select>
        </label>

        <label style={fieldStyle}>
          <span>{t('aiChannels.fieldBaseUrl')}</span>
          <input
            value={draft.baseUrl ?? ''}
            placeholder={t('aiChannels.baseUrlPlaceholder')}
            onChange={(event) => onChange({ baseUrl: event.target.value })}
          />
        </label>

        <label style={fieldStyle}>
          <span>{t('aiChannels.fieldModel')}</span>
          <input value={draft.model} placeholder={t('aiChannels.modelPlaceholder')} onChange={(event) => onChange({ model: event.target.value })} />
        </label>

        <label style={fieldStyle}>
          <span>{t('aiChannels.fieldTimeout')}</span>
          <input
            type="number"
            min={1000}
            step={1000}
            value={draft.timeoutMs ?? 30000}
            onChange={(event) => onChange({ timeoutMs: Number(event.target.value) })}
          />
        </label>

        <label style={fieldStyle}>
          <span>{t('aiChannels.fieldPriority')}</span>
          <input
            type="number"
            min={0}
            step={10}
            value={draft.priority ?? 100}
            onChange={(event) => onChange({ priority: Number(event.target.value) })}
          />
        </label>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
        <label style={toggleStyle}>
          <input
            type="checkbox"
            checked={draft.enabled ?? true}
            onChange={(event) => onChange({ enabled: event.target.checked })}
          />
          <span>{t('aiChannels.enabled')}</span>
        </label>
        <label style={toggleStyle}>
          <input
            type="checkbox"
            checked={draft.allowFallback ?? true}
            onChange={(event) => onChange({ allowFallback: event.target.checked })}
          />
          <span>{t('aiChannels.allowFallback')}</span>
        </label>
      </div>

      <section
        style={{
          display: 'grid',
          gap: 'var(--space-sm)',
          borderRadius: 'var(--radius-md)',
          background: isServerScope ? 'rgba(180, 107, 53, 0.08)' : 'rgba(47, 107, 98, 0.08)',
          padding: 'var(--space-lg)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
          <strong>{t('aiChannels.secretTitle')}</strong>
          <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--type-label)' }}>
            {t('aiChannels.secretStatus')}: {getSecretStatusLabel(secretStatus, t)}
          </span>
        </div>
        {isServerScope ? (
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>{t('aiChannels.secretServerBody')}</p>
        ) : (
          <>
            <label style={fieldStyle}>
              <span>{t('aiChannels.secretInput')}</span>
              <input
                type="password"
                value={draft.secret ?? ''}
                placeholder={t('aiChannels.secretPlaceholder')}
                onChange={(event) => onChange({ secret: event.target.value })}
              />
            </label>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
              <button type="button" onClick={onClearSecret} disabled={isSaving} style={secondaryButtonStyle}>
                {t('aiChannels.clearSecret')}
              </button>
              <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--type-label)' }}>{t('aiChannels.secretDesktopBody')}</span>
            </div>
          </>
        )}
      </section>

      {error ? <p style={{ margin: 0, color: 'var(--color-destructive)' }}>{error}</p> : null}

      <div style={{ display: 'flex', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
        <button type="button" onClick={onSave} disabled={isSaving} style={primaryButtonStyle}>
          {t('aiChannels.saveAction')}
        </button>
        <button type="button" onClick={onDelete} disabled={isSaving} style={secondaryButtonStyle}>
          {profile ? t('aiChannels.deleteAction') : t('aiChannels.cancelNew')}
        </button>
      </div>
    </section>
  );
}

const fieldStyle = {
  display: 'grid',
  gap: 'var(--space-xs)',
} as const;

const toggleStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
} as const;

const primaryButtonStyle = {
  borderRadius: 'var(--radius-md)',
  border: 'none',
  background: 'var(--color-accent)',
  color: '#fff',
  padding: '12px 16px',
  cursor: 'pointer',
  fontWeight: 'var(--weight-semibold)',
} as const;

const secondaryButtonStyle = {
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border-subtle)',
  background: '#fff',
  color: 'var(--color-text-primary)',
  padding: '12px 16px',
  cursor: 'pointer',
} as const;
