import { useEffect, useMemo, useState } from 'react';
import type { BookmarkRecord } from '@perchlink/core';
import { useBookmarksStore } from '@perchlink/store';
import { BookmarkCard, BookmarkDetailsDrawer, BookmarkListRow, CollectionListPane, QuickAddModal } from '@perchlink/ui';
import { useTranslation } from 'react-i18next';

function filterBookmarksByCollection(bookmarks: BookmarkRecord[], collectionId: string | null): BookmarkRecord[] {
  if (!collectionId) {
    return bookmarks;
  }

  return bookmarks.filter((bookmark) => bookmark.collectionIds.includes(collectionId));
}

export function CollectionsPage() {
  const { t } = useTranslation();
  const {
    bookmarks,
    categories,
    collections,
    activeView,
    selectedBookmarkId,
    isQuickAddOpen,
    isDetailsDrawerOpen,
    isSaving,
    error,
    searchTerm,
    hydrateReferenceData,
    loadBookmarks,
    saveCollection,
    deleteCollection,
    createBookmark,
    updateBookmark,
    deleteBookmark,
    retryMetadataExtraction,
    openDetails,
    closeDetails,
    closeQuickAdd,
    resetActiveFilters,
  } = useBookmarksStore();
  const [selectedCollectionId, setSelectedCollectionId] = useState<string | null>(null);

  useEffect(() => {
    resetActiveFilters();
    void Promise.all([hydrateReferenceData(), loadBookmarks({ sortBy: 'updatedAt', sortDirection: 'desc' })]);
  }, [hydrateReferenceData, loadBookmarks, resetActiveFilters]);

  useEffect(() => {
    if (!selectedCollectionId && collections.length > 0) {
      setSelectedCollectionId(collections[0]?.id ?? null);
    }
  }, [collections, selectedCollectionId]);

  useEffect(() => {
    void loadBookmarks({ sortBy: 'updatedAt', sortDirection: 'desc' });
  }, [loadBookmarks, searchTerm]);

  const selectedBookmark = bookmarks.find((bookmark) => bookmark.id === selectedBookmarkId) ?? null;
  const filteredBookmarks = useMemo(
    () => filterBookmarksByCollection(bookmarks, selectedCollectionId),
    [bookmarks, selectedCollectionId],
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 360px) minmax(0, 1fr)', gap: 'var(--space-xl)' }}>
      <CollectionListPane
        collections={collections}
        selectedCollectionId={selectedCollectionId}
        bookmarkIds={filteredBookmarks.map((bookmark) => bookmark.id)}
        onSelect={setSelectedCollectionId}
        createCollection={async (input) => {
          const collection = await saveCollection(input);
          setSelectedCollectionId(collection.id);
        }}
        updateCollection={async (input) => {
          const collection = await saveCollection(input);
          setSelectedCollectionId(collection.id);
        }}
        deleteCollection={async (collectionId) => {
          await deleteCollection(collectionId);
          setSelectedCollectionId(null);
        }}
      />

      <section
        style={{
          display: 'grid',
          gap: 'var(--space-lg)',
          minHeight: '70vh',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--color-border-subtle)',
          background: 'var(--color-surface-raised)',
          padding: 'var(--space-lg)',
        }}
      >
        <header>
          <div style={{ fontSize: 'var(--type-label)', color: 'var(--color-text-muted)' }}>master-detail</div>
          <h2 style={{ margin: 'var(--space-xs) 0 0', fontSize: 'var(--type-heading)' }}>Collection bookmark results</h2>
          <p style={{ margin: 'var(--space-sm) 0 0', color: 'var(--color-text-muted)' }}>
            Browse remote collection results on the right while editing collection membership from the same workspace.
          </p>
          {error ? <p style={{ color: 'var(--color-destructive)' }}>{error}</p> : null}
        </header>

        {filteredBookmarks.length === 0 ? (
          <div style={{ color: 'var(--color-text-muted)' }}>{t('shell.emptyStateHeading')}</div>
        ) : activeView === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-lg)' }}>
            {filteredBookmarks.map((bookmark) => (
              <BookmarkCard
                key={bookmark.id}
                bookmark={bookmark}
                primaryCategory={categories.find((category) => category.id === bookmark.primaryCategoryId)?.name ?? 'Unsorted'}
                onSelect={() => openDetails(bookmark.id)}
                onEdit={() => openDetails(bookmark.id)}
                onToggleStar={() => void updateBookmark(bookmark.id, { isStarred: !bookmark.isStarred })}
                onRetry={() => void retryMetadataExtraction(bookmark.id)}
              />
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
            {filteredBookmarks.map((bookmark) => (
              <BookmarkListRow
                key={bookmark.id}
                bookmark={bookmark}
                primaryCategory={categories.find((category) => category.id === bookmark.primaryCategoryId)?.name ?? 'Unsorted'}
                onSelect={() => openDetails(bookmark.id)}
                onEdit={() => openDetails(bookmark.id)}
                onToggleStar={() => void updateBookmark(bookmark.id, { isStarred: !bookmark.isStarred })}
                onRetry={() => void retryMetadataExtraction(bookmark.id)}
              />
            ))}
          </div>
        )}
      </section>

      <QuickAddModal
        isOpen={isQuickAddOpen}
        isSubmitting={isSaving}
        errorMessage={error}
        helperText={t('remote.quickAddHelper')}
        onClose={closeQuickAdd}
        onSubmit={async (url) => {
          await createBookmark({
            url,
            collectionIds: selectedCollectionId ? [selectedCollectionId] : [],
          });
        }}
      />

      <BookmarkDetailsDrawer
        bookmark={selectedBookmark}
        categories={categories}
        collections={collections}
        isOpen={isDetailsDrawerOpen}
        isSaving={isSaving}
        showAiPanel={false}
        layout="responsive"
        onClose={closeDetails}
        onDelete={deleteBookmark}
        onSave={async (bookmarkId, patch) => {
          await updateBookmark(bookmarkId, patch);
        }}
        onRetry={async (bookmarkId) => {
          await retryMetadataExtraction(bookmarkId);
        }}
      />
    </div>
  );
}
