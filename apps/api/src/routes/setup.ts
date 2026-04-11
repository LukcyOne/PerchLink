import type { FastifyInstance, FastifyReply } from 'fastify';
import { hash } from 'bcryptjs';
import { ulid } from 'ulid';
import { z } from 'zod';

const setupBodySchema = z.object({
  account: z.string().trim().min(3).max(64),
  password: z.string().min(8).max(128),
});

function setSessionCookie(reply: FastifyReply, sessionId: string) {
  reply.setCookie('perchlink_session', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function registerSetupRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/setup/status', async () => {
    const row = app.db.prepare('SELECT COUNT(*) AS total FROM accounts').get() as { total: number };

    return {
      setup_open: row.total === 0,
    };
  });

  app.post('/api/setup', async (request, reply) => {
    const accountsRow = app.db.prepare('SELECT COUNT(*) AS total FROM accounts').get() as { total: number };

    if (accountsRow.total > 0) {
      reply.code(409).send({
        code: 'setup_closed',
        message: 'The remote account is already set up. Please sign in.',
      });
      return;
    }

    const input = setupBodySchema.parse(request.body);
    const now = new Date().toISOString();
    const accountId = ulid();
    const sessionId = ulid();
    const passwordHash = await hash(input.password, 10);

    app.db.transaction(() => {
      app.db
        .prepare(
          `
            INSERT INTO accounts (id, account_name, password_hash, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
          `,
        )
        .run(accountId, input.account, passwordHash, now, now);

      app.db
        .prepare(
          `
            INSERT INTO sessions (id, account_id, created_at, expires_at, revoked_at)
            VALUES (?, ?, ?, ?, NULL)
          `,
        )
        .run(sessionId, accountId, now, new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString());
    })();

    setSessionCookie(reply, sessionId);

    return {
      account: {
        id: accountId,
        account_name: input.account,
      },
      setup_open: false,
    };
  });
}
