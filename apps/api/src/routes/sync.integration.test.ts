import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from '../app.js';
import { createDatabase } from '../db/client.js';
import { runMigrations } from '../db/migrate.js';

const ACCOUNT_NAME = 'owner';
const ACCOUNT_PASSWORD = 'supersecret123';

async function createTestApp() {
  const db = createDatabase(':memory:');
  runMigrations(db);
  const app = await buildApp(db);

  const setupResponse = await app.inject({
    method: 'POST',
    url: '/api/setup',
    payload: {
      account: ACCOUNT_NAME,
      password: ACCOUNT_PASSWORD,
    },
  });

  expect(setupResponse.statusCode).toBe(200);

  const syncSessionResponse = await app.inject({
    method: 'POST',
    url: '/api/sync/session',
    payload: {
      account: ACCOUNT_NAME,
      password: ACCOUNT_PASSWORD,
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
  const registered = deviceResponse.json() as { device_token: string; device: { id: string } };

  return {
    app,
    deviceToken: registered.device_token,
    deviceId: registered.device.id,
  };
}

async function createBrowserCookie(app: Awaited<ReturnType<typeof createTestApp>>['app']) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-in',
    payload: {
      account: ACCOUNT_NAME,
      password: ACCOUNT_PASSWORD,
    },
  });

  expect(response.statusCode).toBe(200);
  const header = response.headers['set-cookie'];
  const rawCookie = Array.isArray(header) ? header[0] : header;
  expect(rawCookie).toBeTruthy();
  return rawCookie!.split(';')[0]!;
}

function createBookmarkChange(args: {
  changeId: string;
  entityId?: string;
  url?: string;
  title?: string;
  description?: string | null;
  baseVersion?: number | null;
  changedFields?: string[];
}) {
  const entityId = args.entityId ?? `bookmark-${args.changeId}`;
  const url = args.url ?? `https://example.com/${args.changeId}`;
  return {
    changeId: args.changeId,
    entityType: 'bookmark',
    entityId,
    operation: 'upsert',
    baseVersion: args.baseVersion ?? null,
    writerKind: 'user',
    changedFields: args.changedFields ?? ['url', 'title', 'description', 'primaryCategoryId', 'tags', 'collectionIds'],
    createdAt: '2026-04-11T00:00:00.000Z',
    snapshot: {
      entityType: 'bookmark',
      id: entityId,
      url,
      normalizedUrl: url,
      title: args.title ?? `Bookmark ${args.changeId}`,
      description: args.description ?? 'Saved from sync push',
      descriptionExcerpt: null,
      favicon: null,
      coverUrl: null,
      primaryCategoryId: 'system-unsorted',
      isStarred: false,
      processingStatus: 'ready',
      processingError: null,
      userEditedMask: ['title', 'description'],
      tags: [],
      collectionIds: [],
      createdAt: '2026-04-11T00:00:00.000Z',
      updatedAt: '2026-04-11T00:00:00.000Z',
      deletedAt: null,
      version: args.baseVersion ?? 0,
    },
  } as const;
}

describe('sync route integration', () => {
  const apps: Array<Awaited<ReturnType<typeof createTestApp>>['app']> = [];

  afterEach(async () => {
    while (apps.length > 0) {
      await apps.pop()!.close();
    }
  });

  it('accepts a desktop push and returns it on later pull as canonical state', async () => {
    const { app, deviceToken } = await createTestApp();
    apps.push(app);

    const pushResponse = await app.inject({
      method: 'POST',
      url: '/api/sync/push',
      headers: {
        authorization: `Bearer ${deviceToken}`,
      },
      payload: {
        changes: [createBookmarkChange({ changeId: '001' })],
      },
    });

    expect(pushResponse.statusCode).toBe(200);
    const pushBody = pushResponse.json() as {
      results: Array<{ status: string; reasonCode: string | null; serverSnapshot: { id: string; title: string } | null }>;
    };
    expect(pushBody.results[0]).toMatchObject({
      status: 'accepted',
      reasonCode: null,
      serverSnapshot: {
        id: 'bookmark-001',
        title: 'Bookmark 001',
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
    const pullBody = pullResponse.json() as {
      events: Array<{ entityId: string; snapshot: { title: string } }>;
    };
    expect(pullBody.events).toHaveLength(1);
    expect(pullBody.events[0]).toMatchObject({
      entityId: 'bookmark-001',
      snapshot: {
        title: 'Bookmark 001',
      },
    });
  });

  it('returns accepted_merged when remote and desktop changed different fields', async () => {
    const { app, deviceToken } = await createTestApp();
    apps.push(app);
    const browserCookie = await createBrowserCookie(app);

    await app.inject({
      method: 'POST',
      url: '/api/sync/push',
      headers: {
        authorization: `Bearer ${deviceToken}`,
      },
      payload: {
        changes: [createBookmarkChange({ changeId: 'merge', entityId: 'bookmark-merge', title: 'Original title' })],
      },
    });

    const webPatchResponse = await app.inject({
      method: 'PATCH',
      url: '/api/bookmarks/bookmark-merge',
      headers: {
        cookie: browserCookie,
      },
      payload: {
        title: 'Remote title',
      },
    });

    expect(webPatchResponse.statusCode).toBe(200);

    const mergedPushResponse = await app.inject({
      method: 'POST',
      url: '/api/sync/push',
      headers: {
        authorization: `Bearer ${deviceToken}`,
      },
      payload: {
        changes: [
          createBookmarkChange({
            changeId: 'merge-2',
            entityId: 'bookmark-merge',
            baseVersion: 1,
            title: 'Original title',
            description: 'Merged local description',
            changedFields: ['description'],
          }),
        ],
      },
    });

    expect(mergedPushResponse.statusCode).toBe(200);
    const mergedBody = mergedPushResponse.json() as {
      results: Array<{
        status: string;
        reasonCode: string | null;
        serverSnapshot: { title: string; description: string | null; version: number } | null;
      }>;
    };
    expect(mergedBody.results[0]).toMatchObject({
      status: 'accepted_merged',
      reasonCode: null,
      serverSnapshot: {
        title: 'Remote title',
        description: 'Merged local description',
        version: 3,
      },
    });
  });

  it('returns a conflict with the server snapshot when desktop changes overlap with remote changes', async () => {
    const { app, deviceToken } = await createTestApp();
    apps.push(app);
    const browserCookie = await createBrowserCookie(app);

    await app.inject({
      method: 'POST',
      url: '/api/sync/push',
      headers: {
        authorization: `Bearer ${deviceToken}`,
      },
      payload: {
        changes: [createBookmarkChange({ changeId: 'conflict', entityId: 'bookmark-conflict', title: 'Original title' })],
      },
    });

    await app.inject({
      method: 'PATCH',
      url: '/api/bookmarks/bookmark-conflict',
      headers: {
        cookie: browserCookie,
      },
      payload: {
        title: 'Remote title',
      },
    });

    const conflictResponse = await app.inject({
      method: 'POST',
      url: '/api/sync/push',
      headers: {
        authorization: `Bearer ${deviceToken}`,
      },
      payload: {
        changes: [
          createBookmarkChange({
            changeId: 'conflict-2',
            entityId: 'bookmark-conflict',
            baseVersion: 1,
            title: 'Local title',
            changedFields: ['title'],
          }),
        ],
      },
    });

    expect(conflictResponse.statusCode).toBe(200);
    const conflictBody = conflictResponse.json() as {
      results: Array<{
        status: string;
        reasonCode: string | null;
        serverSnapshot: { title: string; version: number } | null;
      }>;
    };
    expect(conflictBody.results[0]).toMatchObject({
      status: 'conflict',
      reasonCode: 'base_version_conflict',
      serverSnapshot: {
        title: 'Remote title',
        version: 2,
      },
    });
  });

  it('returns duplicate_natural_key when a second bookmark tries to reuse the same URL', async () => {
    const { app, deviceToken } = await createTestApp();
    apps.push(app);

    await app.inject({
      method: 'POST',
      url: '/api/sync/push',
      headers: {
        authorization: `Bearer ${deviceToken}`,
      },
      payload: {
        changes: [createBookmarkChange({ changeId: 'dup-1', entityId: 'bookmark-dup-1', url: 'https://same.example/item' })],
      },
    });

    const duplicateResponse = await app.inject({
      method: 'POST',
      url: '/api/sync/push',
      headers: {
        authorization: `Bearer ${deviceToken}`,
      },
      payload: {
        changes: [createBookmarkChange({ changeId: 'dup-2', entityId: 'bookmark-dup-2', url: 'https://same.example/item' })],
      },
    });

    expect(duplicateResponse.statusCode).toBe(200);
    const duplicateBody = duplicateResponse.json() as {
      results: Array<{ status: string; reasonCode: string | null }>;
    };
    expect(duplicateBody.results[0]).toMatchObject({
      status: 'conflict',
      reasonCode: 'duplicate_natural_key',
    });
  });

  it('exposes web-originated collection changes to the next desktop pull', async () => {
    const { app, deviceToken } = await createTestApp();
    apps.push(app);
    const browserCookie = await createBrowserCookie(app);

    const webCreateResponse = await app.inject({
      method: 'POST',
      url: '/api/collections',
      headers: {
        cookie: browserCookie,
      },
      payload: {
        name: 'From Web',
        description: 'Created remotely',
      },
    });

    expect(webCreateResponse.statusCode).toBe(200);
    const createdCollection = webCreateResponse.json() as { id: string };

    const pullResponse = await app.inject({
      method: 'GET',
      url: '/api/sync/pull?cursor=0&limit=10',
      headers: {
        authorization: `Bearer ${deviceToken}`,
      },
    });

    expect(pullResponse.statusCode).toBe(200);
    const pullBody = pullResponse.json() as {
      events: Array<{ entityType: string; entityId: string; actorDeviceId: string | null }>;
    };

    expect(pullBody.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entityType: 'collection',
          entityId: createdCollection.id,
          actorDeviceId: null,
        }),
      ]),
    );
  });

  it('returns device_revoked after the current device has been revoked', async () => {
    const { app, deviceToken, deviceId } = await createTestApp();
    apps.push(app);

    const revokeResponse = await app.inject({
      method: 'POST',
      url: `/api/sync/devices/${deviceId}/revoke`,
      headers: {
        authorization: `Bearer ${deviceToken}`,
      },
    });

    expect(revokeResponse.statusCode).toBe(200);

    const revokedPullResponse = await app.inject({
      method: 'GET',
      url: '/api/sync/pull?cursor=0&limit=10',
      headers: {
        authorization: `Bearer ${deviceToken}`,
      },
    });

    expect(revokedPullResponse.statusCode).toBe(403);
    expect(revokedPullResponse.json()).toMatchObject({
      code: 'device_revoked',
    });
  });

  it('returns cursor_expired when the device cursor is ahead of the retained server window', async () => {
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
      reasonCode: 'cursor_expired',
      events: [],
    });
  });
});
