import { useEffect } from 'react';
import { Routes, Route, MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { getShellNavigationItem, shellNavigation, type TagRecord, type NavItemId } from '@perchlink/core';
import { i18nInstance, useLocale } from '@perchlink/i18n';
import { useBookmarksStore, useSyncStore } from '@perchlink/store';
import { AppShell, BookmarkViewToggle, SearchToolbar, SyncAttentionToast, SyncStatusPill } from '@perchlink/ui';
import { desktopBookmarkRepository } from '../lib/repositories/desktopBookmarkRepository';
import { desktopSyncManager } from '../lib/syncManager';
import { AllBookmarksPage } from '../pages/AllBookmarksPage';
import { CategoriesPage } from '../pages/CategoriesPage';
import { CollectionsPage } from '../pages/CollectionsPage';
import { RecentBookmarksPage } from '../pages/RecentBookmarksPage';
import { SettingsPage } from '../pages/SettingsPage';
import { StarredBookmarksPage } from '../pages/StarredBookmarksPage';
import { SyncCenterPage } from '../pages/SyncCenterPage';

function resolveActiveNavId(pathname: string): NavItemId {
  switch (pathname) {
    case '/starred':
      return 'starred';
    case '/recent':
      return 'recent';
    case '/categories':
      return 'categories';
    case '/collections':
      return 'collections';
    case '/settings':
    case '/sync-center':
      return 'settings';
    default:
      return 'all-bookmarks';
  }
}

function getSyncCenterHref(unreadConflictId: string | null): string {
  if (!unreadConflictId) {
    return '/sync-center';
  }

  return `/sync-center?tab=conflicts&conflictId=${encodeURIComponent(unreadConflictId)}`;
}

function collectAvailableTags(bookmarks: ReturnType<typeof useBookmarksStore.getState>['bookmarks']): TagRecord[] {
  const seen = new Map<string, TagRecord>();

  for (const bookmark of bookmarks) {
    for (const tag of bookmark.tags) {
      seen.set(tag.id, tag);
    }
  }

  return [...seen.values()];
}

function DesktopShellRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  const { locale } = useLocale();
  const {
    bookmarks,
    categories,
    collections,
    activeFilters,
    activeView,
    searchTerm,
    configureRepository,
    openQuickAdd,
    setActiveFilters,
    setActiveView,
    setSearchTerm,
  } = useBookmarksStore();
  const { status, conflicts, hydrate: hydrateSync } = useSyncStore();
  const activeNavId = resolveActiveNavId(location.pathname);
  const activeNavigationItem = getShellNavigationItem(activeNavId);
  const availableTags = collectAvailableTags(bookmarks);
  const latestUnreadConflict = conflicts.find((conflict) => conflict.unread) ?? null;
  const latestUnreadConflictId = latestUnreadConflict?.id ?? null;
  const syncCenterHref = getSyncCenterHref(latestUnreadConflictId);

  useEffect(() => {
    configureRepository(desktopBookmarkRepository);
  }, [configureRepository]);

  useEffect(() => {
    void desktopSyncManager.start();
  }, []);

  useEffect(() => {
    void hydrateSync();
  }, [hydrateSync]);

  useEffect(() => {
    return desktopSyncManager.subscribe(() => {
      void hydrateSync();
    });
  }, [hydrateSync]);

  const syncTone =
    status?.connectionState === 'up-to-date'
      ? 'positive'
      : status?.connectionState === 'needs-attention'
        ? 'warning'
        : 'muted';
  const syncLabel =
    status?.connectionState === 'up-to-date'
      ? i18nInstance.t('sync.statusUpToDate', { lng: locale })
      : status?.connectionState === 'syncing'
        ? i18nInstance.t('sync.statusSyncing', { lng: locale })
        : status?.connectionState === 'needs-attention'
          ? i18nInstance.t('sync.statusNeedsAttention', { lng: locale })
          : i18nInstance.t('sync.statusLocalOnly', { lng: locale });

  return (
    <AppShell
      navigationItems={shellNavigation}
      activeNavId={activeNavId}
      onNavigate={(href) => navigate(href)}
      pageTitle={
        activeNavigationItem
          ? i18nInstance.t(activeNavigationItem.labelKey, { lng: locale })
          : i18nInstance.t('nav.allBookmarks', { lng: locale })
      }
      primaryActionLabel={i18nInstance.t('shell.primaryCta', { lng: locale })}
      onPrimaryAction={openQuickAdd}
      resolveNavLabel={(labelKey) => i18nInstance.t(labelKey, { lng: locale })}
        utilities={
          <>
          <SyncStatusPill
            label={syncLabel}
            tone={syncTone}
            unreadCount={status?.unreadConflictCount ?? 0}
            onClick={() => navigate(syncCenterHref)}
          />
          {activeNavId === 'settings' ? null : (
            <SearchToolbar
              search={searchTerm}
              categories={categories}
              collections={collections}
              availableTags={availableTags}
              activeCategoryId={activeFilters.categoryId}
              activeCollectionId={activeFilters.collectionId}
              activeTagIds={activeFilters.tagIds}
              starredOnly={activeFilters.starredOnly}
              onSearchChange={setSearchTerm}
              onCategoryChange={(value) => setActiveFilters({ categoryId: value })}
              onCollectionChange={(value) => setActiveFilters({ collectionId: value })}
              onTagIdsChange={(value) => setActiveFilters({ tagIds: value })}
              onStarredChange={(value) => setActiveFilters({ starredOnly: value })}
            >
              <BookmarkViewToggle value={activeView} onChange={setActiveView} />
            </SearchToolbar>
          )}
        </>
      }
    >
      {location.pathname !== '/sync-center' ? (
        <SyncAttentionToast conflict={latestUnreadConflict} onReview={() => navigate(syncCenterHref)} />
      ) : null}
      <Routes>
        <Route path="/" element={<AllBookmarksPage />} />
        <Route path="/starred" element={<StarredBookmarksPage />} />
        <Route path="/recent" element={<RecentBookmarksPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/settings" element={<SettingsPage onOpenSyncCenter={() => navigate('/sync-center')} />} />
        <Route path="/sync-center" element={<SyncCenterPage />} />
      </Routes>
    </AppShell>
  );
}

export function AppRoutes() {
  return (
    <MemoryRouter initialEntries={['/']}>
      <DesktopShellRoutes />
    </MemoryRouter>
  );
}
