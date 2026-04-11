import type { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import { z } from 'zod';
import { loadCollectionSyncSnapshot } from '../services/syncEvents.js';
import { SyncMutationError, deleteCollectionCanonical, upsertCollectionCanonical } from '../services/syncMutations.js';
import type { SyncCollectionSnapshot } from '../syncContract.js';

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
        WHERE collections.deleted_at IS NULL
        GROUP BY collections.id
        ORDER BY collections.sort_order ASC, collections.created_at ASC
      `,
    )
    .all();
}

export async function registerCollectionRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/collections', { preHandler: app.requireSession }, async () => loadCollections(app));

  app.post('/api/collections', { preHandler: app.requireSession }, async (request, reply) => {
    const input = collectionBodySchema.parse(request.body);
    const now = new Date().toISOString();
    const collectionId = ulid();
    const snapshot: SyncCollectionSnapshot = {
      entityType: 'collection',
      id: collectionId,
      name: input.name,
      description: input.description ?? null,
      sortOrder: input.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      version: 0,
    };

    try {
      app.db.transaction(() => {
        upsertCollectionCanonical({
          db: app.db,
          accountId: request.currentAccount!.id,
          snapshot,
          writerKind: 'user',
          actorDeviceId: null,
          changedFields: ['name', 'description', 'sortOrder'],
        });
      })();
    } catch (error) {
      if (error instanceof SyncMutationError) {
        reply.code(400).send({ code: error.reasonCode, message: error.message });
        return;
      }

      throw error;
    }

    return app.db.prepare('SELECT id, name, description, sort_order, created_at, updated_at FROM collections WHERE id = ?').get(collectionId);
  });

  app.patch('/api/collections/:collectionId', { preHandler: app.requireSession }, async (request, reply) => {
    const params = z.object({ collectionId: z.string().min(1) }).parse(request.params);
    const input = collectionBodySchema.parse(request.body);
    const current = loadCollectionSyncSnapshot(app.db, params.collectionId);

    if (!current || current.deletedAt) {
      reply.code(404).send({ code: 'collection_not_found' });
      return;
    }

    try {
      app.db.transaction(() => {
        upsertCollectionCanonical({
          db: app.db,
          accountId: request.currentAccount!.id,
          snapshot: {
            ...current,
            name: input.name,
            description: input.description ?? null,
            sortOrder: input.sortOrder ?? 0,
          },
          writerKind: 'user',
          actorDeviceId: null,
          changedFields: ['name', 'description', 'sortOrder'],
        });
      })();
    } catch (error) {
      if (error instanceof SyncMutationError) {
        reply.code(400).send({ code: error.reasonCode, message: error.message });
        return;
      }

      throw error;
    }

    return app.db.prepare('SELECT id, name, description, sort_order, created_at, updated_at FROM collections WHERE id = ?').get(params.collectionId);
  });

  app.delete('/api/collections/:collectionId', { preHandler: app.requireSession }, async (request, reply) => {
    const params = z.object({ collectionId: z.string().min(1) }).parse(request.params);
    const deleted = app.db.prepare('SELECT id FROM collections WHERE id = ? AND deleted_at IS NULL').get(params.collectionId) as { id: string } | undefined;

    if (!deleted) {
      reply.code(404).send({ code: 'collection_not_found' });
      return;
    }

    app.db.transaction(() => {
      deleteCollectionCanonical({
        db: app.db,
        accountId: request.currentAccount!.id,
        collectionId: params.collectionId,
        writerKind: 'user',
        actorDeviceId: null,
      });
    })();

    return {
      deleted: true,
      collection_id: params.collectionId,
    };
  });
}
