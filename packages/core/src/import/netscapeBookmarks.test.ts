import { describe, expect, it } from 'vitest';
import { parseNetscapeBookmarksHtml } from './netscapeBookmarks';

const sampleNetscapeBookmarkHtml = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
  <DT><H3>Reading</H3>
  <DL><p>
    <DT><A HREF="https://example.com/articles/one/">Example Article</A>
  </DL><p>
  <DT><H3>Tools</H3>
  <DL><p>
    <DT><A HREF="https://perchlink.dev/">PerchLink</A>
  </DL><p>
</DL><p>`;

describe('parseNetscapeBookmarksHtml', () => {
  it('reads Netscape bookmark html with nested folder paths', () => {
    const bookmarks = parseNetscapeBookmarksHtml(sampleNetscapeBookmarkHtml);

    expect(bookmarks).toHaveLength(2);
    expect(bookmarks[0]).toMatchObject({
      title: 'Example Article',
      url: 'https://example.com/articles/one/',
      folderPath: ['Reading'],
      normalized_url: 'https://example.com/articles/one',
    });
    expect(bookmarks[1]?.folderPath).toEqual(['Tools']);
  });
});
