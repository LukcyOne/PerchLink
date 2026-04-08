import { useEffect } from 'react';
import { Routes, Route, MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { getShellNavigationItem, shellNavigation, type TagRecord, type NavItemId } from '@perchlink/core';
import { i18nInstance, useLocale } from '@perchlink/i18n';
import { useBookmarksStore } from '@perchlink/store';
import { AppShell, BookmarkViewToggle, SearchToolbar } from '@perchlink/ui';
import { desktopBookmarkRepository } from '../lib/repositories/desktopBookmarkRepository';
import { AllBookmarksPage } from '../pages/AllBookmarksPage';
import { CategoriesPage } from '../pages/CategoriesPage';
import { CollectionsPage } from '../pages/CollectionsPage';
import { RecentBookmarksPage } from '../pages/RecentBookmarksPage';
import { StarredBookmarksPage } from '../pages/StarredBookmarksPage';

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
      return 'settings';
    default:
      return 'all-bookmarks';
  }
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
  const activeNavId = resolveActiveNavId(location.pathname);
  const activeNavigationItem = getShellNavigationItem(activeNavId);
  const availableTags = collectAvailableTags(bookmarks);

  useEffect(() => {
    configureRepository(desktopBookmarkRepository);
  }, [configureRepository]);

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
        activeNavId === 'settings' ? undefined : (
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
        )
      }
    >
      <Routes>
        <Route path="/" element={<AllBookmarksPage />} />
        <Route path="/starred" element={<StarredBookmarksPage />} />
        <Route path="/recent" element={<RecentBookmarksPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route
          path="/settings"
          element={
            <section>
              <h2 style={{ marginTop: 0 }}>Settings</h2>
              <p style={{ color: 'var(--color-text-muted)' }}>
                Phase 2 keeps settings lightweight while bookmark management lives in the main workspace.
              </p>
            </section>
          }
        />
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
