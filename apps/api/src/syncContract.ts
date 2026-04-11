export type SyncEntityType = 'bookmark' | 'category' | 'collection';
export type SyncOperation = 'upsert' | 'delete';
export type SyncWriterKind = 'user' | 'system' | 'ai';
export type SyncPushResultStatus = 'accepted' | 'accepted_merged' | 'noop' | 'conflict' | 'rejected';
export type SyncReasonCode =
  | 'base_version_conflict'
  | 'deleted_on_server'
  | 'duplicate_natural_key'
  | 'dependency_missing'
  | 'validation_failed'
  | 'device_revoked'
  | 'auth_invalid'
  | 'cursor_expired';

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

export interface SyncDeviceRecord {
  id: string;
  deviceName: string;
  lastCursor: number;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
}

export function normalizeSyncBookmarkUrl(input: string): string {
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
