import { normalizeSyncBookmarkUrl, type SyncBookmarkSnapshot, type SyncCategorySnapshot, type SyncCollectionSnapshot, type SyncReasonCode, type SyncWriterKind } from '../syncContract.js';
import type { RemoteDatabase } from '../db/client.js';
import { appendSyncEvent, loadBookmarkSyncSnapshot, loadCategorySyncSnapshot, loadCollectionSyncSnapshot } from './syncEvents.js';

export class SyncMutationError extends Error {
  constructor(
    public readonly reasonCode: SyncReasonCode,
    message: string,
  ) {
    super(message);
    this.name = 'SyncMutationError';
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function ensureActiveCategoryExists(db: RemoteDatabase, categoryId: string | null): void {
  if (!categoryId) {
    return;
  }

  const row = db
    .prepare(
      `
        SELECT id
        FROM categories
        WHERE id = ?
          AND deleted_at IS NULL
      `,
    )
    .get(categoryId) as { id: string } | undefined;

  if (!row) {
    throw new SyncMutationError('dependency_missing', `Category ${categoryId} is not available.`);
  }
}

function ensureActiveCollectionsExist(db: RemoteDatabase, collectionIds: string[]): void {
  for (const collectionId of collectionIds) {
    const row = db
      .prepare(
        `
          SELECT id
          FROM collections
          WHERE id = ?
            AND deleted_at IS NULL
        `,
      )
      .get(collectionId) as { id: string } | undefined;

    if (!row) {
      throw new SyncMutationError('dependency_missing', `Collection ${collectionId} is not available.`);
    }
  }
}

function syncBookmarkTags(db: RemoteDatabase, bookmarkId: string, tags: SyncBookmarkSnapshot['tags']): void {
  db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);

  for (const tag of tags) {
    if (!tag.label.trim()) {
      continue;
    }

    const existing = db
      .prepare(
        `
          SELECT id
          FROM tags
          WHERE label = ? COLLATE NOCASE
        `,
      )
      .get(tag.label.trim()) as { id: string } | undefined;

    const tagId = existing?.id ?? tag.id;

    if (!existing) {
      db.prepare(
        `
          INSERT INTO tags (id, label, color, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
        `,
      ).run(tagId, tag.label.trim(), tag.color ?? null, nowIso(), nowIso());
    } else {
      db.prepare(
        `
          UPDATE tags
          SET color = ?, updated_at = ?
          WHERE id = ?
        `,
      ).run(tag.color ?? null, nowIso(), tagId);
    }

    db.prepare(
      `
        INSERT OR IGNORE INTO bookmark_tags (bookmark_id, tag_id, created_at)
        VALUES (?, ?, ?)
      `,
    ).run(bookmarkId, tagId, nowIso());
  }
}

function syncBookmarkCollections(db: RemoteDatabase, bookmarkId: string, collectionIds: string[]): void {
  db.prepare('DELETE FROM collection_bookmarks WHERE bookmark_id = ?').run(bookmarkId);

  collectionIds.forEach((collectionId, index) => {
    db.prepare(
      `
        INSERT OR IGNORE INTO collection_bookmarks (collection_id, bookmark_id, position, created_at)
        VALUES (?, ?, ?, ?)
      `,
    ).run(collectionId, bookmarkId, index, nowIso());
  });
}

function assertBookmarkNaturalKeyAvailable(db: RemoteDatabase, snapshot: SyncBookmarkSnapshot): void {
  const duplicate = db
    .prepare(
      `
        SELECT id
        FROM bookmarks
        WHERE normalized_url = ?
          AND id != ?
          AND deleted_at IS NULL
      `,
    )
    .get(snapshot.normalizedUrl, snapshot.id) as { id: string } | undefined;

  if (duplicate) {
    throw new SyncMutationError('duplicate_natural_key', `Bookmark ${snapshot.normalizedUrl} already exists.`);
  }
}

export function upsertBookmarkCanonical(args: {
  db: RemoteDatabase;
  accountId: string;
  snapshot: SyncBookmarkSnapshot;
  writerKind: SyncWriterKind;
  actorDeviceId?: string | null;
  changedFields: string[];
}) {
  const { db, accountId, snapshot, writerKind, actorDeviceId, changedFields } = args;
  ensureActiveCategoryExists(db, snapshot.primaryCategoryId ?? 'system-unsorted');
  ensureActiveCollectionsExist(db, snapshot.collectionIds);
  assertBookmarkNaturalKeyAvailable(db, snapshot);

  const current = loadBookmarkSyncSnapshot(db, snapshot.id);
  const nextVersion = current ? current.version + 1 : 1;
  const createdAt = current?.createdAt ?? snapshot.createdAt ?? nowIso();
  const updatedAt = nowIso();
  const deletedAt = snapshot.deletedAt ?? null;

  if (!current) {
    db.prepare(
      `
        INSERT INTO bookmarks (
          id,
          url,
          normalized_url,
          title,
          description,
          description_excerpt,
          favicon,
          cover_url,
          primary_category_id,
          is_starred,
          processing_status,
          processing_error,
          user_edited_mask,
          version,
          created_at,
          updated_at,
          deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      snapshot.id,
      snapshot.url,
      normalizeSyncBookmarkUrl(snapshot.url),
      snapshot.title,
      snapshot.description,
      snapshot.descriptionExcerpt,
      snapshot.favicon,
      snapshot.coverUrl,
      snapshot.primaryCategoryId ?? 'system-unsorted',
      snapshot.isStarred ? 1 : 0,
      snapshot.processingStatus,
      snapshot.processingError,
      JSON.stringify(snapshot.userEditedMask),
      nextVersion,
      createdAt,
      updatedAt,
      deletedAt,
    );
  } else {
    db.prepare(
      `
        UPDATE bookmarks
        SET
          url = ?,
          normalized_url = ?,
          title = ?,
          description = ?,
          description_excerpt = ?,
          favicon = ?,
          cover_url = ?,
          primary_category_id = ?,
          is_starred = ?,
          processing_status = ?,
          processing_error = ?,
          user_edited_mask = ?,
          version = ?,
          updated_at = ?,
          deleted_at = ?
        WHERE id = ?
      `,
    ).run(
      snapshot.url,
      normalizeSyncBookmarkUrl(snapshot.url),
      snapshot.title,
      snapshot.description,
      snapshot.descriptionExcerpt,
      snapshot.favicon,
      snapshot.coverUrl,
      snapshot.primaryCategoryId ?? 'system-unsorted',
      snapshot.isStarred ? 1 : 0,
      snapshot.processingStatus,
      snapshot.processingError,
      JSON.stringify(snapshot.userEditedMask),
      nextVersion,
      updatedAt,
      deletedAt,
      snapshot.id,
    );
  }

  syncBookmarkTags(db, snapshot.id, snapshot.tags);
  syncBookmarkCollections(db, snapshot.id, snapshot.collectionIds);

  return appendSyncEvent(db, {
    accountId,
    entityType: 'bookmark',
    entityId: snapshot.id,
    operation: deletedAt ? 'delete' : 'upsert',
    writerKind,
    actorDeviceId,
    changedFields,
  });
}

export function deleteBookmarkCanonical(args: {
  db: RemoteDatabase;
  accountId: string;
  bookmarkId: string;
  writerKind: SyncWriterKind;
  actorDeviceId?: string | null;
}) {
  const { db, accountId, bookmarkId, writerKind, actorDeviceId } = args;
  const current = loadBookmarkSyncSnapshot(db, bookmarkId);

  if (!current || current.deletedAt) {
    return null;
  }

  db.prepare(
    `
      UPDATE bookmarks
      SET deleted_at = ?, updated_at = ?, version = version + 1
      WHERE id = ?
    `,
  ).run(nowIso(), nowIso(), bookmarkId);

  return appendSyncEvent(db, {
    accountId,
    entityType: 'bookmark',
    entityId: bookmarkId,
    operation: 'delete',
    writerKind,
    actorDeviceId,
    changedFields: ['deletedAt'],
  });
}

export function upsertCategoryCanonical(args: {
  db: RemoteDatabase;
  accountId: string;
  snapshot: SyncCategorySnapshot;
  writerKind: SyncWriterKind;
  actorDeviceId?: string | null;
  changedFields: string[];
}) {
  const { db, accountId, snapshot, writerKind, actorDeviceId, changedFields } = args;

  if (snapshot.parentId) {
    ensureActiveCategoryExists(db, snapshot.parentId);
  }

  const current = loadCategorySyncSnapshot(db, snapshot.id);
  const nextVersion = current ? current.version + 1 : 1;
  const createdAt = current?.createdAt ?? snapshot.createdAt ?? nowIso();
  const updatedAt = nowIso();
  const deletedAt = snapshot.deletedAt ?? null;

  if (!current) {
    db.prepare(
      `
        INSERT INTO categories (
          id,
          name,
          slug,
          parent_id,
          sort_order,
          is_system,
          version,
          created_at,
          updated_at,
          deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      snapshot.id,
      snapshot.name,
      snapshot.slug,
      snapshot.parentId,
      snapshot.sortOrder,
      snapshot.isSystem ? 1 : 0,
      nextVersion,
      createdAt,
      updatedAt,
      deletedAt,
    );
  } else {
    db.prepare(
      `
        UPDATE categories
        SET
          name = ?,
          slug = ?,
          parent_id = ?,
          sort_order = ?,
          is_system = ?,
          version = ?,
          updated_at = ?,
          deleted_at = ?
        WHERE id = ?
      `,
    ).run(
      snapshot.name,
      snapshot.slug,
      snapshot.parentId,
      snapshot.sortOrder,
      snapshot.isSystem ? 1 : 0,
      nextVersion,
      updatedAt,
      deletedAt,
      snapshot.id,
    );
  }

  return appendSyncEvent(db, {
    accountId,
    entityType: 'category',
    entityId: snapshot.id,
    operation: deletedAt ? 'delete' : 'upsert',
    writerKind,
    actorDeviceId,
    changedFields,
  });
}

export function deleteCategoryCanonical(args: {
  db: RemoteDatabase;
  accountId: string;
  categoryId: string;
  writerKind: SyncWriterKind;
  actorDeviceId?: string | null;
}) {
  const { db, accountId, categoryId, writerKind, actorDeviceId } = args;
  const current = loadCategorySyncSnapshot(db, categoryId);

  if (!current || current.deletedAt) {
    return null;
  }

  if (current.isSystem) {
    throw new SyncMutationError('validation_failed', 'System categories cannot be deleted.');
  }

  const childCategoryIds = db
    .prepare(
      `
        SELECT id
        FROM categories
        WHERE parent_id = ?
          AND deleted_at IS NULL
      `,
    )
    .all(categoryId)
    .map((row) => String((row as { id: string }).id));

  const affectedBookmarkIds = db
    .prepare(
      `
        SELECT id
        FROM bookmarks
        WHERE primary_category_id = ?
          AND deleted_at IS NULL
      `,
    )
    .all(categoryId)
    .map((row) => String((row as { id: string }).id));

  const timestamp = nowIso();
  db.prepare(
    `
      UPDATE categories
      SET deleted_at = ?, updated_at = ?, version = version + 1
      WHERE id = ?
    `,
  ).run(timestamp, timestamp, categoryId);
  db.prepare(
    `
      UPDATE categories
      SET parent_id = NULL, updated_at = ?, version = version + 1
      WHERE parent_id = ?
        AND deleted_at IS NULL
    `,
  ).run(timestamp, categoryId);
  db.prepare(
    `
      UPDATE bookmarks
      SET primary_category_id = 'system-unsorted', updated_at = ?, version = version + 1
      WHERE primary_category_id = ?
        AND deleted_at IS NULL
    `,
  ).run(timestamp, categoryId);

  const primaryEvent = appendSyncEvent(db, {
    accountId,
    entityType: 'category',
    entityId: categoryId,
    operation: 'delete',
    writerKind,
    actorDeviceId,
    changedFields: ['deletedAt'],
  });

  for (const childId of childCategoryIds) {
    appendSyncEvent(db, {
      accountId,
      entityType: 'category',
      entityId: childId,
      operation: 'upsert',
      writerKind,
      actorDeviceId,
      changedFields: ['parentId'],
    });
  }

  for (const bookmarkId of affectedBookmarkIds) {
    appendSyncEvent(db, {
      accountId,
      entityType: 'bookmark',
      entityId: bookmarkId,
      operation: 'upsert',
      writerKind,
      actorDeviceId,
      changedFields: ['primaryCategoryId'],
    });
  }

  return primaryEvent;
}

export function upsertCollectionCanonical(args: {
  db: RemoteDatabase;
  accountId: string;
  snapshot: SyncCollectionSnapshot;
  writerKind: SyncWriterKind;
  actorDeviceId?: string | null;
  changedFields: string[];
}) {
  const { db, accountId, snapshot, writerKind, actorDeviceId, changedFields } = args;
  const current = loadCollectionSyncSnapshot(db, snapshot.id);
  const nextVersion = current ? current.version + 1 : 1;
  const createdAt = current?.createdAt ?? snapshot.createdAt ?? nowIso();
  const updatedAt = nowIso();
  const deletedAt = snapshot.deletedAt ?? null;

  if (!current) {
    db.prepare(
      `
        INSERT INTO collections (
          id,
          name,
          description,
          sort_order,
          version,
          created_at,
          updated_at,
          deleted_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      snapshot.id,
      snapshot.name,
      snapshot.description,
      snapshot.sortOrder,
      nextVersion,
      createdAt,
      updatedAt,
      deletedAt,
    );
  } else {
    db.prepare(
      `
        UPDATE collections
        SET
          name = ?,
          description = ?,
          sort_order = ?,
          version = ?,
          updated_at = ?,
          deleted_at = ?
        WHERE id = ?
      `,
    ).run(
      snapshot.name,
      snapshot.description,
      snapshot.sortOrder,
      nextVersion,
      updatedAt,
      deletedAt,
      snapshot.id,
    );
  }

  return appendSyncEvent(db, {
    accountId,
    entityType: 'collection',
    entityId: snapshot.id,
    operation: deletedAt ? 'delete' : 'upsert',
    writerKind,
    actorDeviceId,
    changedFields,
  });
}

export function deleteCollectionCanonical(args: {
  db: RemoteDatabase;
  accountId: string;
  collectionId: string;
  writerKind: SyncWriterKind;
  actorDeviceId?: string | null;
}) {
  const { db, accountId, collectionId, writerKind, actorDeviceId } = args;
  const current = loadCollectionSyncSnapshot(db, collectionId);

  if (!current || current.deletedAt) {
    return null;
  }

  const affectedBookmarkIds = db
    .prepare(
      `
        SELECT bookmark_id
        FROM collection_bookmarks
        WHERE collection_id = ?
      `,
    )
    .all(collectionId)
    .map((row) => String((row as { bookmark_id: string }).bookmark_id));

  const timestamp = nowIso();
  db.prepare(
    `
      UPDATE collections
      SET deleted_at = ?, updated_at = ?, version = version + 1
      WHERE id = ?
    `,
  ).run(timestamp, timestamp, collectionId);
  db.prepare('DELETE FROM collection_bookmarks WHERE collection_id = ?').run(collectionId);

  if (affectedBookmarkIds.length > 0) {
    const placeholders = affectedBookmarkIds.map(() => '?').join(', ');
    db.prepare(
      `
        UPDATE bookmarks
        SET updated_at = ?, version = version + 1
        WHERE id IN (${placeholders})
          AND deleted_at IS NULL
      `,
    ).run(timestamp, ...affectedBookmarkIds);
  }

  const primaryEvent = appendSyncEvent(db, {
    accountId,
    entityType: 'collection',
    entityId: collectionId,
    operation: 'delete',
    writerKind,
    actorDeviceId,
    changedFields: ['deletedAt'],
  });

  for (const bookmarkId of affectedBookmarkIds) {
    appendSyncEvent(db, {
      accountId,
      entityType: 'bookmark',
      entityId: bookmarkId,
      operation: 'upsert',
      writerKind,
      actorDeviceId,
      changedFields: ['collectionIds'],
    });
  }

  return primaryEvent;
}
