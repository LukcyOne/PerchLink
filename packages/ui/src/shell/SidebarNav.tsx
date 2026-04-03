import type { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import type { NavItemId, ShellNavigationItem } from '@perchlink/core';

interface SidebarNavProps {
  items: ShellNavigationItem[];
  activeId: NavItemId;
  renderLabel?: (labelKey: ShellNavigationItem['labelKey']) => string;
}

const railStyle: CSSProperties = {
  width: '272px',
  minWidth: '272px',
  background: 'var(--color-secondary)',
  padding: 'var(--space-xl) var(--space-md)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-lg)',
  borderRight: '1px solid var(--color-border-subtle)',
};

export function SidebarNav({ items, activeId, renderLabel }: SidebarNavProps) {
  const { t } = useTranslation();

  return (
    <aside style={railStyle}>
      <div style={{ fontSize: 'var(--type-display)', fontWeight: 'var(--weight-semibold)' }}>PerchLink</div>
      <nav aria-label="Primary navigation" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
        {items.map((item) => {
          const isActive = item.id === activeId;
          const label = renderLabel ? renderLabel(item.labelKey) : t(item.labelKey);

          return (
            <a
              key={item.id}
              href={item.href}
              data-nav-id={item.id}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                textDecoration: 'none',
                color: isActive ? '#FFFFFF' : 'var(--color-text-primary)',
                background: isActive ? 'var(--color-accent)' : 'transparent',
                fontSize: 'var(--type-label)',
                fontWeight: 'var(--weight-semibold)',
              }}
            >
              {label}
            </a>
          );
        })}
      </nav>
    </aside>
  );
}
