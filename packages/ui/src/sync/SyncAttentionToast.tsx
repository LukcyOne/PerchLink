import type { SyncConflictRecord, SyncEntitySnapshot } from '@perchlink/core';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface SyncAttentionToastProps {
  conflict: SyncConflictRecord | null;
  onReview?: () => void;
  durationMs?: number;
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

export function SyncAttentionToast({ conflict, onReview, durationMs = 5000 }: SyncAttentionToastProps) {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(Boolean(conflict));

  useEffect(() => {
    if (!conflict) {
      setIsVisible(false);
      return;
    }

    setIsVisible(true);
    const timer = globalThis.setTimeout(() => {
      setIsVisible(false);
    }, durationMs);

    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [conflict?.id, durationMs]);

  if (!conflict || !isVisible) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={onReview}
      style={{
        position: 'fixed',
        right: 'var(--space-xl)',
        bottom: 'var(--space-xl)',
        zIndex: 60,
        width: 'min(360px, calc(100vw - 48px))',
        display: 'grid',
        gap: 'var(--space-xs)',
        textAlign: 'left',
        border: '1px solid rgba(183, 75, 59, 0.22)',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--color-surface-raised)',
        boxShadow: '0 20px 40px rgba(31, 42, 36, 0.18)',
        padding: 'var(--space-md)',
        cursor: 'pointer',
      }}
    >
      <strong>{t('sync.attentionToastTitle')}</strong>
      <div style={{ color: 'var(--color-text-muted)' }}>{t('sync.attentionToastBody')}</div>
      <div style={{ color: 'var(--color-accent)', fontSize: 'var(--type-label)', fontWeight: 'var(--weight-semibold)' }}>
        {getEntityLabel(conflict.serverSnapshot ?? conflict.localPayload, conflict.entityId)}
      </div>
    </button>
  );
}
