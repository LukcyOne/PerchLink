import { describe, expect, it } from 'vitest';
import { serializeBookmarksToHtmlExport, serializeBookmarksToJsonExport } from './bookmarkExport';

const dataset = {
  bookmarks: [
    {
      id: 'bookmark-1',
      url: 'https://example.com',
      normalizedUrl: 'https://example.com',
      title: 'Example',
      description: 'Saved from tests',
      descriptionExcerpt: 'Saved from tests',
      favicon: null,
      coverUrl: null,
      primaryCategoryId: 'system-unsorted',
      tags: [{ id: 'tag-1', label: 'read', color: null, createdAt: '2026-04-07', updatedAt: '2026-04-07' }],
      collectionIds: ['collection-1'],
      isStarred: false,
      processingStatus: 'ready' as const,
      processingError: null,
      aiSuggestion: null,
      userEditedMask: [],
      createdAt: '2026-04-07',
      updatedAt: '2026-04-07',
      deletedAt: null,
    },
  ],
  categories: [
    {
      id: 'system-unsorted',
      name: 'Unsorted',
      slug: 'unsorted',
      parentId: null,
      sortOrder: 0,
      isSystem: true,
      bookmarkCount: 1,
      createdAt: '2026-04-07',
      updatedAt: '2026-04-07',
      children: [],
    },
  ],
  collections: [
    {
      id: 'collection-1',
      name: 'Testing',
      description: null,
      sortOrder: 1,
      bookmarkCount: 1,
      createdAt: '2026-04-07',
      updatedAt: '2026-04-07',
    },
  ],
};

describe('bookmark export serializers', () => {
  it('serializeBookmarksToJsonExport includes collections and relation data', () => {
    const output = serializeBookmarksToJsonExport(dataset);
    expect(output).toContain('collectionMemberships');
    expect(output).toContain('collections');
    expect(output).toContain('bookmarkTags');
  });

  it('serializeBookmarksToHtmlExport emits browser-compatible Netscape markup', () => {
    const output = serializeBookmarksToHtmlExport(dataset);
    expect(output).toContain('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
    expect(output).toContain('<A HREF="https://example.com">Example</A>');
  });
});
