import { useEffect, useMemo } from 'react';
import type { BookmarkListQuery, BookmarkRecord, CategoryTreeNode } from '@perchlink/core';
import { useBookmarksStore } from '@perchlink/store';
import { BookmarkCard, BookmarkDetailsDrawer, BookmarkListRow, QuickAddModal } from '@perchlink/ui';
import { useTranslation } from 'react-i18next';

type BrowseScope = 'all' | 'starred' | 'recent';

interface BookmarksBrowseWorkspaceProps {
  scope: BrowseScope;
}

function flattenCategories(categories: CategoryTreeNode[]): CategoryTreeNode[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children)]);
}

function resolvePrimaryCategory(bookmark: BookmarkRecord, categories: CategoryTreeNode[]): string {
  const categoryMap = new Map(flattenCategories(categories).map((category) => [category.id, category.name]));
  return categoryMap.get(bookmark.primaryCategoryId ?? 'system-unsorted') ?? 'Unsorted';
}

export function buildBrowseQuery(scope: BrowseScope): BookmarkListQuery {
  switch (scope) {
    case 'starred':
      return { isStarred: true, sortBy: 'updatedAt', sortDirection: 'desc' };
    case 'recent':
      return { sortBy: 'createdAt', sortDirection: 'desc' };
    default:
      return { sortBy: 'updatedAt', sortDirection: 'desc' };
  }
}

export function BookmarksBrowseWorkspace({ scope }: BookmarksBrowseWorkspaceProps) {
  const { t } = useTranslation();
  const {
    bookmarks,
    categories,
    collections,
    activeView,
    selectedBookmarkId,
    isQuickAddOpen,
    isDetailsDrawerOpen,
    isLoading,
    isSaving,
    error,
    activeFilters,
    searchTerm,
    hydrateReferenceData,
    loadBookmarks,
    openDetails,
    closeDetails,
    closeQuickAdd,
    createBookmark,
    updateBookmark,
    deleteBookmark,
    retryMetadataExtraction,
  } = useBookmarksStore();

  const browseQuery = useMemo(() => buildBrowseQuery(scope), [scope]);
  const selectedBookmark = bookmarks.find((bookmark) => bookmark.id === selectedBookmarkId) ?? null;

  useEffect(() => {
    void hydrateReferenceData();
  }, [hydrateReferenceData]);

  useEffect(() => {
    void loadBookmarks(browseQuery);
  }, [
    activeFilters.categoryId,
    activeFilters.collectionId,
    activeFilters.processingStatuses.join(','),
    activeFilters.starredOnly,
    activeFilters.tagIds.join(','),
    browseQuery,
    loadBookmarks,
    searchTerm,
  ]);

  return (
    <div style={{ display: 'grid', gap: 'var(--space-lg)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-lg)' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 'var(--type-heading)' }}>
            {scope === 'all' ? 'Browse every remote bookmark' : scope === 'starred' ? 'Starred bookmarks' : 'Recent bookmarks'}
          </h2>
          <p style={{ margin: 'var(--space-xs) 0 0', color: 'var(--color-text-muted)' }}>
            {isLoading ? 'Loading remote bookmark results...' : `${bookmarks.length} results in the current Web view.`}
          </p>
        </div>
        {error ? <span style={{ color: 'var(--color-destructive)' }}>{error}</span> : null}
      </header>

      {bookmarks.length === 0 ? (
        <section
          style={{
            padding: 'var(--space-2xl)',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--color-border-subtle)',
            background: 'rgba(231, 222, 208, 0.4)',
          }}
        >
          <h3 style={{ marginTop: 0 }}>{t('remote.emptyHeading')}</h3>
          <p style={{ marginBottom: 0, color: 'var(--color-text-muted)' }}>{t('remote.emptyBody')}</p>
        </section>
      ) : activeView === 'grid' ? (
        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 'var(--space-lg)',
          }}
        >
          {bookmarks.map((bookmark) => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              primaryCategory={resolvePrimaryCategory(bookmark, categories)}
              onSelect={() => openDetails(bookmark.id)}
              onEdit={() => openDetails(bookmark.id)}
              onToggleStar={() => void updateBookmark(bookmark.id, { isStarred: !bookmark.isStarred })}
              onRetry={() => void retryMetadataExtraction(bookmark.id)}
            />
          ))}
        </section>
      ) : (
        <section style={{ display: 'grid', gap: 'var(--space-md)' }}>
          {bookmarks.map((bookmark) => (
            <BookmarkListRow
              key={bookmark.id}
              bookmark={bookmark}
              primaryCategory={resolvePrimaryCategory(bookmark, categories)}
              onSelect={() => openDetails(bookmark.id)}
              onEdit={() => openDetails(bookmark.id)}
              onToggleStar={() => void updateBookmark(bookmark.id, { isStarred: !bookmark.isStarred })}
              onRetry={() => void retryMetadataExtraction(bookmark.id)}
            />
          ))}
        </section>
      )}

      <QuickAddModal
        isOpen={isQuickAddOpen}
        isSubmitting={isSaving}
        errorMessage={error}
        titleText="Add Link"
        helperText={t('remote.quickAddHelper')}
        onClose={closeQuickAdd}
        onSubmit={async (url) => {
          await createBookmark({ url });
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
        onDelete={async (bookmarkId) => {
          await deleteBookmark(bookmarkId);
        }}
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

export function AllBookmarksPage() {
  return <BookmarksBrowseWorkspace scope="all" />;
}
