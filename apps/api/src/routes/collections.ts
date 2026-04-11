import type { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import { z } from 'zod';

const collectionBodySchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().min(1).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

function loadCollections(app: FastifyInstance) {
  return app.db
    .prepare(
      `
        SELECT
          collections.id,
          collections.name,
          collections.description,
          collections.sort_order,
          collections.created_at,
          collections.updated_at,
          COALESCE(COUNT(collection_bookmarks.bookmark_id), 0) AS bookmark_count
        FROM collections
        LEFT JOIN collection_bookmarks ON collection_bookmarks.collection_id = collections.id
        GROUP BY collections.id
        ORDER BY collections.sort_order ASC, collections.created_at ASC
      `,
    )
    .all();
}

export async function registerCollectionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/collections', { preHandler: app.requireSession }, async () => loadCollections(app));

  app.post('/api/collections', { preHandler: app.requireSession }, async (request) => {
    const input = collectionBodySchema.parse(request.body);
    const now = new Date().toISOString();
    const collectionId = ulid();
    app.db
      .prepare(
        `
          INSERT INTO collections (id, name, description, sort_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `,
      )
      .run(collectionId, input.name, input.description ?? null, input.sortOrder ?? 0, now, now);

    return app.db.prepare('SELECT id, name, description, sort_order, created_at, updated_at FROM collections WHERE id = ?').get(collectionId);
  });

  app.patch('/api/collections/:collectionId', { preHandler: app.requireSession }, async (request) => {
    const params = z.object({ collectionId: z.string().min(1) }).parse(request.params);
    const input = collectionBodySchema.parse(request.body);

    app.db
      .prepare(
        `
          UPDATE collections
          SET name = ?, description = ?, sort_order = ?, updated_at = ?
          WHERE id = ?
        `,
      )
      .run(input.name, input.description ?? null, input.sortOrder ?? 0, new Date().toISOString(), params.collectionId);

    return app.db.prepare('SELECT id, name, description, sort_order, created_at, updated_at FROM collections WHERE id = ?').get(params.collectionId);
  });

  app.delete('/api/collections/:collectionId', { preHandler: app.requireSession }, async (request, reply) => {
    const params = z.object({ collectionId: z.string().min(1) }).parse(request.params);
    const deleted = app.db.prepare('DELETE FROM collections WHERE id = ?').run(params.collectionId);

    if (deleted.changes === 0) {
      reply.code(404).send({ code: 'collection_not_found' });
      return;
    }

    return {
      deleted: true,
      collection_id: params.collectionId,
    };
  });
}
