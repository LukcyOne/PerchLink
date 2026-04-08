import { useMemo, useState } from 'react';
import type { CollectionRecord, SaveCollectionInput } from '@perchlink/core';

interface CollectionListPaneProps {
  collections: CollectionRecord[];
  selectedCollectionId: string | null;
  bookmarkIds: string[];
  onSelect: (collectionId: string) => void;
  createCollection: (input: SaveCollectionInput) => Promise<void>;
  updateCollection: (input: SaveCollectionInput) => Promise<void>;
  deleteCollection: (collectionId: string) => Promise<void>;
}

export function CollectionListPane({
  collections,
  selectedCollectionId,
  bookmarkIds,
  onSelect,
  createCollection,
  updateCollection,
  deleteCollection,
}: CollectionListPaneProps) {
  const selectedCollection = useMemo(
    () => collections.find((collection) => collection.id === selectedCollectionId) ?? collections[0] ?? null,
    [collections, selectedCollectionId],
  );
  const [newCollectionName, setNewCollectionName] = useState('');
  const [renameValue, setRenameValue] = useState('');

  return (
    <section style={paneStyle}>
      <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--type-heading)' }}>Collections</h2>
        <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
          bookmarkIds currently linked to the selected collection: {bookmarkIds.length}
        </p>
      </div>
      <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
        <input
          value={newCollectionName}
          onChange={(event) => setNewCollectionName(event.target.value)}
          placeholder="Create collection"
          style={inputStyle}
        />
        <button
          type="button"
          onClick={() => {
            if (!newCollectionName.trim()) {
              return;
            }

            void createCollection({ name: newCollectionName.trim(), sortOrder: collections.length + 1 }).then(() =>
              setNewCollectionName(''),
            );
          }}
          style={primaryButtonStyle}
        >
          Add collection
        </button>
      </div>
      <div style={{ display: 'grid', gap: 'var(--space-sm)' }}>
        {collections.map((collection) => {
          const isSelected = collection.id === (selectedCollection?.id ?? selectedCollectionId);

          return (
            <button
              key={collection.id}
              type="button"
              onClick={() => onSelect(collection.id)}
              style={{
                ...secondaryButtonStyle,
                justifyContent: 'space-between',
                background: isSelected ? 'rgba(47, 107, 98, 0.12)' : 'transparent',
                borderColor: isSelected ? 'var(--color-accent)' : 'var(--color-border-subtle)',
              }}
            >
              <span>{collection.name}</span>
              <span style={{ color: 'var(--color-text-muted)' }}>{collection.bookmarkCount}</span>
            </button>
          );
        })}
      </div>
      {selectedCollection ? (
        <div style={{ display: 'grid', gap: 'var(--space-sm)', marginTop: 'auto' }}>
          <strong>{selectedCollection.name}</strong>
          <input
            value={renameValue}
            onChange={(event) => setRenameValue(event.target.value)}
            placeholder={`Rename ${selectedCollection.name}`}
            style={inputStyle}
          />
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            <button
              type="button"
              onClick={() =>
                void updateCollection({
                  id: selectedCollection.id,
                  name: renameValue.trim() || selectedCollection.name,
                  description: selectedCollection.description,
                  sortOrder: selectedCollection.sortOrder,
                }).then(() => setRenameValue(''))
              }
              style={primaryButtonStyle}
            >
              Save collection
            </button>
            <button
              type="button"
              onClick={() => void deleteCollection(selectedCollection.id)}
              style={secondaryButtonStyle}
            >
              Delete collection
            </button>
          </div>
        </div>
      ) : null}
    </section>
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
