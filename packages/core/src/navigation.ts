export type NavItemId =
  | 'all-bookmarks'
  | 'starred'
  | 'recent'
  | 'collections'
  | 'categories'
  | 'settings';

export interface ShellNavigationItem {
  id: NavItemId;
  labelKey:
    | 'nav.allBookmarks'
    | 'nav.starred'
    | 'nav.recent'
    | 'nav.collections'
    | 'nav.categories'
    | 'nav.settings';
  href: string;
  icon: string;
}

export const shellNavigation: ShellNavigationItem[] = [
  {
    id: 'all-bookmarks',
    labelKey: 'nav.allBookmarks',
    href: '/',
    icon: 'squares-four',
  },
  {
    id: 'starred',
    labelKey: 'nav.starred',
    href: '/starred',
    icon: 'star',
  },
  {
    id: 'recent',
    labelKey: 'nav.recent',
    href: '/recent',
    icon: 'clock',
  },
  {
    id: 'collections',
    labelKey: 'nav.collections',
    href: '/collections',
    icon: 'folder',
  },
  {
    id: 'categories',
    labelKey: 'nav.categories',
    href: '/categories',
    icon: 'hash',
  },
  {
    id: 'settings',
    labelKey: 'nav.settings',
    href: '/settings',
    icon: 'gear',
  },
];

export function getShellNavigationItem(id: NavItemId): ShellNavigationItem | undefined {
  return shellNavigation.find((item) => item.id === id);
}
