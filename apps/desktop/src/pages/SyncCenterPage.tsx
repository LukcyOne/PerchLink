import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from '@perchlink/i18n';
import { useSyncStore } from '@perchlink/store';
import {
  DeviceRegistrationDialog,
  SyncConflictsPanel,
  SyncDevicesPanel,
  SyncHistoryPanel,
  SyncOverviewPanel,
} from '@perchlink/ui';

type SyncCenterTab = 'overview' | 'history' | 'conflicts' | 'devices';

export function SyncCenterPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const {
    connection,
    status,
    devices,
    rounds,
    conflicts,
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
    markConflictRead,
  } = useSyncStore();
  const [activeTab, setActiveTab] = useState<SyncCenterTab>('overview');
  const [selectedConflictId, setSelectedConflictId] = useState<string | null>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const requestedTab = params.get('tab');
    const requestedConflictId = params.get('conflictId');

    if (requestedTab === 'overview' || requestedTab === 'history' || requestedTab === 'conflicts' || requestedTab === 'devices') {
      setActiveTab(requestedTab);
    }

    if (requestedConflictId) {
      setSelectedConflictId(requestedConflictId);
    }
  }, [location.search]);

  useEffect(() => {
    if (!selectedConflictId && conflicts.length > 0) {
      setSelectedConflictId(conflicts[0]?.id ?? null);
    }
  }, [conflicts, selectedConflictId]);

  const tabs: Array<{ id: SyncCenterTab; label: string }> = [
    { id: 'overview', label: t('sync.overviewTitle') },
    { id: 'history', label: t('sync.historyTitle') },
    { id: 'conflicts', label: t('sync.conflictsTitle') },
    { id: 'devices', label: t('sync.devicesTitle') },
  ];

  async function handleSelectConflict(conflictId: string) {
    setActiveTab('conflicts');
    setSelectedConflictId(conflictId);
    const conflict = conflicts.find((entry) => entry.id === conflictId);
    if (conflict?.unread) {
      await markConflictRead(conflictId);
    }
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--space-xl)' }}>
      <header style={{ display: 'grid', gap: 'var(--space-sm)' }}>
        <h2 style={{ margin: 0 }}>{t('sync.centerTitle')}</h2>
        <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
          {t('sync.centerBody')}
        </p>
      </header>

      <nav
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-sm)',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            style={{
              border: `1px solid ${activeTab === tab.id ? 'var(--color-accent)' : 'var(--color-border-subtle)'}`,
              borderRadius: 999,
              background: activeTab === tab.id ? 'rgba(47, 107, 98, 0.1)' : 'transparent',
              color: activeTab === tab.id ? 'var(--color-accent)' : 'var(--color-text-primary)',
              padding: '10px 14px',
              cursor: 'pointer',
              fontWeight: 'var(--weight-semibold)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

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

      {activeTab === 'overview' ? (
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
      ) : null}

      {activeTab === 'history' ? <SyncHistoryPanel rounds={rounds} /> : null}

      {activeTab === 'conflicts' ? (
        <SyncConflictsPanel
          conflicts={conflicts}
          selectedConflictId={selectedConflictId}
          onSelectConflict={(conflictId) => void handleSelectConflict(conflictId)}
        />
      ) : null}

      {activeTab === 'devices' ? (
        <div style={{ display: 'grid', gap: 'var(--space-md)' }}>
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
        </div>
      ) : null}

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
