import type {
  ApplyAiSuggestionsInput,
  BookmarkListQuery,
  BookmarkProcessingStatus,
  BookmarkRecord,
  CategoryTreeNode,
  CollectionRecord,
  CreateBookmarkInput,
  SaveCategoryInput,
  SaveCollectionInput,
  TagInput,
  TagRecord,
  UpdateBookmarkPatch,
} from './bookmarks';
import type {
  AiExecutionMode,
  AiExecutionPreferences,
  AiProviderProfileRecord,
  SaveAiExecutionPreferencesInput,
  SaveAiProviderProfileInput,
} from './aiChannels';
import type { BookmarkSearchQuery } from './bookmarkSearch';

export interface BookmarkRepository {
  createBookmark(input: CreateBookmarkInput): Promise<BookmarkRecord>;
  updateBookmark(bookmarkId: string, patch: UpdateBookmarkPatch): Promise<BookmarkRecord>;
  deleteBookmark(bookmarkId: string): Promise<void>;
  getBookmark(bookmarkId: string): Promise<BookmarkRecord | null>;
  listBookmarks(query?: BookmarkListQuery): Promise<BookmarkRecord[]>;
  searchBookmarks(query: BookmarkSearchQuery): Promise<BookmarkRecord[]>;
  filterBookmarks(query: BookmarkSearchQuery): Promise<BookmarkRecord[]>;
  queueMetadataExtraction(bookmarkId: string): Promise<BookmarkRecord>;
  retryMetadataExtraction(bookmarkId: string): Promise<BookmarkRecord>;
  queueAiEnrichment(bookmarkId: string): Promise<BookmarkRecord>;
  retryAiEnrichment(bookmarkId: string): Promise<BookmarkRecord>;
  applyAiSuggestions(bookmarkId: string, input: ApplyAiSuggestionsInput): Promise<BookmarkRecord>;
  listCategories(): Promise<CategoryTreeNode[]>;
  saveCategory(input: SaveCategoryInput): Promise<CategoryTreeNode>;
  deleteCategory(categoryId: string): Promise<void>;
  listCollections(): Promise<CollectionRecord[]>;
  saveCollection(input: SaveCollectionInput): Promise<CollectionRecord>;
  deleteCollection(collectionId: string): Promise<void>;
  replaceBookmarkTags(bookmarkId: string, tags: TagInput[]): Promise<TagRecord[]>;
}

export interface AiSettingsRepository {
  listAiProviderProfiles(): Promise<AiProviderProfileRecord[]>;
  saveAiProviderProfile(input: SaveAiProviderProfileInput): Promise<AiProviderProfileRecord>;
  deleteAiProviderProfile(profileId: string): Promise<void>;
  setAiProviderSecret(profileId: string, secret: string): Promise<void>;
  clearAiProviderSecret(profileId: string): Promise<void>;
  getAiExecutionPreferences(): Promise<AiExecutionPreferences>;
  saveAiExecutionPreferences(input: SaveAiExecutionPreferencesInput): Promise<AiExecutionPreferences>;
  hasReadyProfileForMode?(mode: AiExecutionMode): Promise<boolean>;
}
