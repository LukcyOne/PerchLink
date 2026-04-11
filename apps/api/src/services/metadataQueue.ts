import { URL } from 'node:url';
import type { RemoteDatabase } from '../db/client.js';
import { loadBookmarkSyncSnapshot } from './syncEvents.js';
import { upsertBookmarkCanonical } from './syncMutations.js';

const inFlightJobs = new Set<string>();

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

function loadAccountId(db: RemoteDatabase): string | null {
  const row = db.prepare('SELECT id FROM accounts ORDER BY created_at ASC LIMIT 1').get() as { id: string } | undefined;
  return row?.id ?? null;
}

function queueJob(bookmarkId: string, db: RemoteDatabase, force: boolean): void {
  const accountId = loadAccountId(db);
  const bookmark = loadBookmarkSyncSnapshot(db, bookmarkId);

  if (!accountId || !bookmark || bookmark.deletedAt) {
    return;
  }

  if (inFlightJobs.has(bookmarkId)) {
    return;
  }

  db.transaction(() => {
    upsertBookmarkCanonical({
      db,
      accountId,
      snapshot: {
        ...bookmark,
        processingStatus: 'processing',
        processingError: null,
      },
      writerKind: 'system',
      actorDeviceId: null,
      changedFields: ['processingStatus', 'processingError'],
    });
  })();

  inFlightJobs.add(bookmarkId);

  setTimeout(() => {
    try {
      const currentBookmark = loadBookmarkSyncSnapshot(db, bookmarkId);

      if (!currentBookmark || currentBookmark.deletedAt) {
        return;
      }

      const userEditedMask = currentBookmark.userEditedMask;
      const derivedTitle = formatTitleFromUrl(currentBookmark.url);

      const shouldReplaceTitle =
        force || !userEditedMask.includes('title') || !currentBookmark.title || currentBookmark.title === currentBookmark.url;

      db.transaction(() => {
        upsertBookmarkCanonical({
          db,
          accountId,
          snapshot: {
            ...currentBookmark,
            title: shouldReplaceTitle ? derivedTitle : currentBookmark.title,
            descriptionExcerpt: buildDescriptionExcerpt(currentBookmark.url),
            favicon: buildFaviconUrl(currentBookmark.url),
            coverUrl: null,
            processingStatus: 'ready',
            processingError: null,
          },
          writerKind: 'system',
          actorDeviceId: null,
          changedFields: ['title', 'descriptionExcerpt', 'favicon', 'coverUrl', 'processingStatus', 'processingError'],
        });
      })();
    } catch (error) {
      const currentBookmark = loadBookmarkSyncSnapshot(db, bookmarkId);

      if (currentBookmark && !currentBookmark.deletedAt) {
        db.transaction(() => {
          upsertBookmarkCanonical({
            db,
            accountId,
            snapshot: {
              ...currentBookmark,
              processingStatus: 'failed',
              processingError: error instanceof Error ? error.message : 'Remote metadata processing failed.',
            },
            writerKind: 'system',
            actorDeviceId: null,
            changedFields: ['processingStatus', 'processingError'],
          });
        })();
      }
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
