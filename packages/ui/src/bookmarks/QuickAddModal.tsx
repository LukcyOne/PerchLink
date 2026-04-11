import { useEffect, useState } from 'react';

interface QuickAddModalProps {
  isOpen: boolean;
  isSubmitting?: boolean;
  errorMessage?: string | null;
  titleText?: string;
  helperText?: string;
  placeholder?: string;
  submitLabel?: string;
  cancelLabel?: string;
  invalidUrlMessage?: string;
  onClose: () => void;
  onSubmit: (url: string) => Promise<void>;
}

function isValidUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function QuickAddModal({
  isOpen,
  isSubmitting = false,
  errorMessage,
  titleText = 'Add Link',
  helperText = 'The link is saved locally first, then the app continues extracting title, cover, and description.',
  placeholder = 'https://example.com',
  submitLabel = 'Add Bookmark',
  cancelLabel = 'Cancel',
  invalidUrlMessage = 'Please enter a valid http or https URL.',
  onClose,
  onSubmit,
}: QuickAddModalProps) {
  const [url, setUrl] = useState('');
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setUrl('');
      setValidationMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleSubmit = async () => {
    if (!isValidUrl(url)) {
      setValidationMessage(invalidUrlMessage);
      return;
    }

    setValidationMessage(null);
    await onSubmit(url.trim());
  };

  return (
    <div
      role="presentation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(31, 42, 36, 0.35)',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--space-xl)',
        zIndex: 40,
      }}
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-add-title"
        style={{
          width: 'min(560px, 100%)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border-subtle)',
          padding: 'var(--space-xl)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-lg)',
          boxShadow: '0 18px 36px rgba(31, 42, 36, 0.18)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-md)' }}>
          <div>
            <h2 id="quick-add-title" style={{ margin: 0, fontSize: 'var(--type-display)' }}>
              {titleText}
            </h2>
            <p style={{ margin: 'var(--space-sm) 0 0', color: 'var(--color-text-muted)' }}>
              {helperText}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', fontSize: 'var(--type-heading)', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <span style={{ fontSize: 'var(--type-label)', fontWeight: 'var(--weight-semibold)' }}>URL</span>
          <input
            autoFocus
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={placeholder}
            style={{
              width: '100%',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
              padding: '14px 16px',
              fontSize: 'var(--type-body)',
            }}
          />
        </label>
        {validationMessage ? <div style={{ color: 'var(--color-destructive)' }}>{validationMessage}</div> : null}
        {errorMessage ? <div style={{ color: 'var(--color-destructive)' }}>{errorMessage}</div> : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-md)' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
              background: 'transparent',
              padding: '12px 16px',
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isSubmitting}
            style={{
              borderRadius: 'var(--radius-md)',
              border: 'none',
              background: 'var(--color-accent)',
              color: '#FFFFFF',
              padding: '12px 18px',
              fontWeight: 'var(--weight-semibold)',
              cursor: 'pointer',
            }}
          >
            {isSubmitting ? 'Saving...' : submitLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
