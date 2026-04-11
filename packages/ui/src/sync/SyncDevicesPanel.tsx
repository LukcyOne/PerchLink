import type { SyncDeviceRecord } from '@perchlink/core';
import { useTranslation } from 'react-i18next';

interface SyncDevicesPanelProps {
  currentDeviceId: string | null;
  devices: SyncDeviceRecord[];
  onRevoke?: (deviceId: string) => void;
}

export function SyncDevicesPanel({ currentDeviceId, devices, onRevoke }: SyncDevicesPanelProps) {
  const { t } = useTranslation();
  return (
    <section style={{ display: 'grid', gap: 'var(--space-md)' }}>
      <header>
        <h2 style={{ margin: 0 }}>{t('sync.devicesTitle')}</h2>
        <p style={{ margin: 'var(--space-xs) 0 0', color: 'var(--color-text-muted)' }}>
          {t('sync.devicesBody')}
        </p>
      </header>

      {devices.length === 0 ? (
        <article
          style={{
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--color-border-subtle)',
            background: 'rgba(231, 222, 208, 0.35)',
            padding: 'var(--space-xl)',
          }}
        >
          No registered devices yet.
        </article>
      ) : (
        devices.map((device) => {
          const isCurrent = device.id === currentDeviceId;
          return (
            <article
              key={device.id}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 'var(--space-md)',
                alignItems: 'center',
                padding: 'var(--space-lg)',
                borderRadius: 'var(--radius-lg)',
                border: `1px solid ${isCurrent ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`,
                background: 'var(--color-surface-raised)',
              }}
            >
              <div>
                <strong>{device.deviceName}</strong>
                <div style={{ color: 'var(--color-text-muted)', marginTop: 'var(--space-xs)' }}>
                  {isCurrent ? t('sync.currentDevice') : t('sync.linkedDevice')}
                </div>
                <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--type-label)' }}>
                  Last cursor: {device.lastCursor}
                </div>
              </div>
              {!isCurrent ? (
                <button
                  type="button"
                  onClick={() => onRevoke?.(device.id)}
                  style={{
                    border: '1px solid rgba(180, 107, 53, 0.3)',
                    borderRadius: 'var(--radius-md)',
                    background: 'rgba(180, 107, 53, 0.08)',
                    color: '#8f4e1d',
                    padding: '10px 14px',
                    cursor: 'pointer',
                  }}
                >
                  {t('sync.revoke')}
                </button>
              ) : null}
            </article>
          );
        })
      )}
    </section>
  );
}
