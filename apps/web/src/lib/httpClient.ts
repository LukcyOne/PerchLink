const API_BASE_URL = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env?.VITE_API_BASE_URL ?? 'http://127.0.0.1:8787';

interface ErrorPayload {
  code?: string;
  message?: string;
  setup_open?: boolean;
}

export class RemoteRequestError extends Error {
  code: string;
  status: number;
  setupOpen: boolean;

  constructor(message: string, status: number, code: string, setupOpen = false) {
    super(message);
    this.name = 'RemoteRequestError';
    this.code = code;
    this.status = status;
    this.setupOpen = setupOpen;
  }
}

function emitSessionExpired(error: RemoteRequestError) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent('perchlink:session-expired', {
      detail: error,
    }),
  );
}

export async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const text = await response.text();
  const payload = text.length > 0 ? (JSON.parse(text) as T | ErrorPayload) : null;

  if (!response.ok) {
    const errorPayload = (payload ?? {}) as ErrorPayload;
    const error = new RemoteRequestError(
      errorPayload.message ?? 'Remote request failed.',
      response.status,
      errorPayload.code ?? 'request_failed',
      Boolean(errorPayload.setup_open),
    );

    if (error.code === 'session_expired') {
      emitSessionExpired(error);
    }

    throw error;
  }

  return payload as T;
}
