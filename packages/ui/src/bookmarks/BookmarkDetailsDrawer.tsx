import { useEffect, useMemo, useState } from 'react';
import type { BookmarkRecord, CategoryTreeNode, CollectionRecord, UpdateBookmarkPatch } from '@perchlink/core';

interface BookmarkDetailsDrawerProps {
  bookmark: BookmarkRecord | null;
  categories: CategoryTreeNode[];
  collections: CollectionRecord[];
  isOpen: boolean;
  isSaving?: boolean;
  onClose: () => void;
  onDelete: (bookmarkId: string) => Promise<void>;
  onSave: (bookmarkId: string, patch: UpdateBookmarkPatch) => Promise<void>;
  onRetry?: (bookmarkId: string) => Promise<void>;
}

function flattenCategories(categories: CategoryTreeNode[]): CategoryTreeNode[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children)]);
}

function buildTagInput(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((label) => ({ label }));
}

export function BookmarkDetailsDrawer({
  bookmark,
  categories,
  collections,
  isOpen,
  isSaving = false,
  onClose,
  onDelete,
  onSave,
  onRetry,
}: BookmarkDetailsDrawerProps) {
  const categoryOptions = useMemo(() => flattenCategories(categories), [categories]);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('system-unsorted');
  const [tags, setTags] = useState('');
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);
  const [isStarred, setIsStarred] = useState(false);

  useEffect(() => {
    if (!bookmark) {
      return;
    }

    setTitle(bookmark.title);
    setUrl(bookmark.url);
    setDescription(bookmark.description ?? '');
    setCategoryId(bookmark.primaryCategoryId ?? 'system-unsorted');
    setTags(bookmark.tags.map((tag) => tag.label).join(', '));
    setSelectedCollectionIds(bookmark.collectionIds);
    setIsStarred(bookmark.isStarred);
  }, [bookmark]);

  if (!isOpen || !bookmark) {
    return null;
  }

  return (
    <aside
      role="dialog"
      aria-modal="true"
      aria-label="Bookmark details drawer"
      style={{
        position: 'fixed',
        inset: '0 0 0 auto',
        width: 'min(480px, 100vw)',
        background: 'var(--color-surface-raised)',
        borderLeft: '1px solid var(--color-border-subtle)',
        padding: 'var(--space-xl)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-lg)',
        boxShadow: '-12px 0 28px rgba(31, 42, 36, 0.12)',
        zIndex: 30,
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 'var(--space-md)' }}>
        <div>
          <div style={{ fontSize: 'var(--type-label)', color: 'var(--color-text-muted)' }}>identity header</div>
          <h2 style={{ margin: 'var(--space-xs) 0 0', fontSize: 'var(--type-display)' }}>{bookmark.title}</h2>
          <p style={{ margin: 'var(--space-sm) 0 0', color: 'var(--color-text-muted)' }}>{bookmark.url}</p>
        </div>
        <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
          Close
        </button>
      </div>

      <section style={{ display: 'grid', gap: 'var(--space-sm)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)', background: 'rgba(47, 107, 98, 0.08)' }}>
        <strong>processing_status: {bookmark.processingStatus}</strong>
        {bookmark.processingStatus === 'failed' ? (
          <div style={{ color: 'var(--color-destructive)' }}>processing_error: {bookmark.processingError ?? 'Unknown error'}</div>
        ) : null}
        <div>favicon: {bookmark.favicon ?? 'Not extracted yet'}</div>
        <div>cover_url: {bookmark.coverUrl ?? 'Not extracted yet'}</div>
        <div>description_excerpt: {bookmark.descriptionExcerpt ?? 'Not extracted yet'}</div>
        {bookmark.processingStatus === 'failed' && onRetry ? (
          <button type="button" onClick={() => void onRetry(bookmark.id)} style={retryButtonStyle}>
            retry
          </button>
        ) : null}
      </section>

      <section style={{ display: 'grid', gap: 'var(--space-md)' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--type-heading)' }}>URL / title / description</h3>
        <label style={{ display: 'grid', gap: 'var(--space-sm)' }}>
          <span>title</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'grid', gap: 'var(--space-sm)' }}>
          <span>URL</span>
          <input value={url} onChange={(event) => setUrl(event.target.value)} style={inputStyle} />
        </label>
        <label style={{ display: 'grid', gap: 'var(--space-sm)' }}>
          <span>description</span>
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={4} style={inputStyle} />
        </label>
      </section>

      <section style={{ display: 'grid', gap: 'var(--space-md)' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--type-heading)' }}>category</h3>
        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} style={inputStyle}>
          {categoryOptions.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </section>

      <section style={{ display: 'grid', gap: 'var(--space-md)' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--type-heading)' }}>tags</h3>
        <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="tag-one, tag-two" style={inputStyle} />
      </section>

      <section style={{ display: 'grid', gap: 'var(--space-md)' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--type-heading)' }}>collections</h3>
        <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
          {collections.map((collection) => {
            const checked = selectedCollectionIds.includes(collection.id);
            return (
              <label key={collection.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setSelectedCollectionIds((current) =>
                      checked ? current.filter((id) => id !== collection.id) : [...current, collection.id],
                    )
                  }
                />
                <span>{collection.name}</span>
              </label>
            );
          })}
        </div>
      </section>

      <section style={{ display: 'grid', gap: 'var(--space-md)' }}>
        <h3 style={{ margin: 0, fontSize: 'var(--type-heading)' }}>star</h3>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <input type="checkbox" checked={isStarred} onChange={(event) => setIsStarred(event.target.checked)} />
          <span>Keep this bookmark starred</span>
        </label>
      </section>

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-md)', marginTop: 'auto' }}>
        <button type="button" onClick={() => void onDelete(bookmark.id)} style={deleteButtonStyle}>
          delete
        </button>
        <button
          type="button"
          onClick={() =>
            void onSave(bookmark.id, {
              title,
              url,
              description,
              primaryCategoryId: categoryId,
              isStarred,
              tags: buildTagInput(tags),
              collectionIds: selectedCollectionIds,
            })
          }
          disabled={isSaving}
          style={saveButtonStyle}
        >
          {isSaving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </aside>
  );
}

const inputStyle = {
  width: '100%',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border-subtle)',
  padding: '12px 14px',
  fontSize: 'var(--type-body)',
  background: '#FFFFFF',
} as const;

const retryButtonStyle = {
  borderRadius: '999px',
  border: '1px solid var(--color-accent)',
  background: 'transparent',
  color: 'var(--color-accent)',
  padding: '8px 12px',
  cursor: 'pointer',
  justifySelf: 'start',
} as const;

const deleteButtonStyle = {
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-destructive)',
  background: 'transparent',
  color: 'var(--color-destructive)',
  padding: '12px 16px',
  cursor: 'pointer',
} as const;

const saveButtonStyle = {
  borderRadius: 'var(--radius-md)',
  border: 'none',
  background: 'var(--color-accent)',
  color: '#FFFFFF',
  padding: '12px 18px',
  fontWeight: 'var(--weight-semibold)',
  cursor: 'pointer',
} as const;
