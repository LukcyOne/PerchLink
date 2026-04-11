import { create } from 'zustand';
import type { SyncDeviceRecord, SyncStatusSnapshot } from '@perchlink/core';
import { desktopSyncManager } from '../../../apps/desktop/src/lib/syncManager';
import {
  clearStoredSyncConnection,
  getDesktopSyncStatus,
  getStoredSyncConnection,
  listSyncDevices,
  registerSyncDevice,
  revokeSyncDevice,
  saveStoredSyncConnection,
  signInForSync,
  type DesktopSyncConnectionRecord,
} from '../../../apps/desktop/src/lib/syncClient';
import { getDefaultDeviceLabel } from '../../../apps/desktop/src/lib/deviceLabel';

export interface SyncStoreState {
  connection: DesktopSyncConnectionRecord | null;
  status: SyncStatusSnapshot | null;
  devices: SyncDeviceRecord[];
  remoteAddressDraft: string;
  accountDraft: string;
  passwordDraft: string;
  deviceNameDraft: string;
  registrationOpen: boolean;
  isBusy: boolean;
  error: string | null;
  setDrafts: (patch: Partial<Pick<SyncStoreState, 'remoteAddressDraft' | 'accountDraft' | 'passwordDraft' | 'deviceNameDraft'>>) => void;
  hydrate: () => Promise<void>;
  signIn: () => Promise<void>;
  registerCurrentDevice: () => Promise<void>;
  skipRegistration: () => Promise<void>;
  resumeRegistration: () => void;
  syncNow: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  revokeDevice: (deviceId: string) => Promise<void>;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Sync action failed.';
}

async function loadConnectionState() {
  const [connection, status] = await Promise.all([getStoredSyncConnection(), getDesktopSyncStatus()]);
  return { connection, status };
}

export const useSyncStore = create<SyncStoreState>((set, get) => ({
  connection: null,
  status: null,
  devices: [],
  remoteAddressDraft: 'http://127.0.0.1:8787',
  accountDraft: '',
  passwordDraft: '',
  deviceNameDraft: getDefaultDeviceLabel(),
  registrationOpen: false,
  isBusy: false,
  error: null,
  setDrafts: (patch) => set(patch),
  hydrate: async () => {
    const { connection, status } = await loadConnectionState();
    const devices = connection ? await listSyncDevices(connection).catch(() => []) : [];
      set({
        connection,
        status,
        devices,
        registrationOpen: Boolean(connection?.registrationRequired && !connection?.localOnly),
      deviceNameDraft: connection?.currentDevice?.deviceName ?? get().deviceNameDraft,
      remoteAddressDraft: connection?.remoteAddress ?? get().remoteAddressDraft,
      error: null,
    });
  },
  signIn: async () => {
    const state = get();
    set({ isBusy: true, error: null });

    try {
      const result = await signInForSync({
        remoteAddress: state.remoteAddressDraft,
        account: state.accountDraft,
        password: state.passwordDraft,
      });

      const record = await saveStoredSyncConnection({
        remoteAddress: state.remoteAddressDraft,
        accountId: result.account.id,
        accountName: result.account.accountName,
        sessionToken: result.sessionToken,
        deviceToken: null,
        currentDevice: null,
        localOnly: false,
        registrationRequired: true,
        syncing: false,
        lastPushAt: null,
        lastPullAt: null,
        lastError: null,
      });

      set({
        connection: record,
        registrationOpen: true,
        deviceNameDraft: getDefaultDeviceLabel(),
        passwordDraft: '',
        isBusy: false,
      });
      await get().hydrate();
    } catch (error) {
      set({ isBusy: false, error: toErrorMessage(error) });
      throw error;
    }
  },
  registerCurrentDevice: async () => {
    const state = get();
    if (!state.connection?.sessionToken) {
      return;
    }

    set({ isBusy: true, error: null });

    try {
      const result = await registerSyncDevice({
        remoteAddress: state.connection.remoteAddress ?? state.remoteAddressDraft,
        sessionToken: state.connection.sessionToken,
        deviceName: state.deviceNameDraft.trim() || getDefaultDeviceLabel(),
      });

      await saveStoredSyncConnection({
        ...state.connection,
        deviceToken: result.deviceToken,
        currentDevice: result.device,
        localOnly: false,
        registrationRequired: false,
      });

      set({ registrationOpen: false, isBusy: false });
      await get().hydrate();
      await desktopSyncManager.syncNow();
      await get().hydrate();
    } catch (error) {
      set({ isBusy: false, error: toErrorMessage(error) });
      throw error;
    }
  },
  skipRegistration: async () => {
    const connection = get().connection;
    if (!connection) {
      return;
    }

    await saveStoredSyncConnection({
      ...connection,
      localOnly: true,
      registrationRequired: true,
      currentDevice: null,
      deviceToken: null,
      syncing: false,
    });

    set({ registrationOpen: false });
    await get().hydrate();
  },
  resumeRegistration: () => set({ registrationOpen: true, deviceNameDraft: getDefaultDeviceLabel(), error: null }),
  syncNow: async () => {
    set({ isBusy: true, error: null });
    try {
      await desktopSyncManager.syncNow();
      set({ isBusy: false });
      await get().hydrate();
    } catch (error) {
      set({ isBusy: false, error: toErrorMessage(error) });
      throw error;
    }
  },
  refreshDevices: async () => {
    const connection = get().connection;
    if (!connection) {
      set({ devices: [] });
      return;
    }

    const devices = await listSyncDevices(connection);
    set({ devices });
  },
  revokeDevice: async (deviceId) => {
    const connection = get().connection;
    if (!connection) {
      return;
    }

    set({ isBusy: true, error: null });
    try {
      await revokeSyncDevice(connection, deviceId);

      if (connection.currentDevice?.id === deviceId) {
        await saveStoredSyncConnection({
          ...connection,
          currentDevice: null,
          deviceToken: null,
          localOnly: true,
          registrationRequired: true,
          syncing: false,
        });
      }

      set({ isBusy: false });
      await get().hydrate();
    } catch (error) {
      set({ isBusy: false, error: toErrorMessage(error) });
      throw error;
    }
  },
}));
