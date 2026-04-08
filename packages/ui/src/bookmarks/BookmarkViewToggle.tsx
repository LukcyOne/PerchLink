import type { CSSProperties } from 'react';
import type { BookmarkViewMode } from '@perchlink/store';

interface BookmarkViewToggleProps {
  value: BookmarkViewMode;
  onChange: (view: BookmarkViewMode) => void;
}

const containerStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 'var(--space-xs)',
  padding: '4px',
  borderRadius: '999px',
  background: 'var(--color-secondary)',
  border: '1px solid var(--color-border-subtle)',
};

export function BookmarkViewToggle({ value, onChange }: BookmarkViewToggleProps) {
  return (
    <div aria-label="Bookmark view toggle" style={containerStyle}>
      {(['grid', 'list'] as const).map((view) => {
        const isActive = view === value;

        return (
          <button
            key={view}
            type="button"
            onClick={() => onChange(view)}
            style={{
              border: 'none',
              borderRadius: '999px',
              padding: '10px 14px',
              background: isActive ? 'var(--color-accent)' : 'transparent',
              color: isActive ? '#FFFFFF' : 'var(--color-text-primary)',
              fontSize: 'var(--type-label)',
              fontWeight: 'var(--weight-semibold)',
              cursor: 'pointer',
            }}
          >
            {view === 'grid' ? 'Grid' : 'List'}
          </button>
        );
      })}
    </div>
  );
}
