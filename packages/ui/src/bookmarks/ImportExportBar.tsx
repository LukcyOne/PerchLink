interface ImportExportBarProps {
  isBusy?: boolean;
  onImport: () => Promise<void>;
  onExportJson: () => Promise<void>;
  onExportHtml: () => Promise<void>;
}

export function ImportExportBar({ isBusy = false, onImport, onExportJson, onExportHtml }: ImportExportBarProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', flexWrap: 'wrap' }}>
      <button type="button" onClick={() => void onImport()} disabled={isBusy} style={buttonStyle}>
        Import Browser Bookmarks
      </button>
      <button type="button" onClick={() => void onExportJson()} disabled={isBusy} style={buttonStyle}>
        Export JSON
      </button>
      <button type="button" onClick={() => void onExportHtml()} disabled={isBusy} style={buttonStyle}>
        Export HTML
      </button>
    </div>
  );
}

const buttonStyle = {
  borderRadius: '999px',
  border: '1px solid var(--color-border-subtle)',
  background: 'transparent',
  padding: '10px 14px',
  cursor: 'pointer',
} as const;
