import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface DeviceRegistrationDialogProps {
  isOpen: boolean;
  defaultValue: string;
  isBusy?: boolean;
  errorMessage?: string | null;
  onRegister: (deviceName: string) => Promise<void> | void;
  onSkip: () => Promise<void> | void;
  onClose?: () => void;
}

export function DeviceRegistrationDialog({
  isOpen,
  defaultValue,
  isBusy = false,
  errorMessage,
  onRegister,
  onSkip,
  onClose,
}: DeviceRegistrationDialogProps) {
  const { t } = useTranslation();
  const [deviceName, setDeviceName] = useState(defaultValue);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      role="presentation"
      onClick={() => void onClose?.()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(28, 35, 31, 0.42)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 100,
        padding: '24px',
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
        style={{
          width: 'min(100%, 520px)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-surface-raised)',
          border: '1px solid var(--color-border-subtle)',
          padding: 'var(--space-xl)',
          boxShadow: '0 20px 50px rgba(31, 42, 36, 0.18)',
        }}
      >
        <h2 style={{ marginTop: 0, marginBottom: 'var(--space-sm)' }}>{t('sync.registerTitle')}</h2>
        <p style={{ marginTop: 0, color: 'var(--color-text-muted)' }}>
          {t('sync.registerBody')}
        </p>
        <label style={{ display: 'grid', gap: 'var(--space-sm)' }}>
          <span style={{ fontWeight: 'var(--weight-semibold)' }}>{t('sync.registerName')}</span>
          <input
            value={deviceName}
            onChange={(event) => setDeviceName(event.target.value)}
            disabled={isBusy}
            style={{
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border-subtle)',
              padding: '12px 14px',
              fontSize: 'var(--type-body)',
            }}
          />
        </label>
        {errorMessage ? (
          <p style={{ color: 'var(--color-destructive)', marginBottom: 0 }}>{errorMessage}</p>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-md)', marginTop: 'var(--space-xl)' }}>
          <button
            type="button"
            onClick={() => void onSkip()}
            disabled={isBusy}
            style={{
              border: '1px solid var(--color-border-subtle)',
              borderRadius: 'var(--radius-md)',
              background: 'transparent',
              padding: '12px 14px',
              cursor: 'pointer',
            }}
          >
            {t('sync.registerSkip')}
          </button>
          <button
            type="button"
            onClick={() => void onRegister(deviceName)}
            disabled={isBusy}
            style={{
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-accent)',
              color: '#fff',
              padding: '12px 16px',
              cursor: 'pointer',
              fontWeight: 'var(--weight-semibold)',
            }}
          >
            {t('sync.registerAction')}
          </button>
        </div>
      </section>
    </div>
  );
}
