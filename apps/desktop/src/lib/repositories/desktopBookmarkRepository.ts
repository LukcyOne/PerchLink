import type {
  ApplyAiSuggestionsInput,
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
import { applyAiSuggestions, queueAiEnrichment, retryAiEnrichment } from '../aiClient';
import { mapBookmarkDto, queueMetadataExtraction, retryMetadataExtraction, type DesktopBookmarkRecordDto } from '../metadataClient';

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

export class DesktopBookmarkRepository implements BookmarkRepository {
  async createBookmark(input: CreateBookmarkInput): Promise<BookmarkRecord> {
    const bookmark = await invokeDesktop<DesktopBookmarkRecordDto>('desktop_create_bookmark', { input });
    return mapBookmarkDto(bookmark);
  }

  async updateBookmark(bookmarkId: string, patch: UpdateBookmarkPatch): Promise<BookmarkRecord> {
    const bookmark = await invokeDesktop<DesktopBookmarkRecordDto>('desktop_update_bookmark', { bookmarkId, patch });
    return mapBookmarkDto(bookmark);
  }

  async deleteBookmark(bookmarkId: string): Promise<void> {
    await invokeDesktop('desktop_delete_bookmark', { bookmarkId });
  }

  async getBookmark(bookmarkId: string): Promise<BookmarkRecord | null> {
    const bookmark = await invokeDesktop<DesktopBookmarkRecordDto | null>('desktop_get_bookmark', { bookmarkId });
    return bookmark ? mapBookmarkDto(bookmark) : null;
  }

  async listBookmarks(query?: BookmarkListQuery): Promise<BookmarkRecord[]> {
    const bookmarks = await invokeDesktop<DesktopBookmarkRecordDto[]>('desktop_list_bookmarks', { query });
    return bookmarks.map(mapBookmarkDto);
  }

  async searchBookmarks(query: BookmarkSearchQuery): Promise<BookmarkRecord[]> {
    const bookmarks = await invokeDesktop<DesktopBookmarkRecordDto[]>('desktop_search_bookmarks', { query });
    return bookmarks.map(mapBookmarkDto);
  }

  async filterBookmarks(query: BookmarkSearchQuery): Promise<BookmarkRecord[]> {
    const bookmarks = await invokeDesktop<DesktopBookmarkRecordDto[]>('desktop_filter_bookmarks', { query });
    return bookmarks.map(mapBookmarkDto);
  }

  async queueMetadataExtraction(bookmarkId: string): Promise<BookmarkRecord> {
    return queueMetadataExtraction(bookmarkId);
  }

  async retryMetadataExtraction(bookmarkId: string): Promise<BookmarkRecord> {
    return retryMetadataExtraction(bookmarkId);
  }

  async queueAiEnrichment(bookmarkId: string): Promise<BookmarkRecord> {
    return queueAiEnrichment(bookmarkId);
  }

  async retryAiEnrichment(bookmarkId: string): Promise<BookmarkRecord> {
    return retryAiEnrichment(bookmarkId);
  }

  async applyAiSuggestions(bookmarkId: string, input: ApplyAiSuggestionsInput): Promise<BookmarkRecord> {
    return applyAiSuggestions(bookmarkId, input);
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
