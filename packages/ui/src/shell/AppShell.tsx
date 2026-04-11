import { useEffect, useState, type ReactNode } from 'react';
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
  sidebarBreakpoint?: number;
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
  sidebarBreakpoint,
}: AppShellProps) {
  const [isCompactSidebar, setIsCompactSidebar] = useState(() =>
    typeof window !== 'undefined' && sidebarBreakpoint ? window.innerWidth < sidebarBreakpoint : false,
  );
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!sidebarBreakpoint || typeof window === 'undefined') {
      return;
    }

    const handleResize = () => {
      const compact = window.innerWidth < sidebarBreakpoint;
      setIsCompactSidebar(compact);
      if (!compact) {
        setIsSidebarOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarBreakpoint]);

  const sidebar = (
    <SidebarNav
      items={navigationItems}
      activeId={activeNavId}
      onNavigate={(href) => {
        onNavigate?.(href);
        setIsSidebarOpen(false);
      }}
      renderLabel={resolveNavLabel}
    />
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        display: isCompactSidebar ? 'block' : 'grid',
        gridTemplateColumns: isCompactSidebar ? undefined : '272px minmax(0, 1fr)',
        background: 'var(--color-dominant)',
        color: 'var(--color-text-primary)',
      }}
    >
      {!isCompactSidebar ? sidebar : null}
      {isCompactSidebar && isSidebarOpen ? (
        <div
          role="presentation"
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(31, 42, 36, 0.36)',
            zIndex: 50,
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              position: 'fixed',
              inset: '0 auto 0 0',
              zIndex: 51,
            }}
          >
            {sidebar}
          </div>
        </div>
      ) : null}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar
          title={pageTitle}
          primaryActionLabel={primaryActionLabel}
          onPrimaryAction={onPrimaryAction}
          utilities={utilities}
          leadingControl={
            isCompactSidebar ? (
              <button
                type="button"
                onClick={() => setIsSidebarOpen((current) => !current)}
                style={{
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  background: 'transparent',
                  padding: '10px 12px',
                  cursor: 'pointer',
                  fontSize: 'var(--type-label)',
                  fontWeight: 'var(--weight-semibold)',
                }}
              >
                Menu
              </button>
            ) : undefined
          }
        />
        <section style={{ padding: 'var(--space-xl)', minWidth: 0 }}>{children}</section>
      </div>
    </div>
  );
}
