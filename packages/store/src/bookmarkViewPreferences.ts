export const BOOKMARK_VIEW_STORAGE_KEY = 'perchlink.bookmarks.view';
export const BOOKMARK_VIEW_MODES = ['grid', 'list'] as const;
export type BookmarkViewMode = (typeof BOOKMARK_VIEW_MODES)[number];
export const DEFAULT_BOOKMARK_VIEW: BookmarkViewMode = 'grid';

function isBookmarkViewMode(value: string): value is BookmarkViewMode {
  return BOOKMARK_VIEW_MODES.includes(value as BookmarkViewMode);
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage;
}

export function getStoredBookmarkView(): BookmarkViewMode {
  const storage = getStorage();

  if (!storage) {
    return DEFAULT_BOOKMARK_VIEW;
  }

  const value = storage.getItem(BOOKMARK_VIEW_STORAGE_KEY);
  return value && isBookmarkViewMode(value) ? value : DEFAULT_BOOKMARK_VIEW;
}

export function setStoredBookmarkView(view: BookmarkViewMode) {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  storage.setItem(BOOKMARK_VIEW_STORAGE_KEY, view);
}
