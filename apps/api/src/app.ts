import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import type { RemoteDatabase } from './db/client.js';
import { registerAuthSession } from './plugins/authSession.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerBookmarkRoutes } from './routes/bookmarks.js';
import { registerCategoryRoutes } from './routes/categories.js';
import { registerCollectionRoutes } from './routes/collections.js';
import { registerSetupRoutes } from './routes/setup.js';

export async function buildApp(db: RemoteDatabase) {
  const app = Fastify({
    logger: false,
  });

  app.decorate('db', db);
  await app.register(cookie);
  await registerAuthSession(app);
  await registerSetupRoutes(app);
  await registerAuthRoutes(app);
  await registerBookmarkRoutes(app);
  await registerCategoryRoutes(app);
  await registerCollectionRoutes(app);

  return app;
}
