import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

export interface RemoteAccountSummary {
  id: string;
  accountName: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    currentAccount: RemoteAccountSummary | null;
    currentSessionId: string | null;
  }

  interface FastifyInstance {
    requireSession: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

interface SessionRow {
  session_id: string;
  account_id: string;
  account_name: string;
}

function mapAccount(row: SessionRow): RemoteAccountSummary {
  return {
    id: row.account_id,
    accountName: row.account_name,
  };
}

export async function registerAuthSession(app: FastifyInstance): Promise<void> {
  app.decorateRequest('currentAccount', null);
  app.decorateRequest('currentSessionId', null);

  app.decorate('requireSession', async function requireSession(request, reply) {
    if (!request.currentAccount || !request.currentSessionId) {
      reply.code(401).send({
        code: 'session_expired',
        message: 'Your session has expired. Please sign in again.',
      });
    }
  });

  app.addHook('preHandler', async (request) => {
    const sessionId = request.cookies.perchlink_session;

    request.currentAccount = null;
    request.currentSessionId = null;

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
