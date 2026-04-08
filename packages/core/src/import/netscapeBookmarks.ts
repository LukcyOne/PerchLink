import { normalizeBookmarkUrl, type CreateBookmarkInput } from '../bookmarks';

export interface ParsedNetscapeBookmark extends CreateBookmarkInput {
  folderPath: string[];
  normalized_url: string;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function parseNetscapeBookmarksHtml(html: string): ParsedNetscapeBookmark[] {
  const lines = html.split(/\r?\n/);
  const folderStack: string[] = [];
  const pendingFolders: string[] = [];
  const bookmarks: ParsedNetscapeBookmark[] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const folderMatch = line.match(/<H3[^>]*>(.*?)<\/H3>/i);

    if (folderMatch) {
      pendingFolders.push(decodeHtml(folderMatch[1]));
      continue;
    }

    if (/<DL>/i.test(line)) {
      if (pendingFolders.length > 0) {
        folderStack.push(pendingFolders.pop() as string);
      }
      continue;
    }

    if (/<\/DL>/i.test(line)) {
      folderStack.pop();
      continue;
    }

    const anchorMatch = line.match(/<A\s+([^>]*HREF=\"([^\"]+)\"[^>]*)>(.*?)<\/A>/i);

    if (anchorMatch) {
      const url = decodeHtml(anchorMatch[2]);
      const title = decodeHtml(anchorMatch[3]);
      const normalized_url = normalizeBookmarkUrl(url);

      bookmarks.push({
        url,
        title,
        description: null,
        folderPath: [...folderStack],
        normalized_url,
      });
    }
  }

  return bookmarks;
}
