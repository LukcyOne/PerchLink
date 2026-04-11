import { requestJson } from './httpClient';

interface RemoteSessionPayload {
  account: {
    id: string;
    account_name: string;
  };
  setup_open: boolean;
}

interface RemoteSetupStatusPayload {
  setup_open: boolean;
}

export interface RemoteSessionAccount {
  id: string;
  accountName: string;
}

export interface RemoteSessionState {
  account: RemoteSessionAccount;
  setupOpen: boolean;
}

function mapSession(payload: RemoteSessionPayload): RemoteSessionState {
  return {
    account: {
      id: payload.account.id,
      accountName: payload.account.account_name,
    },
    setupOpen: payload.setup_open,
  };
}

export async function getCurrentSession(): Promise<RemoteSessionState> {
  return mapSession(await requestJson<RemoteSessionPayload>('/api/auth/session'));
}

export async function signInRemoteSession(input: { account: string; password: string }): Promise<RemoteSessionState> {
  return mapSession(
    await requestJson<RemoteSessionPayload>('/api/auth/sign-in', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function signOutRemoteSession(): Promise<void> {
  await requestJson('/api/auth/sign-out', {
    method: 'POST',
  });
}

export async function runInitialSetup(input: { account: string; password: string }): Promise<RemoteSessionState> {
  return mapSession(
    await requestJson<RemoteSessionPayload>('/api/setup', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  );
}

export async function getSetupStatus(): Promise<{ setupOpen: boolean }> {
  const payload = await requestJson<RemoteSetupStatusPayload>('/api/setup/status');
  return {
    setupOpen: payload.setup_open,
  };
}
