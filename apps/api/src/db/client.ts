import Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';

export type RemoteDatabase = Database.Database;

declare module 'fastify' {
  interface FastifyInstance {
    db: RemoteDatabase;
  }
}

export function createDatabase(databasePath: string): RemoteDatabase {
  const db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}
