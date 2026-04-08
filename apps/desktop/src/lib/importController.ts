import type { BookmarkRepository, BookmarkRecord } from '@perchlink/core';
import { parseNetscapeBookmarksHtml } from '@perchlink/core';
import { openBookmarkImportDialog, readTextFileFromPath } from './fileDialogs';

export interface ImportProgressResult {
  successCount: number;
  failedCount: number;
  skippedCount: number;
  importedBookmarks: BookmarkRecord[];
}

async function importBookmarksHtml(repository: BookmarkRepository, html: string): Promise<ImportProgressResult> {
  const candidates = parseNetscapeBookmarksHtml(html);
  const existing = await repository.listBookmarks({ sortBy: 'updatedAt', sortDirection: 'desc', limit: 5000 });
  const knownNormalizedUrls = new Set(existing.map((bookmark) => bookmark.normalizedUrl));
  const importedBookmarks: BookmarkRecord[] = [];
  let successCount = 0;
  let failedCount = 0;
  let skippedCount = 0;

  for (const candidate of candidates) {
    const normalized_url = candidate.normalized_url;
    const processing_status = 'pending' as const;

    if (knownNormalizedUrls.has(normalized_url)) {
      skippedCount += 1;
      continue;
    }

    try {
      const bookmark = await repository.createBookmark({
        url: candidate.url,
        title: candidate.title,
        description: candidate.description,
        primaryCategoryId: 'system-unsorted',
        processingStatus: processing_status,
      });
      knownNormalizedUrls.add(normalized_url);
      importedBookmarks.push(bookmark);
      successCount += 1;
      void repository.queueMetadataExtraction(bookmark.id);
    } catch {
      failedCount += 1;
    }
  }

  return { successCount, failedCount, skippedCount, importedBookmarks };
}

export async function importBookmarksFromDialog(repository: BookmarkRepository): Promise<ImportProgressResult | null> {
  const filePath = await openBookmarkImportDialog();

  if (!filePath) {
    return null;
  }

  const html = await readTextFileFromPath(filePath);
  return importBookmarksHtml(repository, html);
}

export async function importBookmarksFromDroppedHtml(repository: BookmarkRepository, html: string): Promise<ImportProgressResult> {
  return importBookmarksHtml(repository, html);
}
