import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RemoteDatabase } from './client.js';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

export function runMigrations(db: RemoteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set<string>(
    db.prepare('SELECT filename FROM schema_migrations ORDER BY filename').all().map((row) => String((row as { filename: string }).filename)),
  );

  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = readFileSync(join(migrationsDir, file), 'utf8');
    const now = new Date().toISOString();

    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (filename, applied_at) VALUES (?, ?)').run(file, now);
    })();
  }
}
