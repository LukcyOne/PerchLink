import { create } from 'zustand';
import type {
  BookmarkListQuery,
  BookmarkProcessingStatus,
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
import { DEFAULT_BOOKMARK_VIEW, type BookmarkViewMode, getStoredBookmarkView, setStoredBookmarkView } from './bookmarkViewPreferences';

export interface BookmarkFilters {
  categoryId: string | null;
  collectionId: string | null;
  tagIds: string[];
  processingStatuses: BookmarkProcessingStatus[];
  starredOnly: boolean;
}

interface BookmarksState {
  repository: BookmarkRepository | null;
  bookmarks: BookmarkRecord[];
  categories: CategoryTreeNode[];
  collections: CollectionRecord[];
  activeView: BookmarkViewMode;
  selectedBookmarkId: string | null;
  isQuickAddOpen: boolean;
  isDetailsDrawerOpen: boolean;
  activeFilters: BookmarkFilters;
  searchTerm: string;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  lastLoadedQuery: BookmarkListQuery | undefined;
  configureRepository: (repository: BookmarkRepository) => void;
  setActiveView: (view: BookmarkViewMode) => void;
  setSelectedBookmarkId: (bookmarkId: string | null) => void;
  openQuickAdd: () => void;
  closeQuickAdd: () => void;
  openDetails: (bookmarkId: string) => void;
  closeDetails: () => void;
  setSearchTerm: (searchTerm: string) => void;
  setActiveFilters: (filters: Partial<BookmarkFilters>) => void;
  resetActiveFilters: () => void;
  hydrateReferenceData: () => Promise<void>;
  loadBookmarks: (queryOverrides?: BookmarkListQuery) => Promise<BookmarkRecord[]>;
  queueMetadataExtraction: (bookmarkId: string) => Promise<BookmarkRecord>;
  retryMetadataExtraction: (bookmarkId: string) => Promise<BookmarkRecord>;
  createBookmark: (input: CreateBookmarkInput) => Promise<BookmarkRecord>;
  updateBookmark: (bookmarkId: string, patch: UpdateBookmarkPatch) => Promise<BookmarkRecord>;
  deleteBookmark: (bookmarkId: string) => Promise<void>;
  saveCategory: (input: SaveCategoryInput) => Promise<CategoryTreeNode>;
  deleteCategory: (categoryId: string) => Promise<void>;
  saveCollection: (input: SaveCollectionInput) => Promise<CollectionRecord>;
  deleteCollection: (collectionId: string) => Promise<void>;
  replaceBookmarkTags: (bookmarkId: string, tags: TagInput[]) => Promise<TagRecord[]>;
}

const DEFAULT_FILTERS: BookmarkFilters = {
  categoryId: null,
  collectionId: null,
  tagIds: [],
  processingStatuses: [],
  starredOnly: false,
};

function getRepository(repository: BookmarkRepository | null): BookmarkRepository {
  if (!repository) {
    throw new Error('Bookmark repository has not been configured for the desktop store.');
  }

  return repository;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown bookmark store error.';
}

function mergeBookmark(bookmarks: BookmarkRecord[], nextBookmark: BookmarkRecord): BookmarkRecord[] {
  const existingIndex = bookmarks.findIndex((bookmark) => bookmark.id === nextBookmark.id);

  if (existingIndex === -1) {
    return [nextBookmark, ...bookmarks];
  }

  const nextBookmarks = [...bookmarks];
  nextBookmarks.splice(existingIndex, 1, nextBookmark);
  return nextBookmarks;
}

function buildBookmarkListQuery(state: BookmarksState, queryOverrides?: BookmarkListQuery): BookmarkListQuery {
  return {
    search: state.searchTerm.trim() || undefined,
    categoryId: queryOverrides?.categoryId ?? state.activeFilters.categoryId ?? undefined,
    collectionId: queryOverrides?.collectionId ?? state.activeFilters.collectionId ?? undefined,
    tagIds: queryOverrides?.tagIds ?? (state.activeFilters.tagIds.length > 0 ? state.activeFilters.tagIds : undefined),
    processingStatuses:
      queryOverrides?.processingStatuses ??
      (state.activeFilters.processingStatuses.length > 0 ? state.activeFilters.processingStatuses : undefined),
    isStarred: queryOverrides?.isStarred ?? (state.activeFilters.starredOnly ? true : undefined),
    sortBy: queryOverrides?.sortBy ?? 'updatedAt',
    sortDirection: queryOverrides?.sortDirection ?? 'desc',
    limit: queryOverrides?.limit,
    offset: queryOverrides?.offset,
  };
}

function buildSearchQuery(state: BookmarksState, queryOverrides?: BookmarkListQuery): BookmarkSearchQuery {
  return {
    searchTerm: state.searchTerm.trim() || undefined,
    categoryId: queryOverrides?.categoryId ?? state.activeFilters.categoryId ?? undefined,
    collectionId: queryOverrides?.collectionId ?? state.activeFilters.collectionId ?? undefined,
    tagIds: queryOverrides?.tagIds ?? (state.activeFilters.tagIds.length > 0 ? state.activeFilters.tagIds : undefined),
    starredOnly: queryOverrides?.isStarred ?? (state.activeFilters.starredOnly ? true : undefined),
    sort: {
      field: queryOverrides?.sortBy ?? 'updatedAt',
      direction: queryOverrides?.sortDirection ?? 'desc',
    },
    limit: queryOverrides?.limit,
    offset: queryOverrides?.offset,
  };
}

function hasStructuredFilters(query: BookmarkSearchQuery): boolean {
  return Boolean(query.categoryId || query.collectionId || (query.tagIds && query.tagIds.length > 0) || query.starredOnly);
}

export const useBookmarksStore = create<BookmarksState>((set, get) => ({
  repository: null,
  bookmarks: [],
  categories: [],
  collections: [],
  activeView: typeof window === 'undefined' ? DEFAULT_BOOKMARK_VIEW : getStoredBookmarkView(),
  selectedBookmarkId: null,
  isQuickAddOpen: false,
  isDetailsDrawerOpen: false,
  activeFilters: DEFAULT_FILTERS,
  searchTerm: '',
  isLoading: false,
  isSaving: false,
  error: null,
  lastLoadedQuery: undefined,
  configureRepository: (repository) => set({ repository }),
  setActiveView: (view) => {
    setStoredBookmarkView(view);
    set({ activeView: view });
  },
  setSelectedBookmarkId: (selectedBookmarkId) => set({ selectedBookmarkId }),
  openQuickAdd: () => set({ isQuickAddOpen: true, error: null }),
  closeQuickAdd: () => set({ isQuickAddOpen: false }),
  openDetails: (selectedBookmarkId) => set({ selectedBookmarkId, isDetailsDrawerOpen: true, error: null }),
  closeDetails: () => set({ isDetailsDrawerOpen: false }),
  setSearchTerm: (searchTerm) => set({ searchTerm }),
  setActiveFilters: (filters) =>
    set((state) => ({
      activeFilters: {
        ...state.activeFilters,
        ...filters,
        tagIds: filters.tagIds ?? state.activeFilters.tagIds,
        processingStatuses: filters.processingStatuses ?? state.activeFilters.processingStatuses,
        starredOnly: filters.starredOnly ?? state.activeFilters.starredOnly,
      },
    })),
  resetActiveFilters: () => set({ activeFilters: DEFAULT_FILTERS }),
  hydrateReferenceData: async () => {
    const repository = getRepository(get().repository);

    try {
      const [categories, collections] = await Promise.all([repository.listCategories(), repository.listCollections()]);
      set({ categories, collections, error: null });
    } catch (error) {
      set({ error: toErrorMessage(error) });
      throw error;
    }
  },
  loadBookmarks: async (queryOverrides) => {
    const state = get();
    const repository = getRepository(state.repository);
    const listQuery = buildBookmarkListQuery(state, queryOverrides);
    const searchQuery = buildSearchQuery(state, queryOverrides);

    set({ isLoading: true, error: null, lastLoadedQuery: listQuery });

    try {
      const bookmarks = searchQuery.searchTerm
        ? await repository.searchBookmarks(searchQuery)
        : hasStructuredFilters(searchQuery) && !(listQuery.processingStatuses && listQuery.processingStatuses.length > 0)
          ? await repository.filterBookmarks(searchQuery)
          : await repository.listBookmarks(listQuery);
      set({ bookmarks, isLoading: false, error: null });
      return bookmarks;
    } catch (error) {
      set({ isLoading: false, error: toErrorMessage(error) });
      throw error;
    }
  },
  queueMetadataExtraction: async (bookmarkId) => {
    const repository = getRepository(get().repository);
    // Merge processing_status / processing_error updates returned from the desktop metadata queue.
    const bookmark = await repository.queueMetadataExtraction(bookmarkId);
    set((state) => ({ bookmarks: mergeBookmark(state.bookmarks, bookmark) }));
    return bookmark;
  },
  retryMetadataExtraction: async (bookmarkId) => {
    const repository = getRepository(get().repository);
    // Merge processing_status / processing_error updates returned from the desktop metadata retry path.
    const bookmark = await repository.retryMetadataExtraction(bookmarkId);
    set((state) => ({ bookmarks: mergeBookmark(state.bookmarks, bookmark) }));
    return bookmark;
  },
  createBookmark: async (input) => {
    const repository = getRepository(get().repository);
    set({ isSaving: true, error: null });

    try {
      const bookmark = await repository.createBookmark({ primaryCategoryId: 'system-unsorted', processingStatus: 'processing', ...input });
      set((state) => ({
        bookmarks: mergeBookmark(state.bookmarks, bookmark),
        isSaving: false,
        isQuickAddOpen: false,
        selectedBookmarkId: bookmark.id,
      }));
      await get().hydrateReferenceData();
      void get().queueMetadataExtraction(bookmark.id);
      return bookmark;
    } catch (error) {
      set({ isSaving: false, error: toErrorMessage(error) });
      throw error;
    }
  },
  updateBookmark: async (bookmarkId, patch) => {
    const repository = getRepository(get().repository);
    set({ isSaving: true, error: null });

    try {
      const bookmark = await repository.updateBookmark(bookmarkId, patch);
      set((state) => ({ bookmarks: mergeBookmark(state.bookmarks, bookmark), isSaving: false }));
      await get().hydrateReferenceData();
      return bookmark;
    } catch (error) {
      set({ isSaving: false, error: toErrorMessage(error) });
      throw error;
    }
  },
  deleteBookmark: async (bookmarkId) => {
    const repository = getRepository(get().repository);
    set({ isSaving: true, error: null });

    try {
      await repository.deleteBookmark(bookmarkId);
      set((state) => ({
        bookmarks: state.bookmarks.filter((bookmark) => bookmark.id !== bookmarkId),
        selectedBookmarkId: state.selectedBookmarkId === bookmarkId ? null : state.selectedBookmarkId,
        isDetailsDrawerOpen: state.selectedBookmarkId === bookmarkId ? false : state.isDetailsDrawerOpen,
        isSaving: false,
      }));
      await get().hydrateReferenceData();
    } catch (error) {
      set({ isSaving: false, error: toErrorMessage(error) });
      throw error;
    }
  },
  saveCategory: async (input) => {
    const repository = getRepository(get().repository);
    set({ isSaving: true, error: null });

    try {
      const category = await repository.saveCategory(input);
      await get().hydrateReferenceData();
      set({ isSaving: false });
      return category;
    } catch (error) {
      set({ isSaving: false, error: toErrorMessage(error) });
      throw error;
    }
  },
  deleteCategory: async (categoryId) => {
    const repository = getRepository(get().repository);
    set({ isSaving: true, error: null });

    try {
      await repository.deleteCategory(categoryId);
      await Promise.all([get().hydrateReferenceData(), get().loadBookmarks(get().lastLoadedQuery)]);
      set((state) => ({
        isSaving: false,
        activeFilters: state.activeFilters.categoryId === categoryId ? { ...state.activeFilters, categoryId: null } : state.activeFilters,
      }));
    } catch (error) {
      set({ isSaving: false, error: toErrorMessage(error) });
      throw error;
    }
  },
  saveCollection: async (input) => {
    const repository = getRepository(get().repository);
    set({ isSaving: true, error: null });

    try {
      const collection = await repository.saveCollection(input);
      await get().hydrateReferenceData();
      set({ isSaving: false });
      return collection;
    } catch (error) {
      set({ isSaving: false, error: toErrorMessage(error) });
      throw error;
    }
  },
  deleteCollection: async (collectionId) => {
    const repository = getRepository(get().repository);
    set({ isSaving: true, error: null });

    try {
      await repository.deleteCollection(collectionId);
      await Promise.all([get().hydrateReferenceData(), get().loadBookmarks(get().lastLoadedQuery)]);
      set((state) => ({
        isSaving: false,
        activeFilters: state.activeFilters.collectionId === collectionId ? { ...state.activeFilters, collectionId: null } : state.activeFilters,
      }));
    } catch (error) {
      set({ isSaving: false, error: toErrorMessage(error) });
      throw error;
    }
  },
  replaceBookmarkTags: async (bookmarkId, tags) => {
    const repository = getRepository(get().repository);
    set({ isSaving: true, error: null });

    try {
      const tagRecords = await repository.replaceBookmarkTags(bookmarkId, tags);
      set((state) => ({
        bookmarks: state.bookmarks.map((bookmark) => (bookmark.id === bookmarkId ? { ...bookmark, tags: tagRecords } : bookmark)),
        isSaving: false,
      }));
      return tagRecords;
    } catch (error) {
      set({ isSaving: false, error: toErrorMessage(error) });
      throw error;
    }
  },
}));
