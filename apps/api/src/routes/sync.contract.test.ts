import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createDatabase } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';

async function createTestApp() {
  const db = createDatabase(':memory:');
  runMigrations(db);
  const app = await buildApp(db);

  const setupResponse = await app.inject({
    method: 'POST',
    url: '/api/setup',
    payload: {
      account: 'owner',
      password: 'supersecret123',
    },
  });

  expect(setupResponse.statusCode).toBe(200);

  const syncSessionResponse = await app.inject({
    method: 'POST',
    url: '/api/sync/session',
    payload: {
      account: 'owner',
      password: 'supersecret123',
    },
  });

  expect(syncSessionResponse.statusCode).toBe(200);
  const syncSession = syncSessionResponse.json() as { session_token: string };

  const deviceResponse = await app.inject({
    method: 'POST',
    url: '/api/sync/devices/register',
    headers: {
      authorization: `Bearer ${syncSession.session_token}`,
    },
    payload: {
      deviceName: 'My Windows PC',
    },
  });

  expect(deviceResponse.statusCode).toBe(200);
  const registered = deviceResponse.json() as { device_token: string };

  return {
    app,
    deviceToken: registered.device_token,
    sessionToken: syncSession.session_token,
  };
}

function createBookmarkChange(changeId: string) {
  return {
    changeId,
    entityType: 'bookmark',
    entityId: `bookmark-${changeId}`,
    operation: 'upsert',
    baseVersion: null,
    writerKind: 'user',
    changedFields: ['url', 'title', 'description', 'primaryCategoryId', 'tags', 'collectionIds'],
    createdAt: '2026-04-11T00:00:00.000Z',
    snapshot: {
      entityType: 'bookmark',
      id: `bookmark-${changeId}`,
      url: `https://example.com/${changeId}`,
      normalizedUrl: `https://example.com/${changeId}`,
      title: `Bookmark ${changeId}`,
      description: 'Saved from sync push',
      descriptionExcerpt: null,
      favicon: null,
      coverUrl: null,
      primaryCategoryId: 'system-unsorted',
      isStarred: false,
      processingStatus: 'ready',
      processingError: null,
      userEditedMask: ['title', 'description'],
      tags: [{ id: `tag-${changeId}`, label: `tag-${changeId}`, color: null }],
      collectionIds: [],
      createdAt: '2026-04-11T00:00:00.000Z',
      updatedAt: '2026-04-11T00:00:00.000Z',
      deletedAt: null,
      version: 0,
    },
  } as const;
}

describe('sync route contracts', () => {
  const apps: Array<Awaited<ReturnType<typeof createTestApp>>['app']> = [];

  afterEach(async () => {
    while (apps.length > 0) {
      await apps.pop()!.close();
    }
  });

  it('registers a device and returns push results with canonical snapshots', async () => {
    const { app, deviceToken } = await createTestApp();
    apps.push(app);

    const pushResponse = await app.inject({
      method: 'POST',
      url: '/api/sync/push',
      headers: {
        authorization: `Bearer ${deviceToken}`,
      },
      payload: {
        changes: [createBookmarkChange('001')],
      },
    });

    expect(pushResponse.statusCode).toBe(200);
    const body = pushResponse.json() as {
      serverCursor: number;
      results: Array<{
        status: string;
        reasonCode: string | null;
        appliedEntityVersion: number | null;
        serverSeq: number | null;
        serverSnapshot: { entityType: string; id: string; title: string } | null;
      }>;
    };

    expect(body.serverCursor).toBeGreaterThan(0);
    expect(body.results).toHaveLength(1);
    expect(body.results[0]).toMatchObject({
      status: 'accepted',
      reasonCode: null,
      appliedEntityVersion: 1,
      serverSnapshot: {
        entityType: 'bookmark',
        id: 'bookmark-001',
        title: 'Bookmark 001',
      },
    });
    expect(body.results[0]?.serverSeq).toBe(body.serverCursor);
  });

  it('returns canonical pull events in ascending seq order', async () => {
    const { app, deviceToken } = await createTestApp();
    apps.push(app);

    await app.inject({
      method: 'POST',
      url: '/api/sync/push',
      headers: {
        authorization: `Bearer ${deviceToken}`,
      },
      payload: {
        changes: [createBookmarkChange('010'), createBookmarkChange('011')],
      },
    });

    const pullResponse = await app.inject({
      method: 'GET',
      url: '/api/sync/pull?cursor=0&limit=10',
      headers: {
        authorization: `Bearer ${deviceToken}`,
      },
    });

    expect(pullResponse.statusCode).toBe(200);
    const body = pullResponse.json() as {
      serverCursor: number;
      resyncRequired: boolean;
      events: Array<{ seq: number; entityId: string; snapshot: { entityType: string } }>;
    };

    expect(body.resyncRequired).toBe(false);
    expect(body.events).toHaveLength(2);
    expect(body.events[0]?.seq).toBeLessThan(body.events[1]!.seq);
    expect(body.events.map((event) => event.entityId)).toEqual(['bookmark-010', 'bookmark-011']);
    expect(body.events.every((event) => event.snapshot.entityType === 'bookmark')).toBe(true);
    expect(body.serverCursor).toBe(body.events[1]?.seq);
  });

  it('returns resyncRequired when the client cursor is ahead of the server', async () => {
    const { app, deviceToken } = await createTestApp();
    apps.push(app);

    const response = await app.inject({
      method: 'GET',
      url: '/api/sync/pull?cursor=99&limit=10',
      headers: {
        authorization: `Bearer ${deviceToken}`,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      serverCursor: 0,
      resyncRequired: true,
      events: [],
    });
  });
});
