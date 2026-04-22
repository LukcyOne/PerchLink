import type { SyncConflictRecord, SyncEntitySnapshot } from '@perchlink/core';
import { useTranslation } from 'react-i18next';
import { ConflictDetailCard } from './ConflictDetailCard';

interface SyncConflictsPanelProps {
  conflicts: SyncConflictRecord[];
  selectedConflictId: string | null;
  onSelectConflict?: (conflictId: string) => void;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getEntityLabel(snapshot: SyncEntitySnapshot | null, entityId: string): string {
  if (!snapshot) {
    return entityId;
  }

  switch (snapshot.entityType) {
    case 'bookmark':
      return snapshot.title;
    case 'category':
      return snapshot.name;
    case 'collection':
      return snapshot.name;
    default:
      return entityId;
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

export function SyncConflictsPanel({ conflicts, selectedConflictId, onSelectConflict }: SyncConflictsPanelProps) {
  const { t } = useTranslation();
  const selectedConflict = conflicts.find((conflict) => conflict.id === selectedConflictId) ?? conflicts[0] ?? null;

  return (
    <section style={{ display: 'grid', gap: 'var(--space-md)' }}>
      <header>
        <h2 style={{ margin: 0 }}>{t('sync.conflictsTitle')}</h2>
        <p style={{ margin: 'var(--space-xs) 0 0', color: 'var(--color-text-muted)' }}>
          {t('sync.conflictsBody')}
        </p>
      </header>

      {conflicts.length === 0 ? (
        <article
          style={{
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--color-border-subtle)',
            background: 'rgba(231, 222, 208, 0.25)',
            padding: 'var(--space-xl)',
          }}
        >
          <strong>{t('sync.conflictsEmptyTitle')}</strong>
          <p style={{ marginBottom: 0, color: 'var(--color-text-muted)' }}>{t('sync.conflictsEmptyBody')}</p>
        </article>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)',
            gap: 'var(--space-lg)',
            alignItems: 'start',
          }}
        >
          <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
            {conflicts.map((conflict) => {
              const isSelected = conflict.id === selectedConflict?.id;
              const entityLabel = getEntityLabel(conflict.serverSnapshot ?? conflict.localPayload, conflict.entityId);

              return (
                <button
                  key={conflict.id}
                  type="button"
                  onClick={() => onSelectConflict?.(conflict.id)}
                  style={{
                    display: 'grid',
                    gap: 'var(--space-xs)',
                    textAlign: 'left',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`,
                    background: isSelected ? 'rgba(47, 107, 98, 0.08)' : 'var(--color-surface-raised)',
                    padding: 'var(--space-md)',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 'var(--space-sm)',
                      alignItems: 'center',
                    }}
                  >
                    <strong>{entityLabel}</strong>
                    <span
                      style={{
                        borderRadius: 999,
                        padding: '4px 10px',
                        background: conflict.unread ? 'rgba(47, 107, 98, 0.14)' : 'rgba(203, 190, 170, 0.35)',
                        color: conflict.unread ? 'var(--color-accent)' : 'var(--color-text-muted)',
                        fontSize: 'var(--type-label)',
                        fontWeight: 'var(--weight-semibold)',
                      }}
                    >
                      {conflict.unread ? t('sync.conflictUnread') : t('sync.conflictRead')}
                    </span>
                  </div>
                  <div style={{ color: 'var(--color-text-muted)' }}>{getReasonLabel(conflict.reasonCode, t)}</div>
                  <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--type-label)' }}>
                    {formatDateTime(conflict.updatedAt)}
                  </div>
                </button>
              );
            })}
          </div>

          <ConflictDetailCard conflict={selectedConflict} />
        </div>
      )}
    </section>
  );
}
