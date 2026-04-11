import type { RemoteDatabase } from '../db/client.js';
import type {
  SyncBookmarkSnapshot,
  SyncCategorySnapshot,
  SyncCollectionSnapshot,
  SyncEntitySnapshot,
  SyncEntityType,
  SyncOperation,
  SyncWriterKind,
} from '../syncContract.js';

interface BookmarkRow {
  id: string;
  url: string;
  normalized_url: string;
  title: string;
  description: string | null;
  description_excerpt: string | null;
  favicon: string | null;
  cover_url: string | null;
  primary_category_id: string | null;
  is_starred: number;
  processing_status: SyncBookmarkSnapshot['processingStatus'];
  processing_error: string | null;
  user_edited_mask: string;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface CategoryRow {
  id: string;
  name: string;
  slug: string | null;
  parent_id: string | null;
  sort_order: number;
  is_system: number;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface CollectionRow {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface AppendSyncEventInput {
  accountId: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  writerKind: SyncWriterKind;
  actorDeviceId?: string | null;
  changedFields: string[];
}

function loadBookmarkTags(db: RemoteDatabase, bookmarkId: string): SyncBookmarkSnapshot['tags'] {
  return db
    .prepare(
      `
        SELECT tags.id, tags.label, tags.color
        FROM bookmark_tags
        INNER JOIN tags ON tags.id = bookmark_tags.tag_id
        WHERE bookmark_tags.bookmark_id = ?
        ORDER BY tags.label COLLATE NOCASE ASC
      `,
    )
    .all(bookmarkId)
    .map((row) => {
      const record = row as { id: string; label: string; color: string | null };
      return {
        id: record.id,
        label: record.label,
        color: record.color,
      };
    });
}

function loadBookmarkCollectionIds(db: RemoteDatabase, bookmarkId: string): string[] {
  return db
    .prepare(
      `
        SELECT collection_id
        FROM collection_bookmarks
        WHERE bookmark_id = ?
        ORDER BY collection_id ASC
      `,
    )
    .all(bookmarkId)
    .map((row) => String((row as { collection_id: string }).collection_id));
}

export function loadBookmarkSyncSnapshot(db: RemoteDatabase, bookmarkId: string): SyncBookmarkSnapshot | null {
  const row = db
    .prepare(
      `
        SELECT *
        FROM bookmarks
        WHERE id = ?
      `,
    )
    .get(bookmarkId) as BookmarkRow | undefined;

  if (!row) {
    return null;
  }

  return {
    entityType: 'bookmark',
    id: row.id,
    url: row.url,
    normalizedUrl: row.normalized_url,
    title: row.title,
    description: row.description,
    descriptionExcerpt: row.description_excerpt,
    favicon: row.favicon,
    coverUrl: row.cover_url,
    primaryCategoryId: row.primary_category_id,
    isStarred: Boolean(row.is_starred),
    processingStatus: row.processing_status,
    processingError: row.processing_error,
    userEditedMask: JSON.parse(row.user_edited_mask || '[]') as string[],
    tags: loadBookmarkTags(db, row.id),
    collectionIds: loadBookmarkCollectionIds(db, row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    version: row.version,
  };
}

export function loadCategorySyncSnapshot(db: RemoteDatabase, categoryId: string): SyncCategorySnapshot | null {
  const row = db
    .prepare(
      `
        SELECT id, name, slug, parent_id, sort_order, is_system, version, created_at, updated_at, deleted_at
        FROM categories
        WHERE id = ?
      `,
    )
    .get(categoryId) as CategoryRow | undefined;

  if (!row) {
    return null;
  }

  return {
    entityType: 'category',
    id: row.id,
    name: row.name,
    slug: row.slug,
    parentId: row.parent_id,
    sortOrder: row.sort_order,
    isSystem: Boolean(row.is_system),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    version: row.version,
  };
}

export function loadCollectionSyncSnapshot(db: RemoteDatabase, collectionId: string): SyncCollectionSnapshot | null {
  const row = db
    .prepare(
      `
        SELECT id, name, description, sort_order, version, created_at, updated_at, deleted_at
        FROM collections
        WHERE id = ?
      `,
    )
    .get(collectionId) as CollectionRow | undefined;

  if (!row) {
    return null;
  }

  return {
    entityType: 'collection',
    id: row.id,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    version: row.version,
  };
}

export function loadSyncEntitySnapshot(
  db: RemoteDatabase,
  entityType: SyncEntityType,
  entityId: string,
): SyncEntitySnapshot | null {
  switch (entityType) {
    case 'bookmark':
      return loadBookmarkSyncSnapshot(db, entityId);
    case 'category':
      return loadCategorySyncSnapshot(db, entityId);
    case 'collection':
      return loadCollectionSyncSnapshot(db, entityId);
    default:
      return null;
  }
}

export function appendSyncEvent(db: RemoteDatabase, input: AppendSyncEventInput): { seq: number; snapshot: SyncEntitySnapshot } {
  const snapshot = loadSyncEntitySnapshot(db, input.entityType, input.entityId);

  if (!snapshot) {
    throw new Error(`Cannot append sync event without snapshot for ${input.entityType}:${input.entityId}`);
  }

  const result = db
    .prepare(
      `
        INSERT INTO sync_events (
          account_id,
          entity_type,
          entity_id,
          operation,
          entity_version,
          writer_kind,
          actor_device_id,
          changed_fields_json,
          payload_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      input.accountId,
      input.entityType,
      input.entityId,
      input.operation,
      snapshot.version,
      input.writerKind,
      input.actorDeviceId ?? null,
      JSON.stringify(input.changedFields),
      JSON.stringify(snapshot),
      new Date().toISOString(),
    );

  return {
    seq: Number(result.lastInsertRowid),
    snapshot,
  };
}
