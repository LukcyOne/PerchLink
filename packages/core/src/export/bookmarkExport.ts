import type { BookmarkRecord, CategoryTreeNode, CollectionRecord, TagRecord } from '../bookmarks';

export interface BookmarkExportDataset {
  bookmarks: BookmarkRecord[];
  categories: CategoryTreeNode[];
  collections: CollectionRecord[];
}

function flattenCategories(categories: CategoryTreeNode[]): CategoryTreeNode[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children)]);
}

function collectTags(bookmarks: BookmarkRecord[]): TagRecord[] {
  const seen = new Map<string, TagRecord>();

  for (const bookmark of bookmarks) {
    for (const tag of bookmark.tags) {
      seen.set(tag.id, tag);
    }
  }

  return [...seen.values()];
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function serializeBookmarksToJsonExport(dataset: BookmarkExportDataset): string {
  const categories = flattenCategories(dataset.categories);
  const tags = collectTags(dataset.bookmarks);
  const bookmarkTags = dataset.bookmarks.flatMap((bookmark) =>
    bookmark.tags.map((tag) => ({ bookmarkId: bookmark.id, tagId: tag.id })),
  );
  const collectionMemberships = dataset.bookmarks.flatMap((bookmark) =>
    bookmark.collectionIds.map((collectionId) => ({ bookmarkId: bookmark.id, collectionId })),
  );

  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      bookmarks: dataset.bookmarks,
      categories,
      tags,
      collections: dataset.collections,
      bookmarkTags,
      collectionMemberships,
    },
    null,
    2,
  );
}

export function serializeBookmarksToHtmlExport(dataset: BookmarkExportDataset): string {
  const categories = new Map(flattenCategories(dataset.categories).map((category) => [category.id, category.name]));
  const grouped = new Map<string, BookmarkRecord[]>();

  for (const bookmark of dataset.bookmarks) {
    const groupKey = categories.get(bookmark.primaryCategoryId ?? 'system-unsorted') ?? 'Unsorted';
    const current = grouped.get(groupKey) ?? [];
    grouped.set(groupKey, [...current, bookmark]);
  }

  const sections = [...grouped.entries()].map(([categoryName, bookmarks]) => {
    const links = bookmarks
      .map(
        (bookmark) =>
          `    <DT><A HREF="${escapeHtml(bookmark.url)}">${escapeHtml(bookmark.title)}</A>${bookmark.description ? `\n    <DD>${escapeHtml(bookmark.description)}` : ''}`,
      )
      .join('\n');

    return `  <DT><H3>${escapeHtml(categoryName)}</H3>\n  <DL><p>\n${links}\n  </DL><p>`;
  });

  return [`<!DOCTYPE NETSCAPE-Bookmark-file-1>`, `<TITLE>PerchLink Export</TITLE>`, `<H1>PerchLink Export</H1>`, `<DL><p>`, ...sections, `</DL><p>`].join('\n');
}
