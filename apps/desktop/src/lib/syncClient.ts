import type {
  SyncDeviceRecord,
  SyncOutboxChange,
  SyncPullResponse,
  SyncPushResponse,
  SyncStatusSnapshot,
} from '@perchlink/core';
import { invokeDesktop } from './desktopBridge';

export interface DesktopSyncConnectionRecord {
  remoteAddress: string | null;
  accountId: string | null;
  accountName: string | null;
  sessionToken: string | null;
  deviceToken: string | null;
  currentDevice: SyncDeviceRecord | null;
  localOnly: boolean;
  registrationRequired: boolean;
  syncing: boolean;
  lastPushAt: string | null;
  lastPullAt: string | null;
  lastError: string | null;
}

interface SyncSessionPayload {
  account: {
    id: string;
    account_name: string;
  };
  session_token: string;
}

interface DeviceRegistrationPayload {
  device: SyncDeviceRecord;
  device_token: string;
}

function normalizeRemoteAddress(remoteAddress: string): string {
  return remoteAddress.replace(/\/+$/, '');
}

async function requestSyncJson<T>(
  remoteAddress: string,
  path: string,
  authToken: string,
  init?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };

  if (authToken.trim().length > 0) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(`${normalizeRemoteAddress(remoteAddress)}${path}`, {
    headers,
    ...init,
  });

  const text = await response.text();
  const payload = text.length > 0 ? (JSON.parse(text) as T | { message?: string; code?: string }) : null;

  if (!response.ok) {
    const errorPayload = (payload ?? {}) as { message?: string; code?: string };
    throw new Error(errorPayload.message ?? errorPayload.code ?? 'Sync request failed.');
  }

  return payload as T;
}

export async function getStoredSyncConnection(): Promise<DesktopSyncConnectionRecord | null> {
  return invokeDesktop<DesktopSyncConnectionRecord | null>('desktop_get_sync_connection');
}

export async function getDesktopSyncStatus(): Promise<SyncStatusSnapshot> {
  return invokeDesktop<SyncStatusSnapshot>('desktop_get_sync_status');
}

export async function saveStoredSyncConnection(record: DesktopSyncConnectionRecord): Promise<DesktopSyncConnectionRecord> {
  return invokeDesktop<DesktopSyncConnectionRecord>('desktop_save_sync_connection', { record });
}

export async function clearStoredSyncConnection(): Promise<void> {
  await invokeDesktop('desktop_clear_sync_connection');
}

export async function listDesktopSyncOutbox(): Promise<SyncOutboxChange[]> {
  return invokeDesktop<SyncOutboxChange[]>('desktop_list_sync_outbox');
}

export async function ackDesktopSyncPushResults(results: SyncPushResponse['results']): Promise<void> {
  await invokeDesktop('desktop_ack_sync_push_results', { results });
}

export async function applyDesktopRemoteEvents(events: SyncPullResponse['events'], serverCursor: number): Promise<void> {
  await invokeDesktop('desktop_apply_remote_events', { events, serverCursor });
}

export async function signInForSync(input: {
  remoteAddress: string;
  account: string;
  password: string;
}): Promise<{ sessionToken: string; account: { id: string; accountName: string } }> {
  const payload = await requestSyncJson<SyncSessionPayload>(input.remoteAddress, '/api/sync/session', '', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      account: input.account,
      password: input.password,
    }),
  });

  return {
    sessionToken: payload.session_token,
    account: {
      id: payload.account.id,
      accountName: payload.account.account_name,
    },
  };
}

export async function registerSyncDevice(input: {
  remoteAddress: string;
  sessionToken: string;
  deviceName: string;
}): Promise<{ device: SyncDeviceRecord; deviceToken: string }> {
  const payload = await requestSyncJson<DeviceRegistrationPayload>(
    input.remoteAddress,
    '/api/sync/devices/register',
    input.sessionToken,
    {
      method: 'POST',
      body: JSON.stringify({
        deviceName: input.deviceName,
      }),
    },
  );

  return {
    device: payload.device,
    deviceToken: payload.device_token,
  };
}

export async function listSyncDevices(connection: DesktopSyncConnectionRecord): Promise<SyncDeviceRecord[]> {
  if (!connection.remoteAddress || !connection.deviceToken) {
    return [];
  }

  return requestSyncJson<SyncDeviceRecord[]>(connection.remoteAddress, '/api/sync/devices', connection.deviceToken);
}

export async function revokeSyncDevice(connection: DesktopSyncConnectionRecord, deviceId: string): Promise<void> {
  if (!connection.remoteAddress || !connection.deviceToken) {
    return;
  }

  await requestSyncJson(connection.remoteAddress, `/api/sync/devices/${deviceId}/revoke`, connection.deviceToken, {
    method: 'POST',
  });
}

export async function pushSyncChanges(
  connection: DesktopSyncConnectionRecord,
  changes: SyncOutboxChange[],
): Promise<SyncPushResponse> {
  if (!connection.remoteAddress || !connection.deviceToken) {
    throw new Error('Sync device is not registered.');
  }

  return requestSyncJson<SyncPushResponse>(connection.remoteAddress, '/api/sync/push', connection.deviceToken, {
    method: 'POST',
    body: JSON.stringify({ changes }),
  });
}

export async function pullSyncChanges(
  connection: DesktopSyncConnectionRecord,
  cursor: number,
  limit = 100,
): Promise<SyncPullResponse> {
  if (!connection.remoteAddress || !connection.deviceToken) {
    throw new Error('Sync device is not registered.');
  }

  return requestSyncJson<SyncPullResponse>(
    connection.remoteAddress,
    `/api/sync/pull?cursor=${cursor}&limit=${limit}`,
    connection.deviceToken,
  );
}
