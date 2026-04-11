import type { FastifyInstance } from 'fastify';
import { ulid } from 'ulid';
import { z } from 'zod';

const categoryBodySchema = z.object({
  name: z.string().trim().min(1),
  slug: z.string().trim().min(1).nullable().optional(),
  parentId: z.string().trim().min(1).nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

interface CategoryRow {
  id: string;
  name: string;
  slug: string | null;
  parent_id: string | null;
  sort_order: number;
  is_system: number;
  created_at: string;
  updated_at: string;
  bookmark_count: number;
}

interface CategoryTreeNodeDto {
  id: string;
  name: string;
  slug: string | null;
  parent_id: string | null;
  sort_order: number;
  is_system: boolean;
  bookmark_count: number;
  created_at: string;
  updated_at: string;
  children: CategoryTreeNodeDto[];
}

function loadCategoryTree(app: FastifyInstance) {
  const rows = app.db
    .prepare(
      `
        SELECT
          categories.id,
          categories.name,
          categories.slug,
          categories.parent_id,
          categories.sort_order,
          categories.is_system,
          categories.created_at,
          categories.updated_at,
          COALESCE(COUNT(bookmarks.id), 0) AS bookmark_count
        FROM categories
        LEFT JOIN bookmarks
          ON bookmarks.primary_category_id = categories.id
         AND bookmarks.deleted_at IS NULL
        GROUP BY categories.id
        ORDER BY categories.sort_order ASC, categories.created_at ASC
      `,
    )
    .all() as CategoryRow[];

  const nodeMap = new Map<string, CategoryTreeNodeDto>(
    rows.map((row) => [
      row.id,
      {
        id: row.id,
        name: row.name,
        slug: row.slug,
        parent_id: row.parent_id,
        sort_order: row.sort_order,
        is_system: Boolean(row.is_system),
        bookmark_count: row.bookmark_count,
        created_at: row.created_at,
        updated_at: row.updated_at,
        children: [],
      },
    ]),
  );

  const roots: CategoryTreeNodeDto[] = [];

  for (const row of rows) {
    const node = nodeMap.get(row.id)!;
    if (row.parent_id && nodeMap.has(row.parent_id)) {
      nodeMap.get(row.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function registerCategoryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/categories', { preHandler: app.requireSession }, async () => loadCategoryTree(app));

  app.post('/api/categories', { preHandler: app.requireSession }, async (request) => {
    const input = categoryBodySchema.parse(request.body);
    const now = new Date().toISOString();
    const id = ulid();

    app.db
      .prepare(
        `
          INSERT INTO categories (id, name, slug, parent_id, sort_order, is_system, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, 0, ?, ?)
        `,
      )
      .run(id, input.name, input.slug ?? null, input.parentId ?? null, input.sortOrder ?? 0, now, now);

    return app.db.prepare('SELECT id, name, slug, parent_id, sort_order, is_system, created_at, updated_at FROM categories WHERE id = ?').get(id);
  });

  app.patch('/api/categories/:categoryId', { preHandler: app.requireSession }, async (request) => {
    const params = z.object({ categoryId: z.string().min(1) }).parse(request.params);
    const input = categoryBodySchema.parse(request.body);

    app.db
      .prepare(
        `
          UPDATE categories
          SET name = ?, slug = ?, parent_id = ?, sort_order = ?, updated_at = ?
          WHERE id = ?
        `,
      )
      .run(input.name, input.slug ?? null, input.parentId ?? null, input.sortOrder ?? 0, new Date().toISOString(), params.categoryId);

    return app.db.prepare('SELECT id, name, slug, parent_id, sort_order, is_system, created_at, updated_at FROM categories WHERE id = ?').get(params.categoryId);
  });

  app.delete('/api/categories/:categoryId', { preHandler: app.requireSession }, async (request, reply) => {
    const params = z.object({ categoryId: z.string().min(1) }).parse(request.params);
    const row = app.db
      .prepare('SELECT is_system FROM categories WHERE id = ?')
      .get(params.categoryId) as { is_system: number } | undefined;

    if (!row) {
      reply.code(404).send({ code: 'category_not_found' });
      return;
    }

    if (row.is_system) {
      reply.code(400).send({ code: 'system_category_locked' });
      return;
    }

    app.db.transaction(() => {
      app.db.prepare(`UPDATE bookmarks SET primary_category_id = 'system-unsorted', updated_at = ?, version = version + 1 WHERE primary_category_id = ?`).run(new Date().toISOString(), params.categoryId);
      app.db.prepare('DELETE FROM categories WHERE id = ?').run(params.categoryId);
    })();

    return {
      deleted: true,
      category_id: params.categoryId,
    };
  });
}
