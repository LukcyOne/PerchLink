import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createDatabase } from './db/client.js';
import { runMigrations } from './db/migrate.js';
import { buildApp } from './app.js';

const port = Number(process.env.PORT ?? '8787');
const databasePath = resolve(process.cwd(), process.env.PERCHLINK_REMOTE_DB_PATH ?? 'apps/api/.data/perchlink-remote.sqlite');

mkdirSync(dirname(databasePath), { recursive: true });

const db = createDatabase(databasePath);
runMigrations(db);

const app = await buildApp(db);

await app.listen({
  host: '0.0.0.0',
  port,
});
