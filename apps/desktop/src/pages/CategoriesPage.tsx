import { useEffect, useMemo, useState } from 'react';
import type { BookmarkRecord } from '@perchlink/core';
import { useBookmarksStore } from '@perchlink/store';
import { BookmarkCard, BookmarkDetailsDrawer, BookmarkListRow, CategoryTreePane, QuickAddModal } from '@perchlink/ui';

function filterBookmarksByCategory(bookmarks: BookmarkRecord[], categoryId: string | null): BookmarkRecord[] {
  if (!categoryId) {
    return bookmarks;
  }

  if (categoryId === 'system-unsorted') {
    return bookmarks.filter((bookmark) => !bookmark.primaryCategoryId || bookmark.primaryCategoryId === 'system-unsorted');
  }

  return bookmarks.filter((bookmark) => bookmark.primaryCategoryId === categoryId);
}

export function CategoriesPage() {
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
    saveCategory,
    deleteCategory,
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
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  useEffect(() => {
    resetActiveFilters();
    void Promise.all([hydrateReferenceData(), loadBookmarks({ sortBy: 'updatedAt', sortDirection: 'desc' })]);
  }, [hydrateReferenceData, loadBookmarks, resetActiveFilters]);

  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(categories[0]?.id ?? null);
    }
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    void loadBookmarks({ sortBy: 'updatedAt', sortDirection: 'desc' });
  }, [loadBookmarks, searchTerm]);

  const selectedBookmark = bookmarks.find((bookmark) => bookmark.id === selectedBookmarkId) ?? null;
  const filteredBookmarks = useMemo(
    () => filterBookmarksByCategory(bookmarks, selectedCategoryId),
    [bookmarks, selectedCategoryId],
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '360px minmax(0, 1fr)', gap: 'var(--space-xl)' }}>
      <CategoryTreePane
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelect={setSelectedCategoryId}
        onCreateCategory={async (input) => {
          const category = await saveCategory(input);
          setSelectedCategoryId(category.id);
        }}
        onUpdateCategory={async (input) => {
          const category = await saveCategory(input);
          setSelectedCategoryId(category.id);
        }}
        onDeleteCategory={async (categoryId) => {
          await deleteCategory(categoryId);
          setSelectedCategoryId('system-unsorted');
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
          <h2 style={{ margin: 'var(--space-xs) 0 0', fontSize: 'var(--type-heading)' }}>Category bookmark results</h2>
          <p style={{ margin: 'var(--space-sm) 0 0', color: 'var(--color-text-muted)' }}>
            bookmark results stay on the right while the category tree remains editable on the left.
          </p>
          {error ? <p style={{ color: 'var(--color-destructive)' }}>{error}</p> : null}
        </header>

        {filteredBookmarks.length === 0 ? (
          <div style={{ color: 'var(--color-text-muted)' }}>Create Categories Before You Sort the Library.</div>
        ) : activeView === 'grid' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-lg)' }}>
            {filteredBookmarks.map((bookmark) => (
              <BookmarkCard
                key={bookmark.id}
                bookmark={bookmark}
                primaryCategory={selectedCategoryId === 'system-unsorted' ? 'Unsorted' : categories.find((item) => item.id === selectedCategoryId)?.name}
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
                primaryCategory={selectedCategoryId === 'system-unsorted' ? 'Unsorted' : categories.find((item) => item.id === selectedCategoryId)?.name}
                onSelect={() => openDetails(bookmark.id)}
                onEdit={() => openDetails(bookmark.id)}
                onToggleStar={() => void updateBookmark(bookmark.id, { isStarred: !bookmark.isStarred })}
              />
            ))}
          </div>
        )}
      </section>

      <QuickAddModal
        isOpen={isQuickAddOpen}
        isSubmitting={isSaving}
        errorMessage={error}
        onClose={closeQuickAdd}
        onSubmit={async (url) => {
          await createBookmark({ url, primaryCategoryId: selectedCategoryId ?? 'system-unsorted' });
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
