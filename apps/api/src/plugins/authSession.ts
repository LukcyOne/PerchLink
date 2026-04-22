import { createHash } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface RemoteAccountSummary {
  id: string;
  accountName: string;
}

export interface RemoteDeviceSummary {
  id: string;
  deviceName: string;
  lastCursor: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    currentAccount: RemoteAccountSummary | null;
    currentSessionId: string | null;
    currentDevice: RemoteDeviceSummary | null;
  }

  interface FastifyInstance {
    requireSession: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireDevice: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

interface AccountLookupRow {
  account_id: string;
  account_name: string;
}

interface SessionRow extends AccountLookupRow {
  session_id: string;
}

interface DeviceRow {
  device_id: string;
  device_name: string;
  last_cursor: number;
  account_id: string;
  account_name: string;
}

interface DeviceAuthLookupRow {
  revoked_at: string | null;
}

function mapAccount(row: AccountLookupRow): RemoteAccountSummary {
  return {
    id: row.account_id,
    accountName: row.account_name,
  };
}

function mapDevice(row: DeviceRow): RemoteDeviceSummary {
  return {
    id: row.device_id,
    deviceName: row.device_name,
    lastCursor: row.last_cursor,
  };
}

function hashDeviceToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function readBearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;

  if (!header) {
    return null;
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

export async function registerAuthSession(app: FastifyInstance): Promise<void> {
  app.decorateRequest('currentAccount', null);
  app.decorateRequest('currentSessionId', null);
  app.decorateRequest('currentDevice', null);

  app.decorate('requireSession', async function requireSession(request, reply) {
    if (!request.currentAccount || !request.currentSessionId) {
      reply.code(401).send({
        code: 'session_expired',
        message: 'Your session has expired. Please sign in again.',
      });
    }
  });

  app.decorate('requireDevice', async function requireDevice(request, reply) {
    if (!request.currentAccount || !request.currentDevice) {
      const bearerToken = readBearerToken(request);

      if (bearerToken?.startsWith('ptdev_')) {
        const tokenHash = hashDeviceToken(bearerToken);
        const device = app.db
          .prepare(
            `
              SELECT revoked_at
              FROM devices
              WHERE token_hash = ?
            `,
          )
          .get(tokenHash) as DeviceAuthLookupRow | undefined;

        if (device?.revoked_at) {
          reply.code(403).send({
            code: 'device_revoked',
            message: 'This sync device has been revoked. The desktop should return to local mode.',
          });
          return;
        }

        reply.code(401).send({
          code: 'auth_invalid',
          message: 'Sync authentication is no longer valid. Please sign in again.',
        });
        return;
      }

      reply.code(401).send({
        code: 'device_auth_required',
        message: 'This action requires a registered sync device.',
      });
    }
  });

  app.addHook('preHandler', async (request) => {
    const bearerToken = readBearerToken(request);
    const sessionId = bearerToken && !bearerToken.startsWith('ptdev_') ? bearerToken : request.cookies.perchlink_session;

    request.currentAccount = null;
    request.currentSessionId = null;
    request.currentDevice = null;

    if (bearerToken?.startsWith('ptdev_')) {
      const tokenHash = hashDeviceToken(bearerToken);
      const now = new Date().toISOString();
      const row = app.db
        .prepare(
          `
            SELECT
              devices.id AS device_id,
              devices.device_name AS device_name,
              devices.last_cursor AS last_cursor,
              accounts.id AS account_id,
              accounts.account_name AS account_name
            FROM devices
            INNER JOIN accounts ON accounts.id = devices.account_id
            WHERE devices.token_hash = ?
              AND devices.revoked_at IS NULL
          `,
        )
        .get(tokenHash) as DeviceRow | undefined;

      if (!row) {
        return;
      }

      app.db
        .prepare(
          `
            UPDATE devices
            SET last_seen_at = ?, updated_at = ?
            WHERE id = ?
          `,
        )
        .run(now, now, row.device_id);

      request.currentAccount = mapAccount(row);
      request.currentDevice = mapDevice(row);
      return;
    }

    if (!sessionId) {
      return;
    }

    const now = new Date().toISOString();
    const row = app.db
      .prepare(
        `
          SELECT
            sessions.id AS session_id,
            accounts.id AS account_id,
            accounts.account_name AS account_name
          FROM sessions
          INNER JOIN accounts ON accounts.id = sessions.account_id
          WHERE sessions.id = ?
            AND sessions.revoked_at IS NULL
            AND sessions.expires_at > ?
        `,
      )
      .get(sessionId, now) as SessionRow | undefined;

    if (!row) {
      return;
    }

    request.currentSessionId = row.session_id;
    request.currentAccount = mapAccount(row);
  });
}
