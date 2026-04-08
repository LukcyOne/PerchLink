import type { BookmarkRepository } from '@perchlink/core';
import { serializeBookmarksToHtmlExport, serializeBookmarksToJsonExport } from '@perchlink/core';
import { saveBookmarkExportDialog, writeTextExportFile } from './fileDialogs';

async function loadExportDataset(repository: BookmarkRepository) {
  const [bookmarks, categories, collections] = await Promise.all([
    repository.listBookmarks({ sortBy: 'updatedAt', sortDirection: 'desc', limit: 5000 }),
    repository.listCategories(),
    repository.listCollections(),
  ]);

  return { bookmarks, categories, collections };
}

export async function exportBookmarksAsJson(repository: BookmarkRepository): Promise<void> {
  const dataset = await loadExportDataset(repository);
  const filePath = await saveBookmarkExportDialog('perchlink-bookmarks.json');

  if (!filePath) {
    return;
  }

  await writeTextExportFile(filePath, serializeBookmarksToJsonExport(dataset));
}

export async function exportBookmarksAsHtml(repository: BookmarkRepository): Promise<void> {
  const dataset = await loadExportDataset(repository);
  const filePath = await saveBookmarkExportDialog('perchlink-bookmarks.html');

  if (!filePath) {
    return;
  }

  await writeTextExportFile(filePath, serializeBookmarksToHtmlExport(dataset));
}
