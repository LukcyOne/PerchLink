import type { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import { z } from 'zod';
import { queueRemoteMetadataExtraction, retryRemoteMetadataExtraction } from '../services/metadataQueue.js';

const bookmarkCreateSchema = z.object({
  url: z.string().trim().min(1),
  title: z.string().trim().min(1).optional(),
  description: z.string().nullable().optional(),
  primaryCategoryId: z.string().trim().min(1).nullable().optional(),
  isStarred: z.boolean().optional(),
  tags: z.array(z.object({ label: z.string().trim().min(1) })).optional(),
  collectionIds: z.array(z.string().trim().min(1)).optional(),
});

const bookmarkUpdateSchema = z.object({
  url: z.string().trim().min(1).optional(),
  title: z.string().trim().min(1).optional(),
  description: z.string().nullable().optional(),
  primaryCategoryId: z.string().trim().min(1).nullable().optional(),
  isStarred: z.boolean().optional(),
  userEditedMask: z.array(z.string().trim().min(1)).optional(),
  tags: z.array(z.object({ label: z.string().trim().min(1) })).optional(),
  collectionIds: z.array(z.string().trim().min(1)).optional(),
});

const bookmarkQuerySchema = z.object({
  search: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  collectionId: z.string().trim().optional(),
  tagIds: z.union([z.string().trim(), z.array(z.string().trim())]).optional(),
  isStarred: z.union([z.literal('true'), z.literal('false')]).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'title']).optional(),
  sortDirection: z.enum(['asc', 'desc']).optional(),
});

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
  processing_status: string;
  processing_error: string | null;
  user_edited_mask: string;
  version: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface TagRow {
  id: string;
  label: string;
  color: string | null;
  created_at: string;
  updated_at: string;
}

function normalizeBookmarkUrl(input: string): string {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return '';
  }

  try {
    const parsed = new URL(trimmed);
    const normalizedPath = parsed.pathname.replace(/\/+$/, '');
    const path = normalizedPath.length > 0 ? normalizedPath : '';
    return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${parsed.search}`;
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

function mapTagRows(rows: TagRow[]) {
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    color: row.color,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}

function getTagRows(app: FastifyInstance, bookmarkId: string): TagRow[] {
  return app.db
    .prepare(
      `
        SELECT tags.id, tags.label, tags.color, tags.created_at, tags.updated_at
        FROM bookmark_tags
        INNER JOIN tags ON tags.id = bookmark_tags.tag_id
        WHERE bookmark_tags.bookmark_id = ?
        ORDER BY tags.label ASC
      `,
    )
    .all(bookmarkId) as TagRow[];
}

function getCollectionIds(app: FastifyInstance, bookmarkId: string): string[] {
  return app.db
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

function mapBookmarkRecord(app: FastifyInstance, row: BookmarkRow) {
  return {
    id: row.id,
    url: row.url,
    normalized_url: row.normalized_url,
    title: row.title,
    description: row.description,
    description_excerpt: row.description_excerpt,
    favicon: row.favicon,
    cover_url: row.cover_url,
    primary_category_id: row.primary_category_id,
    is_starred: Boolean(row.is_starred),
    processing_status: row.processing_status,
    processing_error: row.processing_error,
    user_edited_mask: JSON.parse(row.user_edited_mask || '[]'),
    ai_suggestion: null,
    version: row.version,
    tags: mapTagRows(getTagRows(app, row.id)),
    collection_ids: getCollectionIds(app, row.id),
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

function getBookmarkRow(app: FastifyInstance, bookmarkId: string): BookmarkRow | undefined {
  return app.db
    .prepare(
      `
        SELECT *
        FROM bookmarks
        WHERE id = ? AND deleted_at IS NULL
      `,
    )
    .get(bookmarkId) as BookmarkRow | undefined;
}

function syncBookmarkTags(app: FastifyInstance, bookmarkId: string, tags: Array<{ label: string }>): void {
  const now = new Date().toISOString();
  const normalizedLabels = [...new Set(tags.map((tag) => tag.label.trim()).filter(Boolean))];

  app.db.prepare('DELETE FROM bookmark_tags WHERE bookmark_id = ?').run(bookmarkId);

  for (const label of normalizedLabels) {
    const existing = app.db.prepare('SELECT id FROM tags WHERE label = ?').get(label) as { id: string } | undefined;
    const tagId = existing?.id ?? ulid();

    if (!existing) {
      app.db
        .prepare(
          `
            INSERT INTO tags (id, label, color, created_at, updated_at)
            VALUES (?, ?, NULL, ?, ?)
          `,
        )
        .run(tagId, label, now, now);
    }

    app.db
      .prepare(
        `
          INSERT INTO bookmark_tags (bookmark_id, tag_id, created_at)
          VALUES (?, ?, ?)
        `,
      )
      .run(bookmarkId, tagId, now);
  }
}

function syncBookmarkCollections(app: FastifyInstance, bookmarkId: string, collectionIds: string[]): void {
  const now = new Date().toISOString();
  const uniqueIds = [...new Set(collectionIds)];

  app.db.prepare('DELETE FROM collection_bookmarks WHERE bookmark_id = ?').run(bookmarkId);

  for (const collectionId of uniqueIds) {
    app.db
      .prepare(
        `
          INSERT INTO collection_bookmarks (collection_id, bookmark_id, created_at)
          VALUES (?, ?, ?)
        `,
      )
      .run(collectionId, bookmarkId, now);
  }
}

function listBookmarks(app: FastifyInstance, input: z.infer<typeof bookmarkQuerySchema>) {
  const where: string[] = ['deleted_at IS NULL'];
  const params: unknown[] = [];

  if (input.search) {
    where.push('(title LIKE ? OR url LIKE ? OR COALESCE(description, \'\') LIKE ? OR COALESCE(description_excerpt, \'\') LIKE ?)');
    const value = `%${input.search}%`;
    params.push(value, value, value, value);
  }

  if (input.categoryId) {
    where.push('primary_category_id = ?');
    params.push(input.categoryId);
  }

  if (input.collectionId) {
    where.push('EXISTS (SELECT 1 FROM collection_bookmarks WHERE collection_bookmarks.bookmark_id = bookmarks.id AND collection_bookmarks.collection_id = ?)');
    params.push(input.collectionId);
  }

  const tagIds = Array.isArray(input.tagIds)
    ? input.tagIds
    : input.tagIds
      ? input.tagIds.split(',').map((item) => item.trim()).filter(Boolean)
      : [];

  if (tagIds.length > 0) {
    where.push(`EXISTS (SELECT 1 FROM bookmark_tags WHERE bookmark_tags.bookmark_id = bookmarks.id AND bookmark_tags.tag_id IN (${tagIds.map(() => '?').join(', ')}))`);
    params.push(...tagIds);
  }

  if (input.isStarred === 'true') {
    where.push('is_starred = 1');
  }

  if (input.isStarred === 'false') {
    where.push('is_starred = 0');
  }

  const sortMap: Record<string, string> = {
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    title: 'title',
  };

  const sortColumn = sortMap[input.sortBy ?? 'updatedAt'];
  const sortDirection = input.sortDirection === 'asc' ? 'ASC' : 'DESC';
  const sql = `
    SELECT *
    FROM bookmarks
    WHERE ${where.join(' AND ')}
    ORDER BY ${sortColumn} ${sortDirection}
  `;

  const rows = app.db.prepare(sql).all(...params) as BookmarkRow[];
  return rows.map((row) => mapBookmarkRecord(app, row));
}

export async function registerBookmarkRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/bookmarks', { preHandler: app.requireSession }, async (request) => {
    const query = bookmarkQuerySchema.parse(request.query ?? {});
    return listBookmarks(app, query);
  });

  app.get('/api/bookmarks/:bookmarkId', { preHandler: app.requireSession }, async (request, reply) => {
    const params = z.object({ bookmarkId: z.string().min(1) }).parse(request.params);
    const row = getBookmarkRow(app, params.bookmarkId);

    if (!row) {
      reply.code(404).send({ code: 'bookmark_not_found' });
      return;
    }

    return mapBookmarkRecord(app, row);
  });

  app.post('/api/bookmarks', { preHandler: app.requireSession }, async (request) => {
    const input = bookmarkCreateSchema.parse(request.body);
    const id = ulid();
    const now = new Date().toISOString();
    const normalizedUrl = normalizeBookmarkUrl(input.url);
    const initialTitle = input.title?.trim() || input.url.trim();

    app.db.transaction(() => {
      app.db
        .prepare(
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
            ) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, 'processing', NULL, '[]', 1, ?, ?, NULL)
          `,
        )
        .run(
          id,
          input.url.trim(),
          normalizedUrl,
          initialTitle,
          input.description ?? null,
          input.primaryCategoryId ?? 'system-unsorted',
          input.isStarred ? 1 : 0,
          now,
          now,
        );

      if (input.tags) {
        syncBookmarkTags(app, id, input.tags);
      }

      if (input.collectionIds) {
        syncBookmarkCollections(app, id, input.collectionIds);
      }
    })();

    await queueRemoteMetadataExtraction(id, app.db);
    return mapBookmarkRecord(app, getBookmarkRow(app, id)!);
  });

  app.patch('/api/bookmarks/:bookmarkId', { preHandler: app.requireSession }, async (request, reply) => {
    const params = z.object({ bookmarkId: z.string().min(1) }).parse(request.params);
    const input = bookmarkUpdateSchema.parse(request.body);
    const current = getBookmarkRow(app, params.bookmarkId);

    if (!current) {
      reply.code(404).send({ code: 'bookmark_not_found' });
      return;
    }

    const nextUrl = input.url?.trim() ?? current.url;
    const updates: string[] = [];
    const values: unknown[] = [];

    if (input.url !== undefined) {
      updates.push('url = ?', 'normalized_url = ?');
      values.push(nextUrl, normalizeBookmarkUrl(nextUrl));
    }

    if (input.title !== undefined) {
      updates.push('title = ?');
      values.push(input.title.trim());
    }

    if (input.description !== undefined) {
      updates.push('description = ?');
      values.push(input.description);
    }

    if (input.primaryCategoryId !== undefined) {
      updates.push('primary_category_id = ?');
      values.push(input.primaryCategoryId ?? 'system-unsorted');
    }

    if (input.isStarred !== undefined) {
      updates.push('is_starred = ?');
      values.push(input.isStarred ? 1 : 0);
    }

    if (input.userEditedMask !== undefined) {
      updates.push('user_edited_mask = ?');
      values.push(JSON.stringify(input.userEditedMask));
    }

    if (updates.length > 0) {
      updates.push('updated_at = ?', 'version = version + 1');
      values.push(new Date().toISOString(), params.bookmarkId);
      app.db.prepare(`UPDATE bookmarks SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    if (input.tags) {
      syncBookmarkTags(app, params.bookmarkId, input.tags);
    }

    if (input.collectionIds) {
      syncBookmarkCollections(app, params.bookmarkId, input.collectionIds);
    }

    return mapBookmarkRecord(app, getBookmarkRow(app, params.bookmarkId)!);
  });

  app.delete('/api/bookmarks/:bookmarkId', { preHandler: app.requireSession }, async (request, reply) => {
    const params = z.object({ bookmarkId: z.string().min(1) }).parse(request.params);
    const result = app.db
      .prepare(
        `
          UPDATE bookmarks
          SET deleted_at = ?, updated_at = ?, version = version + 1
          WHERE id = ? AND deleted_at IS NULL
        `,
      )
      .run(new Date().toISOString(), new Date().toISOString(), params.bookmarkId);

    if (result.changes === 0) {
      reply.code(404).send({ code: 'bookmark_not_found' });
      return;
    }

    return {
      deleted: true,
      bookmark_id: params.bookmarkId,
    };
  });

  app.post('/api/bookmarks/:bookmarkId/retry-metadata', { preHandler: app.requireSession }, async (request, reply) => {
    const params = z.object({ bookmarkId: z.string().min(1) }).parse(request.params);
    const row = getBookmarkRow(app, params.bookmarkId);

    if (!row) {
      reply.code(404).send({ code: 'bookmark_not_found' });
      return;
    }

    await retryRemoteMetadataExtraction(params.bookmarkId, app.db);
    return mapBookmarkRecord(app, getBookmarkRow(app, params.bookmarkId)!);
  });
}
