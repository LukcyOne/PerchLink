import type { CSSProperties } from 'react';
import type { BookmarkRecord } from '@perchlink/core';
import { useTranslation } from 'react-i18next';
import { IconButton } from '../primitives/IconButton';

interface BookmarkCardProps {
  bookmark: BookmarkRecord;
  primaryCategory?: string;
  onSelect: () => void;
  onEdit: () => void;
  onToggleStar: () => void;
  onRetry?: () => void;
}

function formatBookmarkDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

const cardStyle: CSSProperties = {
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border-subtle)',
  background: 'var(--color-surface-raised)',
  padding: 'var(--space-lg)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-md)',
  minHeight: '300px',
  position: 'relative',
  boxShadow: '0 14px 28px rgba(31, 42, 36, 0.08)',
};

export function BookmarkCard({ bookmark, primaryCategory, onSelect, onEdit, onToggleStar, onRetry }: BookmarkCardProps) {
  const { t } = useTranslation();
  const processing_status = bookmark.processingStatus;
  const isPending = processing_status === 'pending';
  const isProcessing = processing_status === 'processing';
  const isFailed = processing_status === 'failed';
  const cover = bookmark.coverUrl;
  const description = bookmark.descriptionExcerpt ?? bookmark.description ?? 'No description yet.';
  const aiStatus = bookmark.processingStatus === 'ready' ? bookmark.aiSuggestion?.status : null;
  const aiHint =
    aiStatus === 'running'
      ? t('ai.analyzing')
      : aiStatus === 'ready'
        ? t('ai.ready')
        : aiStatus === 'failed'
          ? t('ai.failed')
          : null;

  return (
    <article style={cardStyle}>
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
          alignItems: 'stretch',
          gap: 'var(--space-md)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {cover ? (
          <div
            style={{
              height: '140px',
              borderRadius: 'var(--radius-md)',
              backgroundImage: `linear-gradient(rgba(31, 42, 36, 0.12), rgba(31, 42, 36, 0.12)), url(${cover})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
        ) : (
          <div
            style={{
              height: '140px',
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, rgba(47, 107, 98, 0.15), rgba(231, 222, 208, 0.9))',
              display: 'flex',
              alignItems: 'flex-end',
              padding: 'var(--space-md)',
              fontSize: 'var(--type-label)',
              color: 'var(--color-text-muted)',
            }}
          >
            Bookmark preview
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-md)' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 'var(--type-heading)', lineHeight: 'var(--line-heading)' }}>{bookmark.title}</h3>
              <div style={{ marginTop: 'var(--space-xs)', fontSize: 'var(--type-label)', color: 'var(--color-text-muted)' }}>
                {bookmark.url}
              </div>
            </div>
            <div
              style={{
                padding: '6px 10px',
                borderRadius: '999px',
                background: isFailed ? 'rgba(183, 75, 59, 0.12)' : 'rgba(47, 107, 98, 0.14)',
                color: isFailed ? 'var(--color-destructive)' : 'var(--color-accent)',
                fontSize: 'var(--type-label)',
                fontWeight: 'var(--weight-semibold)',
                whiteSpace: 'nowrap',
              }}
            >
              {isFailed ? 'failed' : isPending ? 'pending' : isProcessing ? 'processing' : 'ready'}
            </div>
          </div>
          <p style={{ margin: 0, color: 'var(--color-text-muted)', minHeight: '48px' }}>{description}</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-sm)' }}>
            {bookmark.tags.length > 0 ? (
              bookmark.tags.map((tag) => (
                <span
                  key={tag.id}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '999px',
                    background: 'var(--color-secondary)',
                    fontSize: 'var(--type-label)',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  #{tag.label}
                </span>
              ))
            ) : (
              <span style={{ fontSize: 'var(--type-label)', color: 'var(--color-text-muted)' }}>No tags</span>
            )}
          </div>
        </div>
      </button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-md)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)', color: 'var(--color-text-muted)' }}>
            <span style={{ fontSize: 'var(--type-label)' }}>primaryCategory: {primaryCategory ?? 'Unsorted'}</span>
            <span style={{ fontSize: 'var(--type-label)' }}>Updated {formatBookmarkDate(bookmark.updatedAt)}</span>
            {aiHint ? (
              <span
                style={{
                  fontSize: 'var(--type-label)',
                  color: aiStatus === 'failed' ? 'var(--color-destructive)' : 'var(--color-accent)',
                }}
              >
                {aiHint}
              </span>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <IconButton ariaLabel={bookmark.isStarred ? 'Unstar bookmark' : 'Star bookmark'} onClick={onToggleStar}>
            {bookmark.isStarred ? '★' : '☆'}
          </IconButton>
          <IconButton ariaLabel="Edit bookmark" onClick={onEdit}>
            Edit
          </IconButton>
        </div>
      </div>
      {(isPending || isProcessing) && (
        <div
          style={{
            position: 'absolute',
            inset: 'auto var(--space-lg) var(--space-lg) var(--space-lg)',
            padding: '10px 12px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(47, 107, 98, 0.1)',
            color: 'var(--color-accent)',
            fontSize: 'var(--type-label)',
            fontWeight: 'var(--weight-semibold)',
          }}
        >
          Extracting page details...
        </div>
      )}
      {isFailed && (
        <div
          style={{
            display: 'grid',
            gap: 'var(--space-sm)',
            padding: '12px',
            borderRadius: 'var(--radius-md)',
            background: 'rgba(183, 75, 59, 0.1)',
            color: 'var(--color-destructive)',
          }}
        >
          <div>processing_status: failed</div>
          <div>{bookmark.processingError ?? 'Metadata extraction failed.'}</div>
          {onRetry ? (
            <button type="button" onClick={onRetry} style={{ ...retryButtonStyle, alignSelf: 'start' }}>
              retry
            </button>
          ) : null}
        </div>
      )}
    </article>
  );
}

const retryButtonStyle = {
  borderRadius: '999px',
  border: '1px solid currentColor',
  background: 'transparent',
  padding: '8px 12px',
  cursor: 'pointer',
} as const;
