import type { BookmarkSortField, SortDirection } from './bookmarks';

export interface BookmarkSearchSort {
  field: BookmarkSortField;
  direction: SortDirection;
}

export interface BookmarkSearchQuery {
  searchTerm?: string;
  categoryId?: string;
  tagIds?: string[];
  collectionId?: string;
  starredOnly?: boolean;
  sort?: BookmarkSearchSort;
  limit?: number;
  offset?: number;
}
