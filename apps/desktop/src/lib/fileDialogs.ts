import { open, save } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';

export async function openBookmarkImportDialog(): Promise<string | null> {
  const selected = await open({
    title: 'Import Browser Bookmarks',
    filters: [{ name: 'Bookmark HTML', extensions: ['html', 'htm'] }],
    multiple: false,
  });

  return typeof selected === 'string' ? selected : null;
}

export async function readTextFileFromPath(path: string): Promise<string> {
  return readTextFile(path);
}

export async function saveBookmarkExportDialog(defaultPath: string): Promise<string | null> {
  const selected = await save({ defaultPath });
  return typeof selected === 'string' ? selected : null;
}

export async function writeTextExportFile(path: string, content: string): Promise<void> {
  await writeTextFile(path, content);
}
