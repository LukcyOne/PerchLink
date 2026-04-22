import type { SyncOutboxChange, SyncPullResponse, SyncPushResponse, SyncRoundRecord } from '@perchlink/core';
import {
  ackDesktopSyncPushResults,
  applyDesktopRemoteEvents,
  fetchSyncBootstrap,
  getDesktopSyncStatus,
  getStoredSyncConnection,
  listDesktopSyncOutbox,
  prepareDesktopSyncResync,
  pullSyncChanges,
  pushSyncChanges,
  recordDesktopSyncRound,
  rebuildDesktopSyncState,
  saveStoredSyncConnection,
  SyncRequestError,
  type DesktopSyncBootstrapPayload,
  type DesktopSyncConnectionRecord,
} from './syncClient';

type SyncTrigger = 'startup' | 'debounce' | 'reconnect' | 'manual' | 'poll';

interface DesktopSyncBridge {
  getConnection: () => Promise<DesktopSyncConnectionRecord | null>;
  saveConnection: (record: DesktopSyncConnectionRecord) => Promise<DesktopSyncConnectionRecord>;
  getStatus: typeof getDesktopSyncStatus;
  listOutbox: () => Promise<SyncOutboxChange[]>;
  ackPushResults: (results: SyncPushResponse['results']) => Promise<void>;
  applyRemoteEvents: (events: SyncPullResponse['events'], serverCursor: number) => Promise<void>;
  recordRound: (round: SyncRoundRecord) => Promise<void>;
  prepareResync: () => Promise<void>;
  rebuildSyncState: (payload: DesktopSyncBootstrapPayload) => Promise<void>;
}

interface DesktopSyncTransport {
  pushChanges: typeof pushSyncChanges;
  pullChanges: typeof pullSyncChanges;
  fetchBootstrap: typeof fetchSyncBootstrap;
}

type SyncListener = () => void;

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

function nowIso(): string {
  return new Date().toISOString();
}

function createRoundId(): string {
  return `sync-round-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getSyncErrorCode(error: unknown): string | null {
  if (error instanceof SyncRequestError) {
    return error.code;
  }

  if (error instanceof Error) {
    if (error.message.includes('device_revoked')) {
      return 'device_revoked';
    }

    if (error.message.includes('auth_invalid')) {
      return 'auth_invalid';
    }

    if (error.message.includes('cursor_expired')) {
      return 'cursor_expired';
    }
  }

  return null;
}

function getSyncErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Sync failed.';
}

export class DesktopSyncManager {
  private started = false;
  private inFlight: Promise<void> | null = null;
  private rerunRequested = false;
  private debounceTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private periodicTimer: ReturnType<typeof globalThis.setInterval> | null = null;
  private listeners = new Set<SyncListener>();

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

  subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
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

  private emitStateChanged(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

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
    this.emitStateChanged();
  }

  private async handleDeviceRevoked(errorCode: string): Promise<void> {
    const connection = await this.bridge.getConnection();

    if (!connection) {
      return;
    }

    await this.bridge.saveConnection({
      ...connection,
      currentDevice: null,
      deviceToken: null,
      localOnly: true,
      registrationRequired: true,
      syncing: false,
      lastError: errorCode,
    });
    this.emitStateChanged();
  }

  private async recordRound(round: SyncRoundRecord): Promise<void> {
    await this.bridge.recordRound(round);
    this.emitStateChanged();
  }

  private buildRoundMessage(pushResponse: SyncPushResponse | null, fallbackMessage: string | null): string | null {
    if (!pushResponse) {
      return fallbackMessage;
    }

    const blocked = pushResponse.results.filter((result) => result.status === 'conflict' || result.status === 'rejected');
    if (blocked.length === 0) {
      return fallbackMessage;
    }

    return blocked[0]?.reasonCode ?? fallbackMessage;
  }

  private async runSyncRound(_trigger: SyncTrigger): Promise<void> {
    if (this.inFlight) {
      this.rerunRequested = true;
      return this.inFlight;
    }

    this.inFlight = (async () => {
      const connection = await this.bridge.getConnection();

      if (!canSync(connection)) {
        return;
      }

      const roundId = createRoundId();
      const startedAt = nowIso();
      let roundStatus: SyncRoundRecord['status'] = 'succeeded';
      let roundMessage: string | null = null;
      let pushCount = 0;
      let pullCount = 0;
      let pushResponse: SyncPushResponse | null = null;

      await this.setSyncing(true, null);

      try {
        const outbox = await this.bridge.listOutbox();
        pushCount = outbox.length;

        if (outbox.length > 0) {
          pushResponse = await this.transport.pushChanges(connection, outbox);
          await this.bridge.ackPushResults(pushResponse.results);

          if (pushResponse.results.some((result) => result.status === 'conflict' || result.status === 'rejected')) {
            roundStatus = 'failed';
          }
        }

        const refreshedConnection = await this.bridge.getConnection();
        if (!canSync(refreshedConnection)) {
          return;
        }

        const cursor = refreshedConnection.currentDevice?.lastCursor ?? 0;
        const pullResponse = await this.transport.pullChanges(refreshedConnection, cursor);

        if (pullResponse.resyncRequired) {
          await this.bridge.prepareResync();
          const bootstrap = await this.transport.fetchBootstrap(refreshedConnection);
          pullCount = bootstrap.bookmarks.length + bootstrap.categories.length + bootstrap.collections.length;
          await this.bridge.rebuildSyncState(bootstrap);
          roundStatus = 'failed';
          roundMessage = 'cursor_expired';
        } else {
          pullCount = pullResponse.events.length;
          if (pullResponse.events.length > 0) {
            await this.bridge.applyRemoteEvents(pullResponse.events, pullResponse.serverCursor);
          }
        }

        roundMessage = this.buildRoundMessage(pushResponse, roundMessage);
        await this.setSyncing(false, null);
      } catch (error) {
        const errorCode = getSyncErrorCode(error);
        const errorMessage = errorCode ?? getSyncErrorMessage(error);
        roundStatus = 'failed';
        roundMessage = errorMessage;

        if (errorCode === 'device_revoked') {
          await this.handleDeviceRevoked(errorCode);
        } else {
          await this.setSyncing(false, errorMessage);
        }
      } finally {
        await this.recordRound({
          id: roundId,
          direction: 'full',
          status: roundStatus,
          pushCount,
          pullCount,
          message: roundMessage,
          startedAt,
          finishedAt: nowIso(),
        });
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
    recordRound: recordDesktopSyncRound,
    prepareResync: prepareDesktopSyncResync,
    rebuildSyncState: rebuildDesktopSyncState,
  },
  transport: DesktopSyncTransport = {
    pushChanges: pushSyncChanges,
    pullChanges: pullSyncChanges,
    fetchBootstrap: fetchSyncBootstrap,
  },
) {
  return new DesktopSyncManager(bridge, transport);
}

export const desktopSyncManager = createDesktopSyncManager();
