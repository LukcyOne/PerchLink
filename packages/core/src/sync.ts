export const SYNC_ENTITY_TYPES = ['bookmark', 'category', 'collection'] as const;
export const SYNC_OPERATIONS = ['upsert', 'delete'] as const;
export const SYNC_WRITER_KINDS = ['user', 'system', 'ai'] as const;
export const SYNC_CONNECTION_STATES = [
  'local-only',
  'registration-required',
  'syncing',
  'up-to-date',
  'needs-attention',
] as const;
export const SYNC_PUSH_RESULT_STATUSES = ['accepted', 'accepted_merged', 'noop', 'conflict', 'rejected'] as const;
export const SYNC_REASON_CODES = [
  'base_version_conflict',
  'deleted_on_server',
  'duplicate_natural_key',
  'dependency_missing',
  'validation_failed',
  'device_revoked',
  'auth_invalid',
  'cursor_expired',
] as const;
export const SYNC_ROUND_DIRECTIONS = ['push', 'pull', 'full'] as const;
export const SYNC_ROUND_STATUSES = ['running', 'succeeded', 'failed'] as const;

export type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number];
export type SyncOperation = (typeof SYNC_OPERATIONS)[number];
export type SyncWriterKind = (typeof SYNC_WRITER_KINDS)[number];
export type SyncConnectionState = (typeof SYNC_CONNECTION_STATES)[number];
export type SyncPushResultStatus = (typeof SYNC_PUSH_RESULT_STATUSES)[number];
export type SyncReasonCode = (typeof SYNC_REASON_CODES)[number];
export type SyncRoundDirection = (typeof SYNC_ROUND_DIRECTIONS)[number];
export type SyncRoundStatus = (typeof SYNC_ROUND_STATUSES)[number];

export interface SyncBookmarkSnapshot {
  entityType: 'bookmark';
  id: string;
  url: string;
  normalizedUrl: string;
  title: string;
  description: string | null;
  descriptionExcerpt: string | null;
  favicon: string | null;
  coverUrl: string | null;
  primaryCategoryId: string | null;
  isStarred: boolean;
  processingStatus: 'pending' | 'processing' | 'ready' | 'failed';
  processingError: string | null;
  userEditedMask: string[];
  tags: Array<{
    id: string;
    label: string;
    color: string | null;
  }>;
  collectionIds: string[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  version: number;
}

export interface SyncCategorySnapshot {
  entityType: 'category';
  id: string;
  name: string;
  slug: string | null;
  parentId: string | null;
  sortOrder: number;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  version: number;
}

export interface SyncCollectionSnapshot {
  entityType: 'collection';
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  version: number;
}

export type SyncEntitySnapshot = SyncBookmarkSnapshot | SyncCategorySnapshot | SyncCollectionSnapshot;

export interface SyncOutboxChange {
  changeId: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  baseVersion: number | null;
  writerKind: SyncWriterKind;
  changedFields: string[];
  snapshot: SyncEntitySnapshot;
  createdAt: string;
}

export interface SyncPushRequest {
  changes: SyncOutboxChange[];
}

export interface SyncPushResult {
  changeId: string;
  entityType: SyncEntityType;
  entityId: string;
  status: SyncPushResultStatus;
  reasonCode: SyncReasonCode | null;
  appliedEntityVersion: number | null;
  serverSeq: number | null;
  serverSnapshot: SyncEntitySnapshot | null;
}

export interface SyncPushResponse {
  device: SyncDeviceRecord;
  serverCursor: number;
  results: SyncPushResult[];
}

export interface SyncPullEvent {
  seq: number;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  entityVersion: number;
  writerKind: SyncWriterKind;
  actorDeviceId: string | null;
  changedFields: string[];
  snapshot: SyncEntitySnapshot;
  occurredAt: string;
}

export interface SyncPullResponse {
  serverCursor: number;
  resyncRequired: boolean;
  events: SyncPullEvent[];
}

export interface SyncDeviceRecord {
  id: string;
  deviceName: string;
  lastCursor: number;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
}

export interface SyncConflictRecord {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  reasonCode: SyncReasonCode;
  localPayload: SyncEntitySnapshot | null;
  serverSnapshot: SyncEntitySnapshot | null;
  unread: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SyncRoundRecord {
  id: string;
  direction: SyncRoundDirection;
  status: SyncRoundStatus;
  pushCount: number;
  pullCount: number;
  message: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface SyncStatusSnapshot {
  connectionState: SyncConnectionState;
  remoteAddress: string | null;
  localOnly: boolean;
  pendingPushCount: number;
  unreadConflictCount: number;
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastError: string | null;
  currentDevice: SyncDeviceRecord | null;
}

export function isSyncReasonCode(value: string): value is SyncReasonCode {
  return (SYNC_REASON_CODES as readonly string[]).includes(value);
}

export function createEmptySyncStatusSnapshot(): SyncStatusSnapshot {
  return {
    connectionState: 'local-only',
    remoteAddress: null,
    localOnly: true,
    pendingPushCount: 0,
    unreadConflictCount: 0,
    lastPushAt: null,
    lastPullAt: null,
    lastError: null,
    currentDevice: null,
  };
}
