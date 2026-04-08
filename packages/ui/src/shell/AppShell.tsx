import type { ReactNode } from 'react';
import type { NavItemId, ShellNavigationItem } from '@perchlink/core';
import { SidebarNav } from './SidebarNav';
import { TopBar } from './TopBar';
import '../tokens.css';

interface AppShellProps {
  navigationItems: ShellNavigationItem[];
  activeNavId: NavItemId;
  pageTitle: string;
  primaryActionLabel: string;
  onPrimaryAction?: () => void;
  onNavigate?: (href: string) => void;
  resolveNavLabel?: (labelKey: ShellNavigationItem['labelKey']) => string;
  utilities?: ReactNode;
  children?: ReactNode;
}

export function AppShell({
  navigationItems,
  activeNavId,
  pageTitle,
  primaryActionLabel,
  onPrimaryAction,
  onNavigate,
  resolveNavLabel,
  utilities,
  children,
}: AppShellProps) {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '272px minmax(0, 1fr)',
        background: 'var(--color-dominant)',
        color: 'var(--color-text-primary)',
      }}
    >
      <SidebarNav items={navigationItems} activeId={activeNavId} onNavigate={onNavigate} renderLabel={resolveNavLabel} />
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar
          title={pageTitle}
          primaryActionLabel={primaryActionLabel}
          onPrimaryAction={onPrimaryAction}
          utilities={utilities}
        />
        <section style={{ padding: 'var(--space-xl)', minWidth: 0 }}>{children}</section>
      </div>
    </div>
  );
}
