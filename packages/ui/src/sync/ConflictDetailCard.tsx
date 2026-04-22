import type { SyncConflictRecord, SyncEntitySnapshot } from '@perchlink/core';
import { useTranslation } from 'react-i18next';

interface ConflictDetailCardProps {
  conflict: SyncConflictRecord | null;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function stringifySnapshot(snapshot: SyncEntitySnapshot | null): string {
  if (!snapshot) {
    return '-';
  }

  return JSON.stringify(snapshot, null, 2);
}

function getEntityTitle(snapshot: SyncEntitySnapshot | null, fallbackId: string): string {
  if (!snapshot) {
    return fallbackId;
  }

  switch (snapshot.entityType) {
    case 'bookmark':
      return snapshot.title;
    case 'category':
      return snapshot.name;
    case 'collection':
      return snapshot.name;
    default:
      return fallbackId;
  }
}

function getReasonLabel(reasonCode: string, t: (key: string) => string): string {
  switch (reasonCode) {
    case 'base_version_conflict':
      return t('sync.reasonBaseVersionConflict');
    case 'deleted_on_server':
      return t('sync.reasonDeletedOnServer');
    case 'duplicate_natural_key':
      return t('sync.reasonDuplicateNaturalKey');
    case 'dependency_missing':
      return t('sync.reasonDependencyMissing');
    case 'validation_failed':
      return t('sync.reasonValidationFailed');
    case 'device_revoked':
      return t('sync.reasonDeviceRevoked');
    case 'auth_invalid':
      return t('sync.reasonAuthInvalid');
    case 'cursor_expired':
      return t('sync.reasonCursorExpired');
    default:
      return reasonCode;
  }
}

export function ConflictDetailCard({ conflict }: ConflictDetailCardProps) {
  const { t } = useTranslation();

  if (!conflict) {
    return (
      <article
        style={{
          borderRadius: 'var(--radius-lg)',
          border: '1px dashed var(--color-border-subtle)',
          background: 'rgba(231, 222, 208, 0.25)',
          padding: 'var(--space-xl)',
        }}
      >
        <strong>{t('sync.conflictDetailEmptyTitle')}</strong>
        <p style={{ marginBottom: 0, color: 'var(--color-text-muted)' }}>{t('sync.conflictDetailEmptyBody')}</p>
      </article>
    );
  }

  return (
    <article
      style={{
        display: 'grid',
        gap: 'var(--space-lg)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--color-border-subtle)',
        background: 'var(--color-surface-raised)',
        padding: 'var(--space-lg)',
      }}
    >
      <header style={{ display: 'grid', gap: 'var(--space-xs)' }}>
        <h3 style={{ margin: 0 }}>{t('sync.conflictDetailTitle')}</h3>
        <div style={{ color: 'var(--color-text-muted)' }}>
          {getEntityTitle(conflict.serverSnapshot ?? conflict.localPayload, conflict.entityId)}
        </div>
        <div style={{ color: 'var(--color-text-muted)' }}>{getReasonLabel(conflict.reasonCode, t)}</div>
        <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--type-label)' }}>
          {t('sync.conflictOccurredAt')}: {formatDateTime(conflict.updatedAt)}
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 'var(--space-md)',
        }}
      >
        <section
          style={{
            display: 'grid',
            gap: 'var(--space-sm)',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(231, 222, 208, 0.35)',
            padding: 'var(--space-md)',
          }}
        >
          <strong>{t('sync.conflictLocalIntent')}</strong>
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'inherit',
              lineHeight: 1.5,
            }}
          >
            {stringifySnapshot(conflict.localPayload)}
          </pre>
        </section>

        <section
          style={{
            display: 'grid',
            gap: 'var(--space-sm)',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(47, 107, 98, 0.08)',
            padding: 'var(--space-md)',
          }}
        >
          <strong>{t('sync.conflictServerResult')}</strong>
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontFamily: 'inherit',
              lineHeight: 1.5,
            }}
          >
            {stringifySnapshot(conflict.serverSnapshot)}
          </pre>
        </section>
      </div>
    </article>
  );
}
