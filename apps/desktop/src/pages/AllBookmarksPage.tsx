import { useEffect, useMemo, useState } from 'react';
import type { BookmarkListQuery, BookmarkRecord, CategoryTreeNode } from '@perchlink/core';
import { useBookmarksStore } from '@perchlink/store';
import { BookmarkCard, BookmarkDetailsDrawer, BookmarkListRow, ImportExportBar, ImportProgressPanel, QuickAddModal } from '@perchlink/ui';
import { exportBookmarksAsHtml, exportBookmarksAsJson } from '../lib/exportController';
import { importBookmarksFromDialog, importBookmarksFromDroppedHtml, type ImportProgressResult } from '../lib/importController';

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

function buildBrowseQuery(scope: BrowseScope): BookmarkListQuery {
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
  const {
    repository,
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
    searchTerm,
    activeFilters,
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
  const [importProgress, setImportProgress] = useState<ImportProgressResult>({
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    importedBookmarks: [],
  });

  const browseQuery = useMemo(() => buildBrowseQuery(scope), [scope]);
  const selectedBookmark = bookmarks.find((bookmark) => bookmark.id === selectedBookmarkId) ?? null;
  const processingCount = bookmarks.filter(
    (bookmark) => bookmark.processingStatus === 'pending' || bookmark.processingStatus === 'processing',
  ).length;

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

  const handleImportComplete = async (result: ImportProgressResult | null) => {
    if (!result) {
      return;
    }

    setImportProgress(result);
    await Promise.all([hydrateReferenceData(), loadBookmarks(browseQuery)]);
  };

  return (
    <div
      style={{ display: 'grid', gap: 'var(--space-lg)' }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={async (event) => {
        event.preventDefault();

        if (!repository) {
          return;
        }

        const [file] = [...event.dataTransfer.files];

        if (!file || !file.name.toLowerCase().endsWith('.html')) {
          return;
        }

        await handleImportComplete(await importBookmarksFromDroppedHtml(repository, await file.text()));
      }}
    >
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-lg)' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 'var(--type-heading)' }}>
            {scope === 'all' ? 'Browse every local bookmark' : scope === 'starred' ? 'Starred bookmarks' : 'Recent bookmarks'}
          </h2>
          <p style={{ margin: 'var(--space-xs) 0 0', color: 'var(--color-text-muted)' }}>
            {isLoading ? 'Loading local bookmark results...' : `${bookmarks.length} results in the current desktop view.`}
          </p>
        </div>
        {error ? <span style={{ color: 'var(--color-destructive)' }}>{error}</span> : null}
      </header>

      <ImportExportBar
        isBusy={isSaving}
        onImport={async () => {
          if (!repository) {
            return;
          }

          await handleImportComplete(await importBookmarksFromDialog(repository));
        }}
        onExportJson={async () => {
          if (!repository) {
            return;
          }

          await exportBookmarksAsJson(repository);
        }}
        onExportHtml={async () => {
          if (!repository) {
            return;
          }

          await exportBookmarksAsHtml(repository);
        }}
      />

      <ImportProgressPanel
        successCount={importProgress.successCount}
        failedCount={importProgress.failedCount}
        skippedCount={importProgress.skippedCount}
        processingCount={processingCount}
      />

      {bookmarks.length === 0 ? (
        <section
          style={{
            padding: 'var(--space-2xl)',
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--color-border-subtle)',
            background: 'rgba(231, 222, 208, 0.4)',
          }}
        >
          <h3 style={{ marginTop: 0 }}>Build Your Library From the First Link</h3>
          <p style={{ marginBottom: 0, color: 'var(--color-text-muted)' }}>
            Add a link, use the import dialog, or drop bookmark HTML into this page. Bookmarks save locally first and then fill in the rest of the details.
          </p>
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
