import { describe, expect, it } from 'vitest';
import {
  SYNC_CONNECTION_STATES,
  SYNC_PUSH_RESULT_STATUSES,
  SYNC_REASON_CODES,
  SYNC_WRITER_KINDS,
  createEmptySyncStatusSnapshot,
  isSyncReasonCode,
  type SyncPushRequest,
} from './sync';

describe('sync contracts', () => {
  it('keeps the stable reason code vocabulary', () => {
    expect(SYNC_REASON_CODES).toEqual([
      'base_version_conflict',
      'deleted_on_server',
      'duplicate_natural_key',
      'dependency_missing',
      'validation_failed',
      'device_revoked',
      'auth_invalid',
      'cursor_expired',
    ]);
    expect(isSyncReasonCode('device_revoked')).toBe(true);
    expect(isSyncReasonCode('unknown')).toBe(false);
  });

  it('keeps the expected push result and connection states', () => {
    expect(SYNC_PUSH_RESULT_STATUSES).toEqual(['accepted', 'accepted_merged', 'noop', 'conflict', 'rejected']);
    expect(SYNC_CONNECTION_STATES).toEqual([
      'local-only',
      'registration-required',
      'syncing',
      'up-to-date',
      'needs-attention',
    ]);
    expect(SYNC_WRITER_KINDS).toEqual(['user', 'system', 'ai']);
  });

  it('creates an empty local-only sync status snapshot', () => {
    expect(createEmptySyncStatusSnapshot()).toEqual({
      connectionState: 'local-only',
      remoteAddress: null,
      localOnly: true,
      pendingPushCount: 0,
      unreadConflictCount: 0,
      lastPushAt: null,
      lastPullAt: null,
      lastError: null,
      currentDevice: null,
    });
  });

  it('supports push requests with canonical snapshots', () => {
    const request: SyncPushRequest = {
      changes: [
        {
          changeId: '01-test',
          entityType: 'bookmark',
          entityId: 'bookmark-1',
          operation: 'upsert',
          baseVersion: 2,
          writerKind: 'user',
          changedFields: ['title', 'tags'],
          createdAt: '2026-04-11T00:00:00.000Z',
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
            userEditedMask: ['title', 'tags'],
            tags: [{ id: 'tag-1', label: 'example', color: null }],
            collectionIds: [],
            createdAt: '2026-04-11T00:00:00.000Z',
            updatedAt: '2026-04-11T00:00:00.000Z',
            deletedAt: null,
            version: 2,
          },
        },
      ],
    };

    expect(request.changes[0]?.snapshot.entityType).toBe('bookmark');
    expect(request.changes[0]?.changedFields).toEqual(['title', 'tags']);
  });
});
