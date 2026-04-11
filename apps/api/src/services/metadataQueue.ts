import { URL } from 'node:url';
import type { RemoteDatabase } from '../db/client.js';

const inFlightJobs = new Set<string>();

interface BookmarkMetadataRow {
  id: string;
  url: string;
  title: string;
  user_edited_mask: string;
}

function formatTitleFromUrl(input: string): string {
  try {
    const parsed = new URL(input);
    const pathToken = parsed.pathname
      .split('/')
      .filter(Boolean)
      .at(-1)
      ?.replace(/[-_]+/g, ' ')
      .trim();

    if (pathToken && pathToken.length > 0) {
      return pathToken.charAt(0).toUpperCase() + pathToken.slice(1);
    }

    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return input;
  }
}

function buildFaviconUrl(input: string): string | null {
  try {
    const parsed = new URL(input);
    return `${parsed.protocol}//${parsed.host}/favicon.ico`;
  } catch {
    return null;
  }
}

function buildDescriptionExcerpt(input: string): string {
  try {
    const parsed = new URL(input);
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    return `Saved from ${parsed.hostname}${path}. Remote metadata finished processing.`;
  } catch {
    return 'Remote metadata finished processing.';
  }
}

function queueJob(bookmarkId: string, db: RemoteDatabase, force: boolean): void {
  const bookmark = db
    .prepare(
      `
        SELECT id, url, title, user_edited_mask
        FROM bookmarks
        WHERE id = ? AND deleted_at IS NULL
      `,
    )
    .get(bookmarkId) as BookmarkMetadataRow | undefined;

  if (!bookmark) {
    return;
  }

  if (inFlightJobs.has(bookmarkId)) {
    return;
  }

  const now = new Date().toISOString();
  db.prepare(
    `
      UPDATE bookmarks
      SET processing_status = 'processing',
          processing_error = NULL,
          updated_at = ?,
          version = version + 1
      WHERE id = ?
    `,
  ).run(now, bookmarkId);

  inFlightJobs.add(bookmarkId);

  setTimeout(() => {
    try {
      const userEditedMask = JSON.parse(bookmark.user_edited_mask || '[]') as string[];
      const derivedTitle = formatTitleFromUrl(bookmark.url);
      const nextNow = new Date().toISOString();

      const shouldReplaceTitle =
        force || !userEditedMask.includes('title') || !bookmark.title || bookmark.title === bookmark.url;

      db.prepare(
        `
          UPDATE bookmarks
          SET title = ?,
              description_excerpt = ?,
              favicon = ?,
              cover_url = NULL,
              processing_status = 'ready',
              processing_error = NULL,
              updated_at = ?,
              version = version + 1
          WHERE id = ?
        `,
      ).run(
        shouldReplaceTitle ? derivedTitle : bookmark.title,
        buildDescriptionExcerpt(bookmark.url),
        buildFaviconUrl(bookmark.url),
        nextNow,
        bookmarkId,
      );
    } catch (error) {
      db.prepare(
        `
          UPDATE bookmarks
          SET processing_status = 'failed',
              processing_error = ?,
              updated_at = ?,
              version = version + 1
          WHERE id = ?
        `,
      ).run(error instanceof Error ? error.message : 'Remote metadata processing failed.', new Date().toISOString(), bookmarkId);
    } finally {
      inFlightJobs.delete(bookmarkId);
    }
  }, 25);
}

export async function queueRemoteMetadataExtraction(bookmarkId: string, db: RemoteDatabase): Promise<void> {
  queueJob(bookmarkId, db, false);
}

export async function retryRemoteMetadataExtraction(bookmarkId: string, db: RemoteDatabase): Promise<void> {
  queueJob(bookmarkId, db, true);
}
