import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SyncOutboxChange, SyncPullResponse, SyncPushResponse, SyncRoundRecord } from '@perchlink/core';
import { createDesktopSyncManager } from './syncManager';
import { SyncRequestError, type DesktopSyncBootstrapPayload, type DesktopSyncConnectionRecord } from './syncClient';

function createConnectedRecord(): DesktopSyncConnectionRecord {
  return {
    remoteAddress: 'http://127.0.0.1:8787',
    accountId: 'account-1',
    accountName: 'owner',
    sessionToken: 'session-1',
    deviceToken: 'ptdev_token',
    currentDevice: {
      id: 'device-1',
      deviceName: 'My Windows PC',
      lastCursor: 0,
      createdAt: '2026-04-11T00:00:00.000Z',
      updatedAt: '2026-04-11T00:00:00.000Z',
      lastSeenAt: null,
      revokedAt: null,
    },
    localOnly: false,
    registrationRequired: false,
    syncing: false,
    lastPushAt: null,
    lastPullAt: null,
    lastError: null,
  };
}

function createEmptyBootstrapPayload(): DesktopSyncBootstrapPayload {
  return {
    serverCursor: 0,
    bookmarks: [],
    categories: [],
    collections: [],
  };
}

describe('desktopSyncManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('collapses repeated local mutations into one debounced push round', async () => {
    let connection = createConnectedRecord();
    const recordRound = vi.fn(async (_round: SyncRoundRecord) => {});
    const listOutbox = vi.fn<() => Promise<SyncOutboxChange[]>>().mockResolvedValue([
      {
        changeId: 'change-1',
        entityType: 'bookmark',
        entityId: 'bookmark-1',
        operation: 'upsert',
        baseVersion: null,
        writerKind: 'user',
        changedFields: ['title'],
        snapshot: {
          entityType: 'bookmark',
          id: 'bookmark-1',
          url: 'https://example.com',
          normalizedUrl: 'https://example.com',
          title: 'Example',
          description: null,
          descriptionExcerpt: null,
          favicon: null,
          coverUrl: null,
          primaryCategoryId: 'system-unsorted',
          isStarred: false,
          processingStatus: 'ready',
          processingError: null,
          userEditedMask: ['title'],
          tags: [],
          collectionIds: [],
          createdAt: '2026-04-11T00:00:00.000Z',
          updatedAt: '2026-04-11T00:00:00.000Z',
          deletedAt: null,
          version: 0,
        },
        createdAt: '2026-04-11T00:00:00.000Z',
      },
    ]);
    const pushChanges = vi.fn<() => Promise<SyncPushResponse>>().mockResolvedValue({
      device: connection.currentDevice!,
      serverCursor: 1,
      results: [],
    });
    const pullChanges = vi.fn().mockResolvedValue({
      serverCursor: 0,
      resyncRequired: false,
      events: [],
    } satisfies SyncPullResponse);

    const manager = createDesktopSyncManager(
      {
        getConnection: vi.fn(async () => connection),
        saveConnection: vi.fn(async (next) => {
          connection = next;
          return next;
        }),
        getStatus: vi.fn(),
        listOutbox,
        ackPushResults: vi.fn(async () => {}),
        applyRemoteEvents: vi.fn(async () => {}),
        recordRound,
        prepareResync: vi.fn(async () => {}),
        rebuildSyncState: vi.fn(async (_payload: DesktopSyncBootstrapPayload) => {}),
      },
      {
        pushChanges,
        pullChanges,
        fetchBootstrap: vi.fn(async () => createEmptyBootstrapPayload()),
      },
    );

    await manager.start();
    pushChanges.mockClear();
    pullChanges.mockClear();

    manager.noteLocalMutation();
    manager.noteLocalMutation();
    manager.noteLocalMutation();

    await vi.advanceTimersByTimeAsync(3999);
    expect(pushChanges).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(pushChanges).toHaveBeenCalledTimes(1);
    expect(pullChanges).toHaveBeenCalledTimes(1);
    expect(recordRound).toHaveBeenCalled();
  });

  it('does not advance into a second round when applying pulled events fails', async () => {
    let connection = createConnectedRecord();
    const applyRemoteEvents = vi.fn().mockRejectedValue(new Error('apply failed'));
    const recordRound = vi.fn(async (_round: SyncRoundRecord) => {});
    const saveConnection = vi.fn(async (next: DesktopSyncConnectionRecord) => {
      connection = next;
      return next;
    });

    const manager = createDesktopSyncManager(
      {
        getConnection: vi.fn(async () => connection),
        saveConnection,
        getStatus: vi.fn(),
        listOutbox: vi.fn(async () => []),
        ackPushResults: vi.fn(async () => {}),
        applyRemoteEvents,
        recordRound,
        prepareResync: vi.fn(async () => {}),
        rebuildSyncState: vi.fn(async (_payload: DesktopSyncBootstrapPayload) => {}),
      },
      {
        pushChanges: vi.fn(async () => ({
          device: connection.currentDevice!,
          serverCursor: 0,
          results: [],
        })),
        pullChanges: vi.fn(async () => ({
          serverCursor: 3,
          resyncRequired: false,
          events: [
            {
              seq: 3,
              entityType: 'bookmark' as const,
              entityId: 'bookmark-3',
              operation: 'upsert' as const,
              entityVersion: 2,
              writerKind: 'user' as const,
              actorDeviceId: 'other-device',
              changedFields: ['title'],
              snapshot: {
                entityType: 'bookmark' as const,
                id: 'bookmark-3',
                url: 'https://example.com/3',
                normalizedUrl: 'https://example.com/3',
                title: 'Remote',
                description: null,
                descriptionExcerpt: null,
                favicon: null,
                coverUrl: null,
                primaryCategoryId: 'system-unsorted',
                isStarred: false,
                processingStatus: 'ready',
                processingError: null,
                userEditedMask: [],
                tags: [],
                collectionIds: [],
                createdAt: '2026-04-11T00:00:00.000Z',
                updatedAt: '2026-04-11T00:00:00.000Z',
                deletedAt: null,
                version: 2,
              },
              occurredAt: '2026-04-11T00:00:00.000Z',
            },
          ],
        }) satisfies SyncPullResponse),
        fetchBootstrap: vi.fn(async () => createEmptyBootstrapPayload()),
      },
    );

    await manager.start();
    expect(applyRemoteEvents).toHaveBeenCalledTimes(1);
    expect(saveConnection).toHaveBeenLastCalledWith(expect.objectContaining({ lastError: 'apply failed', syncing: false }));
    expect(recordRound).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', message: 'apply failed' }));
  });

  it('treats pull replay from the current device as a normal pull without triggering another push', async () => {
    let connection = createConnectedRecord();
    const pushChanges = vi.fn().mockResolvedValue({
      device: connection.currentDevice!,
      serverCursor: 1,
      results: [],
    });
    const applyRemoteEvents = vi.fn().mockResolvedValue(undefined);
    const recordRound = vi.fn(async (_round: SyncRoundRecord) => {});

    const manager = createDesktopSyncManager(
      {
        getConnection: vi.fn(async () => connection),
        saveConnection: vi.fn(async (next) => {
          connection = next;
          return next;
        }),
        getStatus: vi.fn(),
        listOutbox: vi.fn(async () => []),
        ackPushResults: vi.fn(async () => {}),
        applyRemoteEvents,
        recordRound,
        prepareResync: vi.fn(async () => {}),
        rebuildSyncState: vi.fn(async (_payload: DesktopSyncBootstrapPayload) => {}),
      },
      {
        pushChanges,
        pullChanges: vi.fn(async () => ({
          serverCursor: 2,
          resyncRequired: false,
          events: [
            {
              seq: 2,
              entityType: 'bookmark' as const,
              entityId: 'bookmark-2',
              operation: 'upsert' as const,
              entityVersion: 2,
              writerKind: 'user' as const,
              actorDeviceId: 'device-1',
              changedFields: ['title'],
              snapshot: {
                entityType: 'bookmark' as const,
                id: 'bookmark-2',
                url: 'https://example.com/2',
                normalizedUrl: 'https://example.com/2',
                title: 'Same device',
                description: null,
                descriptionExcerpt: null,
                favicon: null,
                coverUrl: null,
                primaryCategoryId: 'system-unsorted',
                isStarred: false,
                processingStatus: 'ready',
                processingError: null,
                userEditedMask: [],
                tags: [],
                collectionIds: [],
                createdAt: '2026-04-11T00:00:00.000Z',
                updatedAt: '2026-04-11T00:00:00.000Z',
                deletedAt: null,
                version: 2,
              },
              occurredAt: '2026-04-11T00:00:00.000Z',
            },
          ],
        }) satisfies SyncPullResponse),
        fetchBootstrap: vi.fn(async () => createEmptyBootstrapPayload()),
      },
    );

    await manager.start();
    expect(pushChanges).toHaveBeenCalledTimes(0);
    expect(applyRemoteEvents).toHaveBeenCalledTimes(1);
    expect(recordRound).toHaveBeenCalledWith(expect.objectContaining({ status: 'succeeded', pullCount: 1 }));
  });

  it('prepares and rebuilds local sync state when the cursor expires', async () => {
    let connection = createConnectedRecord();
    const prepareResync = vi.fn(async () => {});
    const rebuildSyncState = vi.fn(async (_payload: DesktopSyncBootstrapPayload) => {});
    const fetchBootstrap = vi.fn(async () => ({
      serverCursor: 8,
      bookmarks: [],
      categories: [],
      collections: [],
    }));
    const recordRound = vi.fn(async (_round: SyncRoundRecord) => {});

    const manager = createDesktopSyncManager(
      {
        getConnection: vi.fn(async () => connection),
        saveConnection: vi.fn(async (next) => {
          connection = next;
          return next;
        }),
        getStatus: vi.fn(),
        listOutbox: vi.fn(async () => []),
        ackPushResults: vi.fn(async () => {}),
        applyRemoteEvents: vi.fn(async () => {}),
        recordRound,
        prepareResync,
        rebuildSyncState,
      },
      {
        pushChanges: vi.fn(async () => ({
          device: connection.currentDevice!,
          serverCursor: 0,
          results: [],
        })),
        pullChanges: vi.fn(async () => ({
          serverCursor: 0,
          resyncRequired: true,
          events: [],
        })),
        fetchBootstrap,
      },
    );

    await manager.start();

    expect(prepareResync).toHaveBeenCalledTimes(1);
    expect(fetchBootstrap).toHaveBeenCalledTimes(1);
    expect(rebuildSyncState).toHaveBeenCalledWith(expect.objectContaining({ serverCursor: 8 }));
    expect(recordRound).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', message: 'cursor_expired' }));
  });

  it('falls back to local-only mode when the server revokes the current device', async () => {
    let connection = createConnectedRecord();
    const saveConnection = vi.fn(async (next: DesktopSyncConnectionRecord) => {
      connection = next;
      return next;
    });
    const recordRound = vi.fn(async (_round: SyncRoundRecord) => {});

    const manager = createDesktopSyncManager(
      {
        getConnection: vi.fn(async () => connection),
        saveConnection,
        getStatus: vi.fn(),
        listOutbox: vi.fn(async () => []),
        ackPushResults: vi.fn(async () => {}),
        applyRemoteEvents: vi.fn(async () => {}),
        recordRound,
        prepareResync: vi.fn(async () => {}),
        rebuildSyncState: vi.fn(async (_payload: DesktopSyncBootstrapPayload) => {}),
      },
      {
        pushChanges: vi.fn(async () => ({
          device: connection.currentDevice!,
          serverCursor: 0,
          results: [],
        })),
        pullChanges: vi.fn(async () => {
          throw new SyncRequestError('This sync device has been revoked.', 'device_revoked', 403);
        }),
        fetchBootstrap: vi.fn(async () => createEmptyBootstrapPayload()),
      },
    );

    await manager.start();

    expect(saveConnection).toHaveBeenLastCalledWith(
      expect.objectContaining({
        localOnly: true,
        registrationRequired: true,
        deviceToken: null,
        currentDevice: null,
        lastError: 'device_revoked',
      }),
    );
    expect(recordRound).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', message: 'device_revoked' }));
  });
});
