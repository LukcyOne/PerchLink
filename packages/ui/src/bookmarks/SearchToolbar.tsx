import type { ReactNode } from 'react';
import type { CategoryTreeNode, CollectionRecord, TagRecord } from '@perchlink/core';

interface SearchToolbarProps {
  search: string;
  categories: CategoryTreeNode[];
  collections: CollectionRecord[];
  availableTags: TagRecord[];
  activeCategoryId: string | null;
  activeCollectionId: string | null;
  activeTagIds: string[];
  starredOnly: boolean;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string | null) => void;
  onCollectionChange: (value: string | null) => void;
  onTagIdsChange: (value: string[]) => void;
  onStarredChange: (value: boolean) => void;
  children?: ReactNode;
}

function flattenCategories(categories: CategoryTreeNode[]): CategoryTreeNode[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children)]);
}

export function SearchToolbar({
  search,
  categories,
  collections,
  availableTags,
  activeCategoryId,
  activeCollectionId,
  activeTagIds,
  starredOnly,
  onSearchChange,
  onCategoryChange,
  onCollectionChange,
  onTagIdsChange,
  onStarredChange,
  children,
}: SearchToolbarProps) {
  const categoryOptions = flattenCategories(categories);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', flexWrap: 'wrap' }}>
      <input
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Search titles, descriptions, tags, or URLs"
        aria-label="search"
        style={{
          width: 'min(360px, 34vw)',
          borderRadius: '999px',
          border: '1px solid var(--color-border-subtle)',
          padding: '12px 16px',
          fontSize: 'var(--type-body)',
        }}
      />
      <select value={activeCategoryId ?? ''} onChange={(event) => onCategoryChange(event.target.value || null)} style={selectStyle}>
        <option value="">All category</option>
        {categoryOptions.map((category) => (
          <option key={category.id} value={category.id}>
            {category.name}
          </option>
        ))}
      </select>
      <select value={activeCollectionId ?? ''} onChange={(event) => onCollectionChange(event.target.value || null)} style={selectStyle}>
        <option value="">All collection</option>
        {collections.map((collection) => (
          <option key={collection.id} value={collection.id}>
            {collection.name}
          </option>
        ))}
      </select>
      <select
        multiple
        value={activeTagIds}
        onChange={(event) => onTagIdsChange([...event.target.selectedOptions].map((option) => option.value))}
        aria-label="tag filter"
        style={{ ...selectStyle, minWidth: '170px', minHeight: '48px' }}
      >
        {availableTags.map((tag) => (
          <option key={tag.id} value={tag.id}>
            {tag.label}
          </option>
        ))}
      </select>
      <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', fontSize: 'var(--type-label)' }}>
        <input type="checkbox" checked={starredOnly} onChange={(event) => onStarredChange(event.target.checked)} />
        starred
      </label>
      {children}
    </div>
  );
}

const selectStyle = {
  borderRadius: '999px',
  border: '1px solid var(--color-border-subtle)',
  padding: '12px 14px',
  fontSize: 'var(--type-label)',
  background: '#FFFFFF',
} as const;
