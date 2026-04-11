import type { SyncOutboxChange, SyncPullResponse, SyncPushResponse } from '@perchlink/core';
import {
  ackDesktopSyncPushResults,
  applyDesktopRemoteEvents,
  getDesktopSyncStatus,
  getStoredSyncConnection,
  listDesktopSyncOutbox,
  pullSyncChanges,
  pushSyncChanges,
  saveStoredSyncConnection,
  type DesktopSyncConnectionRecord,
} from './syncClient';

interface DesktopSyncBridge {
  getConnection: () => Promise<DesktopSyncConnectionRecord | null>;
  saveConnection: (record: DesktopSyncConnectionRecord) => Promise<DesktopSyncConnectionRecord>;
  getStatus: typeof getDesktopSyncStatus;
  listOutbox: () => Promise<SyncOutboxChange[]>;
  ackPushResults: (results: SyncPushResponse['results']) => Promise<void>;
  applyRemoteEvents: (events: SyncPullResponse['events'], serverCursor: number) => Promise<void>;
}

interface DesktopSyncTransport {
  pushChanges: typeof pushSyncChanges;
  pullChanges: typeof pullSyncChanges;
}

const DEFAULT_DEBOUNCE_MS = 4000;
const DEFAULT_PULL_INTERVAL_MS = 90000;

function canSync(connection: DesktopSyncConnectionRecord | null): connection is DesktopSyncConnectionRecord {
  return Boolean(
    connection &&
      !connection.localOnly &&
      !connection.registrationRequired &&
      connection.remoteAddress &&
      connection.deviceToken &&
      connection.currentDevice,
  );
}

export class DesktopSyncManager {
  private started = false;
  private inFlight: Promise<void> | null = null;
  private rerunRequested = false;
  private debounceTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private periodicTimer: ReturnType<typeof globalThis.setInterval> | null = null;

  constructor(
    private readonly bridge: DesktopSyncBridge,
    private readonly transport: DesktopSyncTransport,
    private readonly debounceMs = DEFAULT_DEBOUNCE_MS,
    private readonly pullIntervalMs = DEFAULT_PULL_INTERVAL_MS,
  ) {}

  async start(): Promise<void> {
    if (this.started) {
      return;
    }

    this.started = true;
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleReconnect);
      this.periodicTimer = globalThis.setInterval(() => {
        void this.runSyncRound('poll');
      }, this.pullIntervalMs);
    }

    await this.runSyncRound('startup');
  }

  noteLocalMutation(): void {
    if (!this.started) {
      return;
    }

    if (this.debounceTimer) {
      globalThis.clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = globalThis.setTimeout(() => {
      this.debounceTimer = null;
      void this.runSyncRound('debounce');
    }, this.debounceMs);
  }

  async syncNow(): Promise<void> {
    await this.runSyncRound('manual');
  }

  private readonly handleReconnect = () => {
    void this.runSyncRound('reconnect');
  };

  private async setSyncing(nextValue: boolean, lastError: string | null): Promise<void> {
    const connection = await this.bridge.getConnection();

    if (!connection) {
      return;
    }

    await this.bridge.saveConnection({
      ...connection,
      syncing: nextValue,
      lastError,
    });
  }

  private async runSyncRound(_trigger: 'startup' | 'debounce' | 'reconnect' | 'manual' | 'poll'): Promise<void> {
    if (this.inFlight) {
      this.rerunRequested = true;
      return this.inFlight;
    }

    this.inFlight = (async () => {
      const connection = await this.bridge.getConnection();

      if (!canSync(connection)) {
        return;
      }

      await this.setSyncing(true, null);

      try {
        const outbox = await this.bridge.listOutbox();
        if (outbox.length > 0) {
          const pushResponse = await this.transport.pushChanges(connection, outbox);
          await this.bridge.ackPushResults(pushResponse.results);
        }

        const refreshedConnection = await this.bridge.getConnection();
        if (!canSync(refreshedConnection)) {
          return;
        }

        const cursor = refreshedConnection.currentDevice?.lastCursor ?? 0;
        const pullResponse = await this.transport.pullChanges(refreshedConnection, cursor);

        if (!pullResponse.resyncRequired && pullResponse.events.length > 0) {
          await this.bridge.applyRemoteEvents(pullResponse.events, pullResponse.serverCursor);
        }

        await this.setSyncing(false, pullResponse.resyncRequired ? 'cursor_expired' : null);
      } catch (error) {
        await this.setSyncing(false, error instanceof Error ? error.message : 'Sync failed.');
      }
    })().finally(async () => {
      this.inFlight = null;
      if (this.rerunRequested) {
        this.rerunRequested = false;
        await this.runSyncRound('poll');
      }
    });

    return this.inFlight;
  }
}

export function createDesktopSyncManager(
  bridge: DesktopSyncBridge = {
    getConnection: getStoredSyncConnection,
    saveConnection: saveStoredSyncConnection,
    getStatus: getDesktopSyncStatus,
    listOutbox: listDesktopSyncOutbox,
    ackPushResults: ackDesktopSyncPushResults,
    applyRemoteEvents: applyDesktopRemoteEvents,
  },
  transport: DesktopSyncTransport = {
    pushChanges: pushSyncChanges,
    pullChanges: pullSyncChanges,
  },
) {
  return new DesktopSyncManager(bridge, transport);
}

export const desktopSyncManager = createDesktopSyncManager();
