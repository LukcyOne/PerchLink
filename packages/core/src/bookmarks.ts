export const BOOKMARK_PROCESSING_STATUSES = ['pending', 'processing', 'ready', 'failed'] as const;

export type BookmarkProcessingStatus = (typeof BOOKMARK_PROCESSING_STATUSES)[number];
export type BookmarkSortField = 'createdAt' | 'updatedAt' | 'title';
export type SortDirection = 'asc' | 'desc';
export type BookmarkEditableField =
  | 'title'
  | 'description'
  | 'favicon'
  | 'coverUrl'
  | 'primaryCategoryId'
  | 'tags'
  | 'collectionIds';

export interface TagInput {
  id?: string;
  label: string;
  color?: string | null;
}

export interface TagRecord {
  id: string;
  label: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionRecord {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  bookmarkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CategoryTreeNode {
  id: string;
  name: string;
  slug: string | null;
  parentId: string | null;
  sortOrder: number;
  isSystem: boolean;
  bookmarkCount: number;
  createdAt: string;
  updatedAt: string;
  children: CategoryTreeNode[];
}

export interface BookmarkRecord {
  id: string;
  url: string;
  normalizedUrl: string;
  title: string;
  description: string | null;
  descriptionExcerpt: string | null;
  favicon: string | null;
  coverUrl: string | null;
  primaryCategoryId: string | null;
  tags: TagRecord[];
  collectionIds: string[];
  isStarred: boolean;
  processingStatus: BookmarkProcessingStatus;
  processingError: string | null;
  userEditedMask: BookmarkEditableField[];
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface CreateBookmarkInput {
  url: string;
  title?: string;
  description?: string | null;
  favicon?: string | null;
  coverUrl?: string | null;
  primaryCategoryId?: string | null;
  isStarred?: boolean;
  processingStatus?: BookmarkProcessingStatus;
  processingError?: string | null;
  userEditedMask?: BookmarkEditableField[];
  tags?: TagInput[];
  collectionIds?: string[];
}

export interface UpdateBookmarkPatch {
  url?: string;
  title?: string;
  description?: string | null;
  favicon?: string | null;
  coverUrl?: string | null;
  primaryCategoryId?: string | null;
  isStarred?: boolean;
  processingStatus?: BookmarkProcessingStatus;
  processingError?: string | null;
  userEditedMask?: BookmarkEditableField[];
  tags?: TagInput[];
  collectionIds?: string[];
  deletedAt?: string | null;
}

export interface BookmarkListQuery {
  search?: string;
  categoryId?: string;
  collectionId?: string;
  tagIds?: string[];
  isStarred?: boolean;
  processingStatuses?: BookmarkProcessingStatus[];
  limit?: number;
  offset?: number;
  sortBy?: BookmarkSortField;
  sortDirection?: SortDirection;
  includeDeleted?: boolean;
}

export interface SaveCategoryInput {
  id?: string;
  name: string;
  slug?: string | null;
  parentId?: string | null;
  sortOrder?: number;
}

export interface SaveCollectionInput {
  id?: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
}

export function normalizeBookmarkUrl(input: string): string {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    return '';
  }

  const schemeSeparatorIndex = trimmed.indexOf('://');

  if (schemeSeparatorIndex === -1) {
    return trimmed.replace(/\/+$/, '');
  }

  const scheme = trimmed.slice(0, schemeSeparatorIndex).toLowerCase();
  const remainder = trimmed.slice(schemeSeparatorIndex + 3);
  const authorityMatch = remainder.match(/^[^/?#]+/u);

  if (!authorityMatch) {
    return `${scheme}://`;
  }

  const authority = authorityMatch[0].toLowerCase();
  const rest = remainder.slice(authority.length);
  const hashIndex = rest.indexOf('#');
  const withoutHash = hashIndex >= 0 ? rest.slice(0, hashIndex) : rest;
  const queryIndex = withoutHash.indexOf('?');
  const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex) : '';
  const normalizedPath = path.replace(/\/+$/, '');

  if (normalizedPath.length === 0 && query.length === 0) {
    return `${scheme}://${authority}`;
  }

  return `${scheme}://${authority}${normalizedPath}${query}`;
}

