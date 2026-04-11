import { useEffect } from 'react';
import { useTranslation } from '@perchlink/i18n';
import { useSyncStore } from '@perchlink/store';
import { DeviceRegistrationDialog, SyncDevicesPanel, SyncOverviewPanel } from '@perchlink/ui';

export function SyncCenterPage() {
  const { t } = useTranslation();
  const {
    connection,
    status,
    devices,
    remoteAddressDraft,
    accountDraft,
    passwordDraft,
    deviceNameDraft,
    registrationOpen,
    isBusy,
    error,
    setDrafts,
    hydrate,
    signIn,
    registerCurrentDevice,
    skipRegistration,
    resumeRegistration,
    syncNow,
    refreshDevices,
    revokeDevice,
  } = useSyncStore();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return (
    <div style={{ display: 'grid', gap: 'var(--space-xl)' }}>
      <header style={{ display: 'grid', gap: 'var(--space-sm)' }}>
        <h2 style={{ margin: 0 }}>{t('sync.centerTitle')}</h2>
        <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
          {t('sync.centerBody')}
        </p>
      </header>

      {!connection?.accountId ? (
        <section
          style={{
            display: 'grid',
            gap: 'var(--space-md)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border-subtle)',
            background: 'var(--color-surface-raised)',
            padding: 'var(--space-xl)',
          }}
        >
          <h3 style={{ margin: 0 }}>{t('sync.connectTitle')}</h3>
          <label style={{ display: 'grid', gap: 'var(--space-xs)' }}>
            <span>{t('sync.connectRemote')}</span>
            <input value={remoteAddressDraft} onChange={(event) => setDrafts({ remoteAddressDraft: event.target.value })} />
          </label>
          <label style={{ display: 'grid', gap: 'var(--space-xs)' }}>
            <span>{t('sync.connectAccount')}</span>
            <input value={accountDraft} onChange={(event) => setDrafts({ accountDraft: event.target.value })} />
          </label>
          <label style={{ display: 'grid', gap: 'var(--space-xs)' }}>
            <span>{t('sync.connectPassword')}</span>
            <input type="password" value={passwordDraft} onChange={(event) => setDrafts({ passwordDraft: event.target.value })} />
          </label>
          {error ? <p style={{ color: 'var(--color-destructive)', margin: 0 }}>{error}</p> : null}
          <button
            type="button"
            onClick={() => void signIn()}
            disabled={isBusy}
            style={{
              justifySelf: 'start',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              background: 'var(--color-accent)',
              color: '#fff',
              padding: '12px 16px',
              cursor: 'pointer',
            }}
          >
            {t('sync.connectAction')}
          </button>
        </section>
      ) : null}

      <SyncOverviewPanel
        remoteAddress={status?.remoteAddress ?? connection?.remoteAddress ?? null}
        accountName={connection?.accountName ?? null}
        connectionState={status?.connectionState ?? 'local-only'}
        currentDeviceName={status?.currentDevice?.deviceName ?? connection?.currentDevice?.deviceName ?? null}
        pendingPushCount={status?.pendingPushCount ?? 0}
        unreadConflictCount={status?.unreadConflictCount ?? 0}
        lastPushAt={status?.lastPushAt ?? null}
        lastPullAt={status?.lastPullAt ?? null}
        lastError={error ?? status?.lastError ?? null}
        onSyncNow={() => void syncNow()}
        extra={
          connection?.localOnly ? (
            <article
              style={{
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--color-border-subtle)',
                padding: 'var(--space-lg)',
                background: 'rgba(231, 222, 208, 0.35)',
              }}
            >
              <strong>{t('sync.localModeTitle')}</strong>
              <p style={{ marginBottom: 'var(--space-md)', color: 'var(--color-text-muted)' }}>
                {t('sync.localModeBody')}
              </p>
              <button
                type="button"
                onClick={resumeRegistration}
                style={{
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  background: 'transparent',
                  padding: '10px 14px',
                  cursor: 'pointer',
                }}
              >
                {t('sync.finishRegistration')}
              </button>
            </article>
          ) : null
        }
      />

      <section style={{ display: 'grid', gap: 'var(--space-md)' }}>
        <h2 style={{ margin: 0 }}>{t('sync.historyTitle')}</h2>
        <article
          style={{
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--color-border-subtle)',
            background: 'rgba(231, 222, 208, 0.25)',
            padding: 'var(--space-xl)',
          }}
        >
          {t('sync.historyPlaceholder')}
        </article>
      </section>

      <section style={{ display: 'grid', gap: 'var(--space-md)' }}>
        <h2 style={{ margin: 0 }}>{t('sync.conflictsTitle')}</h2>
        <article
          style={{
            borderRadius: 'var(--radius-lg)',
            border: '1px dashed var(--color-border-subtle)',
            background: 'rgba(231, 222, 208, 0.25)',
            padding: 'var(--space-xl)',
          }}
        >
          {t('sync.conflictsPlaceholder')}
        </article>
      </section>

      <SyncDevicesPanel
        currentDeviceId={connection?.currentDevice?.id ?? null}
        devices={devices}
        onRevoke={(deviceId) => void revokeDevice(deviceId)}
      />

      <button
        type="button"
        onClick={() => void refreshDevices()}
        style={{
          justifySelf: 'start',
          border: '1px solid var(--color-border-subtle)',
          borderRadius: 'var(--radius-md)',
          background: 'transparent',
          padding: '10px 14px',
          cursor: 'pointer',
        }}
      >
        {t('sync.refreshDevices')}
      </button>

      <DeviceRegistrationDialog
        isOpen={registrationOpen}
        defaultValue={deviceNameDraft}
        isBusy={isBusy}
        errorMessage={error}
        onRegister={async (deviceName) => {
          setDrafts({ deviceNameDraft: deviceName });
          await registerCurrentDevice();
        }}
        onSkip={skipRegistration}
        onClose={() => void skipRegistration()}
      />
    </div>
  );
}
