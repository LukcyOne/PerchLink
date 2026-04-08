import type {
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
import { invokeDesktop } from '../desktopBridge';
import { mapBookmarkDto, queueMetadataExtraction, retryMetadataExtraction } from '../metadataClient';

interface DesktopTagRecordDto {
  id: string;
  label: string;
  color: string | null;
  created_at: string;
  updated_at: string;
}

interface DesktopCategoryTreeNodeDto {
  id: string;
  name: string;
  slug: string | null;
  parent_id: string | null;
  sort_order: number;
  is_system: boolean;
  bookmark_count: number;
  created_at: string;
  updated_at: string;
  children: DesktopCategoryTreeNodeDto[];
}

interface DesktopCollectionRecordDto {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  bookmark_count: number;
  created_at: string;
  updated_at: string;
}

interface DesktopBookmarkRecordDto {
  id: string;
  url: string;
  normalized_url: string;
  title: string;
  description: string | null;
  description_excerpt: string | null;
  favicon: string | null;
  cover_url: string | null;
  primary_category_id: string | null;
  tags: DesktopTagRecordDto[];
  collection_ids: string[];
  is_starred: boolean;
  processing_status: BookmarkRecord['processingStatus'];
  processing_error: string | null;
  user_edited_mask: BookmarkRecord['userEditedMask'];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

function mapTag(tag: DesktopTagRecordDto): TagRecord {
  return {
    id: tag.id,
    label: tag.label,
    color: tag.color,
    createdAt: tag.created_at,
    updatedAt: tag.updated_at,
  };
}

function mapCategory(category: DesktopCategoryTreeNodeDto): CategoryTreeNode {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    parentId: category.parent_id,
    sortOrder: category.sort_order,
    isSystem: category.is_system,
    bookmarkCount: category.bookmark_count,
    createdAt: category.created_at,
    updatedAt: category.updated_at,
    children: category.children.map(mapCategory),
  };
}

function mapCollection(collection: DesktopCollectionRecordDto): CollectionRecord {
  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    sortOrder: collection.sort_order,
    bookmarkCount: collection.bookmark_count,
    createdAt: collection.created_at,
    updatedAt: collection.updated_at,
  };
}

function mapBookmark(bookmark: DesktopBookmarkRecordDto): BookmarkRecord {
  return {
    id: bookmark.id,
    url: bookmark.url,
    normalizedUrl: bookmark.normalized_url,
    title: bookmark.title,
    description: bookmark.description,
    descriptionExcerpt: bookmark.description_excerpt ?? bookmark.description,
    favicon: bookmark.favicon,
    coverUrl: bookmark.cover_url,
    primaryCategoryId: bookmark.primary_category_id,
    tags: bookmark.tags.map(mapTag),
    collectionIds: bookmark.collection_ids,
    isStarred: bookmark.is_starred,
    processingStatus: bookmark.processing_status,
    processingError: bookmark.processing_error,
    userEditedMask: bookmark.user_edited_mask,
    createdAt: bookmark.created_at,
    updatedAt: bookmark.updated_at,
    deletedAt: bookmark.deleted_at,
  };
}

export class DesktopBookmarkRepository implements BookmarkRepository {
  async createBookmark(input: CreateBookmarkInput): Promise<BookmarkRecord> {
    const bookmark = await invokeDesktop<DesktopBookmarkRecordDto>('desktop_create_bookmark', { input });
    return mapBookmark(bookmark);
  }

  async updateBookmark(bookmarkId: string, patch: UpdateBookmarkPatch): Promise<BookmarkRecord> {
    const bookmark = await invokeDesktop<DesktopBookmarkRecordDto>('desktop_update_bookmark', { bookmarkId, patch });
    return mapBookmark(bookmark);
  }

  async deleteBookmark(bookmarkId: string): Promise<void> {
    await invokeDesktop('desktop_delete_bookmark', { bookmarkId });
  }

  async getBookmark(bookmarkId: string): Promise<BookmarkRecord | null> {
    const bookmark = await invokeDesktop<DesktopBookmarkRecordDto | null>('desktop_get_bookmark', { bookmarkId });
    return bookmark ? mapBookmark(bookmark) : null;
  }

  async listBookmarks(query?: BookmarkListQuery): Promise<BookmarkRecord[]> {
    const bookmarks = await invokeDesktop<DesktopBookmarkRecordDto[]>('desktop_list_bookmarks', { query });
    return bookmarks.map(mapBookmark);
  }

  async searchBookmarks(query: BookmarkSearchQuery): Promise<BookmarkRecord[]> {
    const bookmarks = await invokeDesktop<DesktopBookmarkRecordDto[]>('desktop_search_bookmarks', { query });
    return bookmarks.map(mapBookmark);
  }

  async filterBookmarks(query: BookmarkSearchQuery): Promise<BookmarkRecord[]> {
    const bookmarks = await invokeDesktop<DesktopBookmarkRecordDto[]>('desktop_filter_bookmarks', { query });
    return bookmarks.map(mapBookmark);
  }

  async queueMetadataExtraction(bookmarkId: string): Promise<BookmarkRecord> {
    return queueMetadataExtraction(bookmarkId);
  }

  async retryMetadataExtraction(bookmarkId: string): Promise<BookmarkRecord> {
    return retryMetadataExtraction(bookmarkId);
  }

  async listCategories(): Promise<CategoryTreeNode[]> {
    const categories = await invokeDesktop<DesktopCategoryTreeNodeDto[]>('desktop_list_categories');
    return categories.map(mapCategory);
  }

  async saveCategory(input: SaveCategoryInput): Promise<CategoryTreeNode> {
    const category = await invokeDesktop<DesktopCategoryTreeNodeDto>('desktop_save_category', { input });
    return mapCategory(category);
  }

  async deleteCategory(categoryId: string): Promise<void> {
    await invokeDesktop('desktop_delete_category', { categoryId });
  }

  async listCollections(): Promise<CollectionRecord[]> {
    const collections = await invokeDesktop<DesktopCollectionRecordDto[]>('desktop_list_collections');
    return collections.map(mapCollection);
  }

  async saveCollection(input: SaveCollectionInput): Promise<CollectionRecord> {
    const collection = await invokeDesktop<DesktopCollectionRecordDto>('desktop_save_collection', { input });
    return mapCollection(collection);
  }

  async deleteCollection(collectionId: string): Promise<void> {
    await invokeDesktop('desktop_delete_collection', { collectionId });
  }

  async replaceBookmarkTags(bookmarkId: string, tags: TagInput[]): Promise<TagRecord[]> {
    const tagRecords = await invokeDesktop<DesktopTagRecordDto[]>('desktop_replace_bookmark_tags', { bookmarkId, tags });
    return tagRecords.map(mapTag);
  }
}

export const desktopBookmarkRepository = new DesktopBookmarkRepository();
