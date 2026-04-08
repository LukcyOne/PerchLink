import type { BookmarkRecord } from '@perchlink/core';
import { IconButton } from '../primitives/IconButton';

interface BookmarkListRowProps {
  bookmark: BookmarkRecord;
  primaryCategory?: string;
  onSelect: () => void;
  onEdit: () => void;
  onToggleStar: () => void;
  onRetry?: () => void;
}

export function BookmarkListRow({ bookmark, primaryCategory, onSelect, onEdit, onToggleStar, onRetry }: BookmarkListRowProps) {
  const processing_status = bookmark.processingStatus;
  const statusLabel = processing_status === 'failed' ? 'failed' : processing_status === 'pending' ? 'pending' : processing_status === 'processing' ? 'processing' : 'ready';
  const description = bookmark.descriptionExcerpt ?? bookmark.description ?? 'No description yet.';

  return (
    <article
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.6fr) minmax(180px, 0.8fr) auto',
        alignItems: 'center',
        gap: 'var(--space-md)',
        padding: 'var(--space-md) var(--space-lg)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-border-subtle)',
        background: 'var(--color-surface-raised)',
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        style={{
          border: 'none',
          background: 'transparent',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 'var(--space-xs)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <strong style={{ fontSize: 'var(--type-heading)' }}>{bookmark.title}</strong>
        <span style={{ color: 'var(--color-text-muted)' }}>{bookmark.url}</span>
        <span style={{ color: 'var(--color-text-muted)' }}>{description}</span>
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
        <span style={{ fontSize: 'var(--type-label)', color: 'var(--color-text-muted)' }}>{primaryCategory ?? 'Unsorted'}</span>
        <span style={{ fontSize: 'var(--type-label)', color: processing_status === 'failed' ? 'var(--color-destructive)' : 'var(--color-text-muted)' }}>
          {statusLabel}
        </span>
        {processing_status === 'failed' && bookmark.processingError ? (
          <span style={{ fontSize: 'var(--type-label)', color: 'var(--color-destructive)' }}>{bookmark.processingError}</span>
        ) : null}
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
        {processing_status === 'failed' && onRetry ? (
          <button type="button" onClick={onRetry} style={retryButtonStyle}>
            retry
          </button>
        ) : null}
        <IconButton ariaLabel={bookmark.isStarred ? 'Unstar bookmark' : 'Star bookmark'} onClick={onToggleStar}>
          {bookmark.isStarred ? '★' : '☆'}
        </IconButton>
        <IconButton ariaLabel="Edit bookmark" onClick={onEdit}>
          Edit
        </IconButton>
      </div>
    </article>
  );
}

const retryButtonStyle = {
  borderRadius: '999px',
  border: '1px solid var(--color-destructive)',
  background: 'transparent',
  color: 'var(--color-destructive)',
  padding: '8px 12px',
  cursor: 'pointer',
} as const;
