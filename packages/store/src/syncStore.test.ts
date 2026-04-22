import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSyncStore } from './syncStore';

vi.mock('../../../apps/desktop/src/lib/syncManager', () => ({
  desktopSyncManager: {
    syncNow: vi.fn(async () => {}),
  },
}));

vi.mock('../../../apps/desktop/src/lib/deviceLabel', () => ({
  getDefaultDeviceLabel: () => 'My Windows PC',
}));

vi.mock('../../../apps/desktop/src/lib/syncClient', () => {
  let storedConnection: unknown = null;
  return {
    getStoredSyncConnection: vi.fn(async () => storedConnection),
    getDesktopSyncStatus: vi.fn(async () => ({
      connectionState: storedConnection ? 'registration-required' : 'local-only',
      remoteAddress: (storedConnection as { remoteAddress?: string } | null)?.remoteAddress ?? null,
      localOnly: (storedConnection as { localOnly?: boolean } | null)?.localOnly ?? true,
      pendingPushCount: 0,
      unreadConflictCount: 0,
      lastPushAt: null,
      lastPullAt: null,
      lastError: null,
      currentDevice: (storedConnection as { currentDevice?: unknown } | null)?.currentDevice ?? null,
    })),
    listDesktopSyncRounds: vi.fn(async () => []),
    listDesktopSyncConflicts: vi.fn(async () => []),
    markDesktopSyncConflictRead: vi.fn(async () => {}),
    listSyncDevices: vi.fn(async () => []),
    signInForSync: vi.fn(async () => ({
      sessionToken: 'session-1',
      account: { id: 'account-1', accountName: 'owner' },
    })),
    registerSyncDevice: vi.fn(async () => ({
      device: {
        id: 'device-1',
        deviceName: 'My Windows PC',
        lastCursor: 0,
        createdAt: '2026-04-11T00:00:00.000Z',
        updatedAt: '2026-04-11T00:00:00.000Z',
        lastSeenAt: null,
        revokedAt: null,
      },
      deviceToken: 'ptdev_token',
    })),
    revokeSyncDevice: vi.fn(async () => {}),
    saveStoredSyncConnection: vi.fn(async (record) => {
      storedConnection = record;
      return record;
    }),
    clearStoredSyncConnection: vi.fn(async () => {
      storedConnection = null;
    }),
  };
});

describe('useSyncStore', () => {
  beforeEach(() => {
    useSyncStore.setState({
      connection: null,
      status: null,
      devices: [],
      rounds: [],
      conflicts: [],
      remoteAddressDraft: 'http://127.0.0.1:8787',
      accountDraft: '',
      passwordDraft: '',
      deviceNameDraft: 'My Windows PC',
      registrationOpen: false,
      isBusy: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens registration after successful sign-in', async () => {
    useSyncStore.setState({
      remoteAddressDraft: 'http://127.0.0.1:8787',
      accountDraft: 'owner',
      passwordDraft: 'supersecret123',
    });

    await useSyncStore.getState().signIn();

    const state = useSyncStore.getState();
    expect(state.connection?.accountId).toBe('account-1');
    expect(state.registrationOpen).toBe(true);
    expect(state.passwordDraft).toBe('');
  });

  it('keeps local-only mode when registration is skipped', async () => {
    useSyncStore.setState({
      connection: {
        remoteAddress: 'http://127.0.0.1:8787',
        accountId: 'account-1',
        accountName: 'owner',
        sessionToken: 'session-1',
        deviceToken: null,
        currentDevice: null,
        localOnly: false,
        registrationRequired: true,
        syncing: false,
        lastPushAt: null,
        lastPullAt: null,
        lastError: null,
      },
      registrationOpen: true,
    });

    await useSyncStore.getState().skipRegistration();

    expect(useSyncStore.getState().registrationOpen).toBe(false);
  });

  it('registers the current device and closes the dialog', async () => {
    useSyncStore.setState({
      connection: {
        remoteAddress: 'http://127.0.0.1:8787',
        accountId: 'account-1',
        accountName: 'owner',
        sessionToken: 'session-1',
        deviceToken: null,
        currentDevice: null,
        localOnly: false,
        registrationRequired: true,
        syncing: false,
        lastPushAt: null,
        lastPullAt: null,
        lastError: null,
      },
      registrationOpen: true,
      deviceNameDraft: 'My Windows PC',
    });

    await useSyncStore.getState().registerCurrentDevice();

    expect(useSyncStore.getState().registrationOpen).toBe(false);
  });
});
