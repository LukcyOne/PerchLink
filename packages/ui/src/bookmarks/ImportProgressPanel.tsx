interface ImportProgressPanelProps {
  successCount: number;
  failedCount: number;
  skippedCount: number;
  processingCount?: number;
}

export function ImportProgressPanel({ successCount, failedCount, skippedCount, processingCount = 0 }: ImportProgressPanelProps) {
  if (successCount === 0 && failedCount === 0 && skippedCount === 0 && processingCount === 0) {
    return null;
  }

  return (
    <section
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--space-md)',
        padding: 'var(--space-md) var(--space-lg)',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(47, 107, 98, 0.08)',
        color: 'var(--color-text-primary)',
      }}
    >
      <strong>Import Progress</strong>
      <span>successCount: {successCount}</span>
      <span>failedCount: {failedCount}</span>
      <span>skippedCount: {skippedCount}</span>
      <span>pending/processing: {processingCount}</span>
    </section>
  );
}
