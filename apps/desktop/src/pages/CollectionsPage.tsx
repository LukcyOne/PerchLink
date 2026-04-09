import { useEffect, useMemo, useState } from 'react';
import type { BookmarkRecord } from '@perchlink/core';
import { useBookmarksStore } from '@perchlink/store';
import { BookmarkCard, BookmarkDetailsDrawer, BookmarkListRow, CollectionListPane, QuickAddModal } from '@perchlink/ui';

function filterBookmarksByCollection(bookmarks: BookmarkRecord[], collectionId: string | null): BookmarkRecord[] {
  if (!collectionId) {
    return bookmarks;
  }

  return bookmarks.filter((bookmark) => bookmark.collectionIds.includes(collectionId));
}

export function CollectionsPage() {
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
    retryAiEnrichment,
    applyAiSuggestions,
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
    <div style={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', gap: 'var(--space-xl)' }}>
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
            bookmark results appear on the right, and you can update collection membership from the same workspace.
          </p>
          {error ? <p style={{ color: 'var(--color-destructive)' }}>{error}</p> : null}
        </header>

        {filteredBookmarks.length === 0 ? (
          <div style={{ color: 'var(--color-text-muted)' }}>Use Collections to Group Themes Across Categories.</div>
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
              />
            ))}
          </div>
        )}

        {selectedCollectionId ? (
          <section style={{ display: 'grid', gap: 'var(--space-sm)' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--type-heading)' }}>Edit membership</h3>
            {bookmarks.map((bookmark) => {
              const checked = bookmark.collectionIds.includes(selectedCollectionId);
              return (
                <label key={bookmark.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      void updateBookmark(bookmark.id, {
                        collectionIds: checked
                          ? bookmark.collectionIds.filter((collectionId) => collectionId !== selectedCollectionId)
                          : [...bookmark.collectionIds, selectedCollectionId],
                      })
                    }
                  />
                  <span>{bookmark.title}</span>
                </label>
              );
            })}
          </section>
        ) : null}
      </section>

      <QuickAddModal
        isOpen={isQuickAddOpen}
        isSubmitting={isSaving}
        errorMessage={error}
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
        onClose={closeDetails}
        onDelete={deleteBookmark}
        onSave={async (bookmarkId, patch) => {
          await updateBookmark(bookmarkId, patch);
        }}
        onRetry={async (bookmarkId) => {
          await retryMetadataExtraction(bookmarkId);
        }}
        onRetryAi={async (bookmarkId) => {
          await retryAiEnrichment(bookmarkId);
        }}
        onApplyAi={async (bookmarkId, input) => {
          await applyAiSuggestions(bookmarkId, input);
        }}
      />
    </div>
  );
}
