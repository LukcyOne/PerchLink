import { describe, expect, it } from 'vitest';
import { BOOKMARK_PROCESSING_STATUSES, normalizeBookmarkUrl } from './bookmarks';

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
