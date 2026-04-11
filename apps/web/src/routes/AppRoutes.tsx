import { useEffect, useMemo, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { getShellNavigationItem, shellNavigation, type NavItemId, type TagRecord } from '@perchlink/core';
import { i18nInstance, useLocale } from '@perchlink/i18n';
import { useBookmarksStore } from '@perchlink/store';
import { AppShell, BookmarkViewToggle, SearchToolbar } from '@perchlink/ui';
import { RemoteRequestError } from '../lib/httpClient';
import { getCurrentSession, getSetupStatus, runInitialSetup, signInRemoteSession, signOutRemoteSession, type RemoteSessionAccount } from '../lib/sessionClient';
import { remoteBookmarkRepository } from '../lib/repositories/remoteBookmarkRepository';
import { AllBookmarksPage, buildBrowseQuery } from '../pages/AllBookmarksPage';
import { CategoriesPage } from '../pages/CategoriesPage';
import { CollectionsPage } from '../pages/CollectionsPage';
import { RecentBookmarksPage } from '../pages/RecentBookmarksPage';
import { SetupPage } from '../pages/SetupPage';
import { SignInPage } from '../pages/SignInPage';
import { StarredBookmarksPage } from '../pages/StarredBookmarksPage';
import { RequireSession } from './RequireSession';

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

function AuthenticatedShell({
  authNotice,
  onClearNotice,
  onSignOut,
}: {
  authNotice: string | null;
  onClearNotice: () => void;
  onSignOut: () => Promise<void>;
}) {
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
    lastLoadedQuery,
    configureRepository,
    hydrateReferenceData,
    loadBookmarks,
    openQuickAdd,
    setActiveFilters,
    setActiveView,
    setSearchTerm,
  } = useBookmarksStore();
  const activeNavId = resolveActiveNavId(location.pathname);
  const activeNavigationItem = getShellNavigationItem(activeNavId);
  const availableTags = collectAvailableTags(bookmarks);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);

  useEffect(() => {
    configureRepository(remoteBookmarkRepository);
  }, [configureRepository]);

  const activeBrowseQuery = useMemo(() => {
    if (lastLoadedQuery) {
      return lastLoadedQuery;
    }

    if (location.pathname === '/starred') {
      return buildBrowseQuery('starred');
    }

    if (location.pathname === '/recent') {
      return buildBrowseQuery('recent');
    }

    return buildBrowseQuery('all');
  }, [lastLoadedQuery, location.pathname]);

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
      sidebarBreakpoint={1200}
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
            <button
              type="button"
              disabled={isRefreshing}
              onClick={() =>
                void (async () => {
                  setIsRefreshing(true);
                  await Promise.all([hydrateReferenceData(), loadBookmarks(activeBrowseQuery)]);
                  setRefreshNote(i18nInstance.t('remote.refreshSuccess', { lng: locale }));
                  setIsRefreshing(false);
                })()
              }
              style={utilityButtonStyle}
            >
              {i18nInstance.t('remote.refreshAction', { lng: locale })}
            </button>
            <button type="button" onClick={() => void onSignOut()} style={utilityButtonStyle}>
              Sign out
            </button>
          </SearchToolbar>
        )
      }
    >
      {authNotice ? (
        <div style={noticeStyle}>
          <span>{authNotice}</span>
          <button type="button" onClick={onClearNotice} style={dismissButtonStyle}>
            Close
          </button>
        </div>
      ) : null}
      {refreshNote ? <div style={{ marginBottom: 'var(--space-lg)', color: 'var(--color-accent)' }}>{refreshNote}</div> : null}
      <Outlet />
    </AppShell>
  );
}

export function AppRoutes() {
  const navigate = useNavigate();
  const location = useLocation();
  const { locale } = useLocale();
  const [session, setSession] = useState<RemoteSessionAccount | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [showSetupLink, setShowSetupLink] = useState(false);
  const [isSetupClosed, setIsSetupClosed] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  useEffect(() => {
    const loadInitialSession = async () => {
      setIsSessionLoading(true);

      try {
        const current = await getCurrentSession();
        setSession(current.account);
        setShowSetupLink(current.setupOpen);
        setIsSetupClosed(!current.setupOpen);
      } catch (error) {
        if (error instanceof RemoteRequestError) {
          setSession(null);
          setShowSetupLink(error.setupOpen);
          setIsSetupClosed(!error.setupOpen);
        }
      } finally {
        setIsSessionLoading(false);
      }
    };

    void loadInitialSession();

    const handleSessionExpired = () => {
      void (async () => {
        setSession(null);
        setAuthNotice(i18nInstance.t('remote.sessionExpired', { lng: locale }));
        try {
          const { setupOpen } = await getSetupStatus();
          setShowSetupLink(setupOpen);
          setIsSetupClosed(!setupOpen);
        } catch {
          setShowSetupLink(false);
          setIsSetupClosed(true);
        }
        navigate('/sign-in');
      })();
    };

    window.addEventListener('perchlink:session-expired', handleSessionExpired);
    return () => window.removeEventListener('perchlink:session-expired', handleSessionExpired);
  }, [locale, navigate]);

  useEffect(() => {
    if (session && (location.pathname === '/sign-in' || location.pathname === '/setup')) {
      navigate('/');
    }
  }, [location.pathname, navigate, session]);

  return (
    <Routes>
      <Route
        path="/sign-in"
        element={
          session ? (
            <Navigate to="/" replace />
          ) : (
            <SignInPage
              isSubmitting={isAuthSubmitting}
              errorMessage={authError}
              showSetupLink={showSetupLink}
              onSubmit={async (input) => {
                setIsAuthSubmitting(true);
                setAuthError(null);
                try {
                  const next = await signInRemoteSession(input);
                  setSession(next.account);
                  setShowSetupLink(next.setupOpen);
                  setIsSetupClosed(!next.setupOpen);
                  setAuthNotice(null);
                  navigate('/');
                } catch (error) {
                  setAuthError(error instanceof Error ? error.message : i18nInstance.t('remote.authFailure', { lng: locale }));
                } finally {
                  setIsAuthSubmitting(false);
                }
              }}
            />
          )
        }
      />
      <Route
        path="/setup"
        element={
          session ? (
            <Navigate to="/" replace />
          ) : (
            <SetupPage
              isSubmitting={isAuthSubmitting}
              errorMessage={authError}
              isClosed={isSetupClosed}
              onSubmit={async (input) => {
                setIsAuthSubmitting(true);
                setAuthError(null);
                try {
                  const next = await runInitialSetup(input);
                  setSession(next.account);
                  setShowSetupLink(false);
                  setIsSetupClosed(true);
                  setAuthNotice(null);
                  navigate('/');
                } catch (error) {
                  if (error instanceof RemoteRequestError && error.code === 'setup_closed') {
                    setIsSetupClosed(true);
                    setShowSetupLink(false);
                  }
                  setAuthError(error instanceof Error ? error.message : i18nInstance.t('remote.setupClosed', { lng: locale }));
                } finally {
                  setIsAuthSubmitting(false);
                }
              }}
            />
          )
        }
      />

      <Route element={<RequireSession session={session} isLoading={isSessionLoading} />}>
        <Route
          element={
            <AuthenticatedShell
              authNotice={authNotice}
              onClearNotice={() => setAuthNotice(null)}
              onSignOut={async () => {
                await signOutRemoteSession();
                setSession(null);
                navigate('/sign-in');
              }}
            />
          }
        >
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
                  Phase 4 keeps settings lightweight while remote bookmark management lives in the main workspace.
                </p>
              </section>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}

const utilityButtonStyle = {
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border-subtle)',
  background: 'transparent',
  padding: '10px 14px',
  cursor: 'pointer',
} as const;

const noticeStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 'var(--space-md)',
  padding: 'var(--space-md)',
  marginBottom: 'var(--space-lg)',
  borderRadius: 'var(--radius-md)',
  background: 'rgba(183, 75, 59, 0.1)',
  color: 'var(--color-destructive)',
} as const;

const dismissButtonStyle = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
} as const;
