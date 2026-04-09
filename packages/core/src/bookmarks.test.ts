import { describe, expect, it } from 'vitest';
import {
  BOOKMARK_AI_STATUSES,
  BOOKMARK_PROCESSING_STATUSES,
  mergeUserEditedMaskFromPatch,
  normalizeBookmarkUrl,
} from './bookmarks';

describe('normalizeBookmarkUrl', () => {
  it('trims whitespace, lowercases the authority, and removes trailing slash noise', () => {
    expect(normalizeBookmarkUrl('  HTTPS://Example.COM/Library/  ')).toBe('https://example.com/Library');
    expect(normalizeBookmarkUrl('https://Example.com/path///?view=grid')).toBe('https://example.com/path?view=grid');
    expect(normalizeBookmarkUrl('https://Example.com/#section')).toBe('https://example.com');
  });

  it('keeps non-URL input stable enough for pre-validation duplicate checks', () => {
    expect(normalizeBookmarkUrl('  example.com/path/  ')).toBe('example.com/path');
  });
});

describe('BOOKMARK_PROCESSING_STATUSES', () => {
  it('matches the supported processing status enum values exactly', () => {
    expect(BOOKMARK_PROCESSING_STATUSES).toEqual(['pending', 'processing', 'ready', 'failed']);
  });
});

describe('BOOKMARK_AI_STATUSES', () => {
  it('matches the supported AI status enum values exactly', () => {
    expect(BOOKMARK_AI_STATUSES).toEqual(['idle', 'running', 'ready', 'failed']);
  });
});

describe('mergeUserEditedMaskFromPatch', () => {
  it('keeps a protected empty field when description is cleared', () => {
    expect(mergeUserEditedMaskFromPatch([], { description: null })).toEqual(['description']);
  });

  it('marks category, tags, and title when those fields are patched', () => {
    expect(
      mergeUserEditedMaskFromPatch(['description'], {
        title: 'Updated title',
        primaryCategoryId: 'cat-1',
        tags: [],
      }),
    ).toEqual(['description', 'title', 'primaryCategoryId', 'tags']);
  });

  it('leaves the mask unchanged for non-content updates', () => {
    expect(mergeUserEditedMaskFromPatch(['description'], { isStarred: true })).toEqual(['description']);
  });

  it('explicit replace keeps protection for previously protected AI-managed fields', () => {
    expect(
      mergeUserEditedMaskFromPatch(['description', 'tags'], {
        description: 'AI replacement',
        tags: [{ label: 'ai' }],
      }),
    ).toEqual(['description', 'tags']);
  });
});
