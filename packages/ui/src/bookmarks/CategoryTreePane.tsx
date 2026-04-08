import { useMemo, useState } from 'react';
import type { CategoryTreeNode, SaveCategoryInput } from '@perchlink/core';

interface CategoryTreePaneProps {
  categories: CategoryTreeNode[];
  selectedCategoryId: string | null;
  onSelect: (categoryId: string) => void;
  onCreateCategory: (input: SaveCategoryInput) => Promise<void>;
  onUpdateCategory: (input: SaveCategoryInput) => Promise<void>;
  onDeleteCategory: (categoryId: string) => Promise<void>;
}

function flattenCategories(categories: CategoryTreeNode[]): CategoryTreeNode[] {
  return categories.flatMap((category) => [category, ...flattenCategories(category.children)]);
}

export function CategoryTreePane({
  categories,
  selectedCategoryId,
  onSelect,
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
}: CategoryTreePaneProps) {
  const allCategories = useMemo(() => flattenCategories(categories), [categories]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const selectedCategory = allCategories.find((category) => category.id === selectedCategoryId) ?? allCategories[0] ?? null;
  const dragHint = 'drag handle';

  return (
    <section style={paneStyle}>
      <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--type-heading)' }}>Categories</h2>
        <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
          The system category Unsorted stays protected, and sort_order persists desktop tree order.
        </p>
      </div>
      <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
        <input
          value={newCategoryName}
          onChange={(event) => setNewCategoryName(event.target.value)}
          placeholder="Create category"
          style={inputStyle}
        />
        <button
          type="button"
          onClick={() => {
            if (!newCategoryName.trim()) {
              return;
            }

            void onCreateCategory({
              name: newCategoryName.trim(),
              parentId: selectedCategory?.id ?? null,
              sortOrder: allCategories.length + 1,
            }).then(() => setNewCategoryName(''));
          }}
          style={primaryButtonStyle}
        >
          Add category
        </button>
      </div>
      <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
        {categories.map((category) => (
          <CategoryTreeBranch
            key={category.id}
            category={category}
            depth={0}
            dragHint={dragHint}
            selectedCategoryId={selectedCategoryId}
            onSelect={onSelect}
          />
        ))}
      </div>
      {selectedCategory ? (
        <div style={{ display: 'grid', gap: 'var(--space-sm)', marginTop: 'auto' }}>
          <strong>{selectedCategory.name}</strong>
          <input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            placeholder={`Rename ${selectedCategory.name}`}
            style={inputStyle}
          />
          <label style={{ display: 'grid', gap: 'var(--space-xs)' }}>
            <span>parentId</span>
            <select
              defaultValue={selectedCategory.parentId ?? ''}
              onChange={(event) =>
                void onUpdateCategory({
                  id: selectedCategory.id,
                  name: renameValue.trim() || selectedCategory.name,
                  parentId: event.target.value || null,
                  sortOrder: selectedCategory.sortOrder,
                })
              }
              style={inputStyle}
            >
              <option value="">No parent</option>
              {allCategories
                .filter((category) => category.id !== selectedCategory.id)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </label>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button
              type="button"
              onClick={() =>
                void onUpdateCategory({
                  id: selectedCategory.id,
                  name: renameValue.trim() || selectedCategory.name,
                  parentId: selectedCategory.parentId,
                  sortOrder: selectedCategory.sortOrder,
                }).then(() => setRenameValue(''))
              }
              style={primaryButtonStyle}
            >
              Save category
            </button>
            <button
              type="button"
              onClick={() => void onDeleteCategory(selectedCategory.id)}
              disabled={selectedCategory.isSystem}
              style={{ ...secondaryButtonStyle, opacity: selectedCategory.isSystem ? 0.5 : 1 }}
            >
              {selectedCategory.isSystem ? 'Unsorted protected' : 'Delete category'}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

interface CategoryTreeBranchProps {
  category: CategoryTreeNode;
  depth: number;
  dragHint: string;
  selectedCategoryId: string | null;
  onSelect: (categoryId: string) => void;
}

function CategoryTreeBranch({ category, depth, dragHint, selectedCategoryId, onSelect }: CategoryTreeBranchProps) {
  const isSelected = category.id === selectedCategoryId;

  return (
    <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
      <button
        type="button"
        draggable={!category.isSystem}
        title={dragHint}
        data-sort-field="sort_order"
        onClick={() => onSelect(category.id)}
        style={{
          ...secondaryButtonStyle,
          justifyContent: 'space-between',
          paddingLeft: `calc(var(--space-md) + ${depth * 16}px)`,
          background: isSelected ? 'rgba(47, 107, 98, 0.12)' : 'transparent',
          borderColor: isSelected ? 'var(--color-accent)' : 'var(--color-border-subtle)',
        }}
      >
        <span>{category.name}</span>
        <span style={{ color: 'var(--color-text-muted)' }}>{category.bookmarkCount}</span>
      </button>
      {category.children.map((child) => (
        <CategoryTreeBranch
          key={child.id}
          category={child}
          depth={depth + 1}
          dragHint={dragHint}
          selectedCategoryId={selectedCategoryId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

const paneStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-lg)',
  height: '100%',
  borderRadius: 'var(--radius-lg)',
  border: '1px solid var(--color-border-subtle)',
  background: 'var(--color-surface-raised)',
  padding: 'var(--space-lg)',
} as const;

const inputStyle = {
  width: '100%',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border-subtle)',
  padding: '12px 14px',
  fontSize: 'var(--type-body)',
} as const;

const primaryButtonStyle = {
  borderRadius: 'var(--radius-md)',
  border: 'none',
  background: 'var(--color-accent)',
  color: '#FFFFFF',
  padding: '12px 16px',
  fontWeight: 'var(--weight-semibold)',
  cursor: 'pointer',
} as const;

const secondaryButtonStyle = {
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--color-border-subtle)',
  background: 'transparent',
  padding: '10px 12px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-sm)',
} as const;
