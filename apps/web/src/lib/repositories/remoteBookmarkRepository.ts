import type {
  ApplyAiSuggestionsInput,
  BookmarkAiStatus,
  BookmarkListQuery,
  BookmarkRecord,
  BookmarkRepository,
  BookmarkSearchQuery,
  CategoryTreeNode,
  CollectionRecord,
  CreateBookmarkInput,
  SaveCategoryInput,
  SaveCollectionInput,
  TagInput,
  TagRecord,
  UpdateBookmarkPatch,
} from '@perchlink/core';
import { RemoteRequestError, requestJson } from '../httpClient';

interface RemoteTagDto {
  id: string;
  label: string;
  color: string | null;
  created_at: string;
  updated_at: string;
}

interface RemoteBookmarkDto {
  id: string;
  url: string;
  normalized_url: string;
  title: string;
  description: string | null;
  description_excerpt: string | null;
  favicon: string | null;
  cover_url: string | null;
  primary_category_id: string | null;
  is_starred: boolean;
  processing_status: BookmarkRecord['processingStatus'];
  processing_error: string | null;
  user_edited_mask: string[];
  ai_suggestion: null | {
    status: BookmarkAiStatus;
    run_id: string;
    proposed_primary_category_id: string | null;
    proposed_description: string | null;
    proposed_tags: string[];
    last_error: string | null;
    generated_at: string | null;
    updated_at: string;
  };
  tags: RemoteTagDto[];
  collection_ids: string[];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

interface RemoteCategoryDto {
  id: string;
  name: string;
  slug: string | null;
  parent_id: string | null;
  sort_order: number;
  is_system: boolean;
  bookmark_count?: number;
  created_at: string;
  updated_at: string;
  children?: RemoteCategoryDto[];
}

interface RemoteCollectionDto {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  bookmark_count?: number;
  created_at: string;
  updated_at: string;
}

function mapTag(dto: RemoteTagDto): TagRecord {
  return {
    id: dto.id,
    label: dto.label,
    color: dto.color,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function mapCategory(dto: RemoteCategoryDto): CategoryTreeNode {
  return {
    id: dto.id,
    name: dto.name,
    slug: dto.slug,
    parentId: dto.parent_id,
    sortOrder: dto.sort_order,
    isSystem: dto.is_system,
    bookmarkCount: dto.bookmark_count ?? 0,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    children: (dto.children ?? []).map(mapCategory),
  };
}

function mapCollection(dto: RemoteCollectionDto): CollectionRecord {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    sortOrder: dto.sort_order,
    bookmarkCount: dto.bookmark_count ?? 0,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

function mapBookmark(dto: RemoteBookmarkDto): BookmarkRecord {
  return {
    id: dto.id,
    url: dto.url,
    normalizedUrl: dto.normalized_url,
    title: dto.title,
    description: dto.description,
    descriptionExcerpt: dto.description_excerpt,
    favicon: dto.favicon,
    coverUrl: dto.cover_url,
    primaryCategoryId: dto.primary_category_id,
    isStarred: dto.is_starred,
    processingStatus: dto.processing_status,
    processingError: dto.processing_error,
    userEditedMask: dto.user_edited_mask as BookmarkRecord['userEditedMask'],
    aiSuggestion: dto.ai_suggestion
      ? {
          status: dto.ai_suggestion.status,
          runId: dto.ai_suggestion.run_id,
          proposedPrimaryCategoryId: dto.ai_suggestion.proposed_primary_category_id,
          proposedDescription: dto.ai_suggestion.proposed_description,
          proposedTags: dto.ai_suggestion.proposed_tags,
          lastError: dto.ai_suggestion.last_error,
          generatedAt: dto.ai_suggestion.generated_at,
          updatedAt: dto.ai_suggestion.updated_at,
        }
      : null,
    tags: dto.tags.map(mapTag),
    collectionIds: dto.collection_ids,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
    deletedAt: dto.deleted_at,
  };
}

function buildBookmarkQueryParams(query?: BookmarkListQuery | BookmarkSearchQuery): string {
  const params = new URLSearchParams();
  if (!query) {
    return '';
  }

  if ('search' in query && query.search) {
    params.set('search', query.search);
  }

  if ('searchTerm' in query && query.searchTerm) {
    params.set('search', query.searchTerm);
  }

  if (query.categoryId) {
    params.set('categoryId', query.categoryId);
  }

  if (query.collectionId) {
    params.set('collectionId', query.collectionId);
  }

  if ('tagIds' in query && query.tagIds && query.tagIds.length > 0) {
    params.set('tagIds', query.tagIds.join(','));
  }

  if ('isStarred' in query && query.isStarred !== undefined) {
    params.set('isStarred', String(query.isStarred));
  }

  if ('starredOnly' in query && query.starredOnly !== undefined) {
    params.set('isStarred', String(query.starredOnly));
  }

  if ('sortBy' in query && query.sortBy) {
    params.set('sortBy', query.sortBy);
  }

  if ('sortDirection' in query && query.sortDirection) {
    params.set('sortDirection', query.sortDirection);
  }

  if ('sort' in query && query.sort) {
    params.set('sortBy', query.sort.field);
    params.set('sortDirection', query.sort.direction);
  }

  const serialized = params.toString();
  return serialized.length > 0 ? `?${serialized}` : '';
}

function throwUnsupportedAi(): never {
  throw new RemoteRequestError('Remote AI suggestions are not supported yet.', 501, 'ai_remote_not_supported_yet');
}

export class RemoteBookmarkRepository implements BookmarkRepository {
  async createBookmark(input: CreateBookmarkInput): Promise<BookmarkRecord> {
    const bookmark = await requestJson<RemoteBookmarkDto>('/api/bookmarks', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return mapBookmark(bookmark);
  }

  async updateBookmark(bookmarkId: string, patch: UpdateBookmarkPatch): Promise<BookmarkRecord> {
    const bookmark = await requestJson<RemoteBookmarkDto>(`/api/bookmarks/${bookmarkId}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    return mapBookmark(bookmark);
  }

  async deleteBookmark(bookmarkId: string): Promise<void> {
    await requestJson(`/api/bookmarks/${bookmarkId}`, {
      method: 'DELETE',
    });
  }

  async getBookmark(bookmarkId: string): Promise<BookmarkRecord | null> {
    try {
      return mapBookmark(await requestJson<RemoteBookmarkDto>(`/api/bookmarks/${bookmarkId}`));
    } catch (error) {
      if (error instanceof RemoteRequestError && error.status === 404) {
        return null;
      }

      throw error;
    }
  }

  async listBookmarks(query?: BookmarkListQuery): Promise<BookmarkRecord[]> {
    const bookmarks = await requestJson<RemoteBookmarkDto[]>(`/api/bookmarks${buildBookmarkQueryParams(query)}`);
    return bookmarks.map(mapBookmark);
  }

  async searchBookmarks(query: BookmarkSearchQuery): Promise<BookmarkRecord[]> {
    const bookmarks = await requestJson<RemoteBookmarkDto[]>(`/api/bookmarks${buildBookmarkQueryParams(query)}`);
    return bookmarks.map(mapBookmark);
  }

  async filterBookmarks(query: BookmarkSearchQuery): Promise<BookmarkRecord[]> {
    const bookmarks = await requestJson<RemoteBookmarkDto[]>(`/api/bookmarks${buildBookmarkQueryParams(query)}`);
    return bookmarks.map(mapBookmark);
  }

  async queueMetadataExtraction(bookmarkId: string): Promise<BookmarkRecord> {
    const bookmark = await requestJson<RemoteBookmarkDto>(`/api/bookmarks/${bookmarkId}/retry-metadata`, {
      method: 'POST',
    });
    return mapBookmark(bookmark);
  }

  async retryMetadataExtraction(bookmarkId: string): Promise<BookmarkRecord> {
    const bookmark = await requestJson<RemoteBookmarkDto>(`/api/bookmarks/${bookmarkId}/retry-metadata`, {
      method: 'POST',
    });
    return mapBookmark(bookmark);
  }

  async queueAiEnrichment(_bookmarkId: string): Promise<BookmarkRecord> {
    throwUnsupportedAi();
  }

  async retryAiEnrichment(_bookmarkId: string): Promise<BookmarkRecord> {
    throwUnsupportedAi();
  }

  async applyAiSuggestions(_bookmarkId: string, _input: ApplyAiSuggestionsInput): Promise<BookmarkRecord> {
    throwUnsupportedAi();
  }

  async listCategories(): Promise<CategoryTreeNode[]> {
    const categories = await requestJson<RemoteCategoryDto[]>('/api/categories');
    return categories.map(mapCategory);
  }

  async saveCategory(input: SaveCategoryInput): Promise<CategoryTreeNode> {
    const category = input.id
      ? await requestJson<RemoteCategoryDto>(`/api/categories/${input.id}`, {
          method: 'PATCH',
          body: JSON.stringify(input),
        })
      : await requestJson<RemoteCategoryDto>('/api/categories', {
          method: 'POST',
          body: JSON.stringify(input),
        });
    return mapCategory(category);
  }

  async deleteCategory(categoryId: string): Promise<void> {
    await requestJson(`/api/categories/${categoryId}`, {
      method: 'DELETE',
    });
  }

  async listCollections(): Promise<CollectionRecord[]> {
    const collections = await requestJson<RemoteCollectionDto[]>('/api/collections');
    return collections.map(mapCollection);
  }

  async saveCollection(input: SaveCollectionInput): Promise<CollectionRecord> {
    const collection = input.id
      ? await requestJson<RemoteCollectionDto>(`/api/collections/${input.id}`, {
          method: 'PATCH',
          body: JSON.stringify(input),
        })
      : await requestJson<RemoteCollectionDto>('/api/collections', {
          method: 'POST',
          body: JSON.stringify(input),
        });
    return mapCollection(collection);
  }

  async deleteCollection(collectionId: string): Promise<void> {
    await requestJson(`/api/collections/${collectionId}`, {
      method: 'DELETE',
    });
  }

  async replaceBookmarkTags(bookmarkId: string, tags: TagInput[]): Promise<TagRecord[]> {
    const bookmark = await this.updateBookmark(bookmarkId, { tags });
    return bookmark.tags;
  }
}

export const remoteBookmarkRepository = new RemoteBookmarkRepository();
