import type { FastifyInstance, FastifyReply } from 'fastify';
import { compare } from 'bcryptjs';
import { ulid } from 'ulid';
import { z } from 'zod';

const signInBodySchema = z.object({
  account: z.string().trim().min(1),
  password: z.string().min(1),
});

interface AccountRow {
  id: string;
  account_name: string;
  password_hash: string;
}

function setSessionCookie(reply: FastifyReply, sessionId: string) {
  reply.setCookie('perchlink_session', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie('perchlink_session', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  });
}

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  app.post('/api/auth/sign-in', async (request, reply) => {
    const input = signInBodySchema.parse(request.body);
    const account = app.db
      .prepare(
        `
          SELECT id, account_name, password_hash
          FROM accounts
          WHERE account_name = ?
        `,
      )
      .get(input.account) as AccountRow | undefined;

    if (!account || !(await compare(input.password, account.password_hash))) {
      reply.code(401).send({
        code: 'invalid_credentials',
        message: 'The account or password is incorrect. Try again.',
      });
      return;
    }

    const sessionId = ulid();
    const now = new Date().toISOString();
    app.db
      .prepare(
        `
          INSERT INTO sessions (id, account_id, created_at, expires_at, revoked_at)
          VALUES (?, ?, ?, ?, NULL)
        `,
      )
      .run(sessionId, account.id, now, new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString());

    setSessionCookie(reply, sessionId);

    return {
      account: {
        id: account.id,
        account_name: account.account_name,
      },
      setup_open: false,
    };
  });

  app.post('/api/auth/sign-out', async (request, reply) => {
    const sessionId = request.cookies.perchlink_session;

    if (sessionId) {
      app.db
        .prepare(
          `
            UPDATE sessions
            SET revoked_at = ?
            WHERE id = ?
          `,
        )
        .run(new Date().toISOString(), sessionId);
    }

    clearSessionCookie(reply);

    return {
      signed_out: true,
    };
  });

  app.get('/api/auth/session', async (request, reply) => {
    if (!request.currentAccount) {
      const accountCount = app.db.prepare('SELECT COUNT(*) AS total FROM accounts').get() as { total: number };
      reply.code(401).send({
        code: 'session_expired',
        message: 'Your session has expired. Please sign in again.',
        setup_open: accountCount.total === 0,
      });
      return;
    }

    return {
      account: {
        id: request.currentAccount.id,
        account_name: request.currentAccount.accountName,
      },
      setup_open: false,
    };
  });
}
