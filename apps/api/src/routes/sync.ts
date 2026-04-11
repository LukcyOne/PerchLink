import { createHash, randomBytes } from 'node:crypto';
import { compare } from 'bcryptjs';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { ulid } from 'ulid';
import { z } from 'zod';
import { loadSyncEntitySnapshot } from '../services/syncEvents.js';
import {
  SyncMutationError,
  deleteBookmarkCanonical,
  deleteCategoryCanonical,
  deleteCollectionCanonical,
  upsertBookmarkCanonical,
  upsertCategoryCanonical,
  upsertCollectionCanonical,
} from '../services/syncMutations.js';
import type {
  SyncBookmarkSnapshot,
  SyncCategorySnapshot,
  SyncCollectionSnapshot,
  SyncDeviceRecord,
  SyncEntitySnapshot,
  SyncEntityType,
  SyncOutboxChange,
  SyncPushResult,
  SyncReasonCode,
} from '../syncContract.js';
import { normalizeSyncBookmarkUrl } from '../syncContract.js';

interface AccountRow {
  id: string;
  account_name: string;
  password_hash: string;
}

interface DeviceRow {
  id: string;
  account_id: string;
  device_name: string;
  token_hash: string;
  last_cursor: number;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
  revoked_at: string | null;
}

interface StoredPushReceiptRow {
  change_id: string;
  entity_type: SyncEntityType;
  entity_id: string;
  result_status: SyncPushResult['status'];
  reason_code: SyncReasonCode | null;
  entity_version: number | null;
  event_seq: number | null;
  server_snapshot_json: string | null;
}

const syncSignInSchema = z.object({
  account: z.string().trim().min(1),
  password: z.string().min(1),
});

const deviceRegistrationSchema = z.object({
  deviceName: z.string().trim().min(1).max(80),
});

const bookmarkSnapshotSchema = z.object({
  entityType: z.literal('bookmark'),
  id: z.string().min(1),
  url: z.string().trim().min(1),
  normalizedUrl: z.string().trim().min(1),
  title: z.string().trim().min(1),
  description: z.string().nullable(),
  descriptionExcerpt: z.string().nullable(),
  favicon: z.string().nullable(),
  coverUrl: z.string().nullable(),
  primaryCategoryId: z.string().nullable(),
  isStarred: z.boolean(),
  processingStatus: z.enum(['pending', 'processing', 'ready', 'failed']),
  processingError: z.string().nullable(),
  userEditedMask: z.array(z.string()),
  tags: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().trim().min(1),
      color: z.string().nullable(),
    }),
  ),
  collectionIds: z.array(z.string().min(1)),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  deletedAt: z.string().nullable(),
  version: z.number().int().min(0),
});

const categorySnapshotSchema = z.object({
  entityType: z.literal('category'),
  id: z.string().min(1),
  name: z.string().trim().min(1),
  slug: z.string().nullable(),
  parentId: z.string().nullable(),
  sortOrder: z.number().int().min(0),
  isSystem: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  deletedAt: z.string().nullable(),
  version: z.number().int().min(0),
});

const collectionSnapshotSchema = z.object({
  entityType: z.literal('collection'),
  id: z.string().min(1),
  name: z.string().trim().min(1),
  description: z.string().nullable(),
  sortOrder: z.number().int().min(0),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  deletedAt: z.string().nullable(),
  version: z.number().int().min(0),
});

const syncSnapshotSchema = z.discriminatedUnion('entityType', [
  bookmarkSnapshotSchema,
  categorySnapshotSchema,
  collectionSnapshotSchema,
]);

const syncOutboxChangeSchema = z.object({
  changeId: z.string().min(1),
  entityType: z.enum(['bookmark', 'category', 'collection']),
  entityId: z.string().min(1),
  operation: z.enum(['upsert', 'delete']),
  baseVersion: z.number().int().min(0).nullable(),
  writerKind: z.enum(['user', 'system', 'ai']),
  changedFields: z.array(z.string()),
  snapshot: syncSnapshotSchema,
  createdAt: z.string().min(1),
});

const syncPushRequestSchema = z.object({
  changes: z.array(syncOutboxChangeSchema),
});

const syncPullQuerySchema = z.object({
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});

function nowIso(): string {
  return new Date().toISOString();
}

function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function createDeviceToken(): string {
  return `ptdev_${randomBytes(24).toString('hex')}`;
}

function serializeDevice(row: DeviceRow): SyncDeviceRecord {
  return {
    id: row.id,
    deviceName: row.device_name,
    lastCursor: row.last_cursor,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at,
  };
}

function loadCurrentDevice(app: FastifyInstance, request: FastifyRequest): DeviceRow {
  if (!request.currentDevice || !request.currentAccount) {
    throw new Error('Device context is unavailable.');
  }

  const row = app.db
    .prepare(
      `
        SELECT id, account_id, device_name, token_hash, last_cursor, created_at, updated_at, last_seen_at, revoked_at
        FROM devices
        WHERE id = ?
          AND account_id = ?
      `,
    )
    .get(request.currentDevice.id, request.currentAccount.id) as DeviceRow | undefined;

  if (!row || row.revoked_at) {
    throw new Error('Current device is no longer authorized.');
  }

  return row;
}

function loadPushReceipt(app: FastifyInstance, deviceId: string, changeId: string): SyncPushResult | null {
  const row = app.db
    .prepare(
      `
        SELECT
          change_id,
          entity_type,
          entity_id,
          result_status,
          reason_code,
          entity_version,
          event_seq,
          server_snapshot_json
        FROM sync_applied_changes
        WHERE device_id = ?
          AND change_id = ?
      `,
    )
    .get(deviceId, changeId) as StoredPushReceiptRow | undefined;

  if (!row) {
    return null;
  }

  return {
    changeId: row.change_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    status: row.result_status,
    reasonCode: row.reason_code,
    appliedEntityVersion: row.entity_version,
    serverSeq: row.event_seq,
    serverSnapshot: row.server_snapshot_json ? (JSON.parse(row.server_snapshot_json) as SyncEntitySnapshot) : null,
  };
}

function persistPushReceipt(
  app: FastifyInstance,
  request: FastifyRequest,
  deviceId: string,
  result: SyncPushResult,
): void {
  app.db
    .prepare(
      `
        INSERT INTO sync_applied_changes (
          device_id,
          change_id,
          account_id,
          entity_type,
          entity_id,
          result_status,
          reason_code,
          entity_version,
          event_seq,
          server_snapshot_json,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    )
    .run(
      deviceId,
      result.changeId,
      request.currentAccount!.id,
      result.entityType,
      result.entityId,
      result.status,
      result.reasonCode,
      result.appliedEntityVersion,
      result.serverSeq,
      result.serverSnapshot ? JSON.stringify(result.serverSnapshot) : null,
      nowIso(),
    );
}

function buildPushResult(
  change: SyncOutboxChange,
  status: SyncPushResult['status'],
  reasonCode: SyncReasonCode | null,
  serverSnapshot: SyncEntitySnapshot | null,
  serverSeq: number | null,
): SyncPushResult {
  return {
    changeId: change.changeId,
    entityType: change.entityType,
    entityId: change.entityId,
    status,
    reasonCode,
    appliedEntityVersion: serverSnapshot?.version ?? null,
    serverSeq,
    serverSnapshot,
  };
}

function validateBookmarkSnapshot(shape: SyncEntitySnapshot): SyncBookmarkSnapshot {
  return bookmarkSnapshotSchema.parse({
    ...shape,
    normalizedUrl: normalizeSyncBookmarkUrl((shape as SyncBookmarkSnapshot).url),
  });
}

function validateBaseVersion(change: SyncOutboxChange, current: SyncEntitySnapshot | null): SyncPushResult | null {
  if (change.operation === 'delete') {
    if (!current || current.deletedAt) {
      return buildPushResult(change, 'noop', 'deleted_on_server', current, null);
    }

    if (change.baseVersion !== current.version) {
      return buildPushResult(change, 'conflict', current.deletedAt ? 'deleted_on_server' : 'base_version_conflict', current, null);
    }

    return null;
  }

  if (!current) {
    if (change.baseVersion !== null && change.baseVersion > 0) {
      return buildPushResult(change, 'conflict', 'deleted_on_server', null, null);
    }

    return null;
  }

  if (change.baseVersion !== current.version) {
    return buildPushResult(change, 'conflict', current.deletedAt ? 'deleted_on_server' : 'base_version_conflict', current, null);
  }

  return null;
}

function applySyncChange(app: FastifyInstance, request: FastifyRequest, device: DeviceRow, change: SyncOutboxChange): SyncPushResult {
  const stored = loadPushReceipt(app, device.id, change.changeId);
  if (stored) {
    return stored;
  }

  if (change.snapshot.entityType !== change.entityType) {
    const result = buildPushResult(change, 'rejected', 'validation_failed', null, null);
    persistPushReceipt(app, request, device.id, result);
    return result;
  }

  return app.db.transaction(() => {
    const current = loadSyncEntitySnapshot(app.db, change.entityType, change.entityId);
    const versionConflict = validateBaseVersion(change, current);

    if (versionConflict) {
      persistPushReceipt(app, request, device.id, versionConflict);
      return versionConflict;
    }

    try {
      switch (change.entityType) {
        case 'bookmark': {
          if (change.operation === 'delete') {
            const event = deleteBookmarkCanonical({
              db: app.db,
              accountId: request.currentAccount!.id,
              bookmarkId: change.entityId,
              writerKind: change.writerKind,
              actorDeviceId: device.id,
            });
            const result = buildPushResult(change, event ? 'accepted' : 'noop', event ? null : 'deleted_on_server', event?.snapshot ?? current, event?.seq ?? null);
            persistPushReceipt(app, request, device.id, result);
            return result;
          }

          const event = upsertBookmarkCanonical({
            db: app.db,
            accountId: request.currentAccount!.id,
            snapshot: validateBookmarkSnapshot(change.snapshot),
            writerKind: change.writerKind,
            actorDeviceId: device.id,
            changedFields: change.changedFields,
          });
          const result = buildPushResult(change, 'accepted', null, event.snapshot, event.seq);
          persistPushReceipt(app, request, device.id, result);
          return result;
        }
        case 'category': {
          if (change.operation === 'delete') {
            const event = deleteCategoryCanonical({
              db: app.db,
              accountId: request.currentAccount!.id,
              categoryId: change.entityId,
              writerKind: change.writerKind,
              actorDeviceId: device.id,
            });
            const result = buildPushResult(change, event ? 'accepted' : 'noop', event ? null : 'deleted_on_server', event?.snapshot ?? current, event?.seq ?? null);
            persistPushReceipt(app, request, device.id, result);
            return result;
          }

          const snapshot = categorySnapshotSchema.parse(change.snapshot) as SyncCategorySnapshot;
          const event = upsertCategoryCanonical({
            db: app.db,
            accountId: request.currentAccount!.id,
            snapshot,
            writerKind: change.writerKind,
            actorDeviceId: device.id,
            changedFields: change.changedFields,
          });
          const result = buildPushResult(change, 'accepted', null, event.snapshot, event.seq);
          persistPushReceipt(app, request, device.id, result);
          return result;
        }
        case 'collection': {
          if (change.operation === 'delete') {
            const event = deleteCollectionCanonical({
              db: app.db,
              accountId: request.currentAccount!.id,
              collectionId: change.entityId,
              writerKind: change.writerKind,
              actorDeviceId: device.id,
            });
            const result = buildPushResult(change, event ? 'accepted' : 'noop', event ? null : 'deleted_on_server', event?.snapshot ?? current, event?.seq ?? null);
            persistPushReceipt(app, request, device.id, result);
            return result;
          }

          const snapshot = collectionSnapshotSchema.parse(change.snapshot) as SyncCollectionSnapshot;
          const event = upsertCollectionCanonical({
            db: app.db,
            accountId: request.currentAccount!.id,
            snapshot,
            writerKind: change.writerKind,
            actorDeviceId: device.id,
            changedFields: change.changedFields,
          });
          const result = buildPushResult(change, 'accepted', null, event.snapshot, event.seq);
          persistPushReceipt(app, request, device.id, result);
          return result;
        }
        default: {
          const result = buildPushResult(change, 'rejected', 'validation_failed', current, null);
          persistPushReceipt(app, request, device.id, result);
          return result;
        }
      }
    } catch (error) {
      if (error instanceof SyncMutationError) {
        const result = buildPushResult(change, 'rejected', error.reasonCode, current, null);
        persistPushReceipt(app, request, device.id, result);
        return result;
      }

      throw error;
    }
  })();
}

export async function registerSyncRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/sync/session', async (request, reply) => {
    const input = syncSignInSchema.parse(request.body);
    const account = app.db
      .prepare(
        `
          SELECT id, account_name, password_hash
          FROM accounts
          WHERE account_name = ?
        `,
      )
      .get(input.account) as AccountRow | undefined;

    if (!account || !(await compare(input.password, account.password_hash))) {
      reply.code(401).send({
        code: 'invalid_credentials',
        message: 'The account or password is incorrect. Try again.',
      });
      return;
    }

    const sessionId = ulid();
    const now = nowIso();
    app.db
      .prepare(
        `
          INSERT INTO sessions (id, account_id, created_at, expires_at, revoked_at)
          VALUES (?, ?, ?, ?, NULL)
        `,
      )
      .run(sessionId, account.id, now, new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString());

    return {
      account: {
        id: account.id,
        account_name: account.account_name,
      },
      session_token: sessionId,
    };
  });

  app.post('/api/sync/devices/register', { preHandler: app.requireSession }, async (request) => {
    const input = deviceRegistrationSchema.parse(request.body);
    const deviceId = ulid();
    const now = nowIso();
    const deviceToken = createDeviceToken();
    const tokenHash = hashDeviceToken(deviceToken);

    app.db
      .prepare(
        `
          INSERT INTO devices (
            id,
            account_id,
            device_name,
            token_hash,
            last_cursor,
            created_at,
            updated_at,
            last_seen_at,
            revoked_at
          ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, NULL)
        `,
      )
      .run(deviceId, request.currentAccount!.id, input.deviceName, tokenHash, now, now, now);

    const device = app.db
      .prepare(
        `
          SELECT id, account_id, device_name, token_hash, last_cursor, created_at, updated_at, last_seen_at, revoked_at
          FROM devices
          WHERE id = ?
        `,
      )
      .get(deviceId) as DeviceRow;

    return {
      device: serializeDevice(device),
      device_token: deviceToken,
    };
  });

  app.get('/api/sync/devices', { preHandler: app.requireDevice }, async (request) => {
    const currentDevice = loadCurrentDevice(app, request);
    const devices = app.db
      .prepare(
        `
          SELECT id, account_id, device_name, token_hash, last_cursor, created_at, updated_at, last_seen_at, revoked_at
          FROM devices
          WHERE account_id = ?
          ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END, updated_at DESC, created_at DESC
        `,
      )
      .all(request.currentAccount!.id, currentDevice.id) as DeviceRow[];

    return devices.map(serializeDevice);
  });

  app.post('/api/sync/devices/:deviceId/revoke', { preHandler: app.requireDevice }, async (request, reply) => {
    const currentDevice = loadCurrentDevice(app, request);
    const params = z.object({ deviceId: z.string().min(1) }).parse(request.params);
    const target = app.db
      .prepare(
        `
          SELECT id, account_id, device_name, token_hash, last_cursor, created_at, updated_at, last_seen_at, revoked_at
          FROM devices
          WHERE id = ?
            AND account_id = ?
        `,
      )
      .get(params.deviceId, request.currentAccount!.id) as DeviceRow | undefined;

    if (!target) {
      reply.code(404).send({ code: 'device_not_found' });
      return;
    }

    const timestamp = nowIso();
    app.db
      .prepare(
        `
          UPDATE devices
          SET revoked_at = ?, updated_at = ?
          WHERE id = ?
        `,
      )
      .run(timestamp, timestamp, params.deviceId);

    const updated = app.db
      .prepare(
        `
          SELECT id, account_id, device_name, token_hash, last_cursor, created_at, updated_at, last_seen_at, revoked_at
          FROM devices
          WHERE id = ?
        `,
      )
      .get(params.deviceId) as DeviceRow;

    return {
      revoked: true,
      current_device: currentDevice.id,
      device: serializeDevice(updated),
    };
  });

  app.post('/api/sync/push', { preHandler: app.requireDevice }, async (request) => {
    const device = loadCurrentDevice(app, request);
    const input = syncPushRequestSchema.parse(request.body);
    const results = input.changes.map((change) => applySyncChange(app, request, device, change as SyncOutboxChange));
    const serverCursor = results.reduce((cursor, result) => Math.max(cursor, result.serverSeq ?? cursor), device.last_cursor);

    return {
      device: serializeDevice(device),
      serverCursor,
      results,
    };
  });

  app.get('/api/sync/pull', { preHandler: app.requireDevice }, async (request, reply) => {
    const device = loadCurrentDevice(app, request);
    const query = syncPullQuerySchema.parse(request.query ?? {});
    const maxSeq = Number(
      (
        app.db.prepare('SELECT COALESCE(MAX(seq), 0) AS max_seq FROM sync_events WHERE account_id = ?').get(request.currentAccount!.id) as {
          max_seq: number;
        }
      ).max_seq,
    );

    if (query.cursor > maxSeq) {
      reply.code(409).send({
        serverCursor: maxSeq,
        resyncRequired: true,
        events: [],
      });
      return;
    }

    const rows = app.db
      .prepare(
        `
          SELECT seq, entity_type, entity_id, operation, entity_version, writer_kind, actor_device_id, changed_fields_json, payload_json, created_at
          FROM sync_events
          WHERE account_id = ?
            AND seq > ?
          ORDER BY seq ASC
          LIMIT ?
        `,
      )
      .all(request.currentAccount!.id, query.cursor, query.limit) as Array<{
      seq: number;
      entity_type: SyncEntityType;
      entity_id: string;
      operation: 'upsert' | 'delete';
      entity_version: number;
      writer_kind: 'user' | 'system' | 'ai';
      actor_device_id: string | null;
      changed_fields_json: string;
      payload_json: string;
      created_at: string;
    }>;

    const events = rows.map((row) => ({
      seq: row.seq,
      entityType: row.entity_type,
      entityId: row.entity_id,
      operation: row.operation,
      entityVersion: row.entity_version,
      writerKind: row.writer_kind,
      actorDeviceId: row.actor_device_id,
      changedFields: JSON.parse(row.changed_fields_json || '[]') as string[],
      snapshot: JSON.parse(row.payload_json) as SyncEntitySnapshot,
      occurredAt: row.created_at,
    }));
    const serverCursor = events.at(-1)?.seq ?? query.cursor;

    app.db
      .prepare(
        `
          UPDATE devices
          SET last_cursor = ?, last_seen_at = ?, updated_at = ?
          WHERE id = ?
        `,
      )
      .run(Math.max(device.last_cursor, serverCursor), nowIso(), nowIso(), device.id);

    return {
      serverCursor,
      resyncRequired: false,
      events,
    };
  });
}
