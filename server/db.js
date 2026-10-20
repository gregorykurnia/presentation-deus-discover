// The database interface every server module uses: db.query(text, params) -> Promise<row[]>.
import { readFileSync } from 'node:fs';
import { neon } from '@neondatabase/serverless';

const SCHEMA_URL = new URL('./schema.sql', import.meta.url);

/** Production: Neon over HTTP (one statement per call, so no transactions). */
export function createNeonDb(url) {
  const sql = neon(url);
  return { query: (text, params = []) => sql.query(text, params) };
}

/** Tests: an in-memory PGlite with the schema applied. */
export const createMemoryDb = () => createPgliteDb();

/** PGlite with the schema applied: in memory, or kept in dataDir (npm run dev:server). */
export async function createPgliteDb(dataDir) {
  const { PGlite } = await import('@electric-sql/pglite');
  const pg = new PGlite(dataDir);
  const db = { query: async (text, params = []) => (await pg.query(text, params)).rows, close: () => pg.close() };
  await migrate(db);
  return db;
}

/** Applies schema.sql, one statement at a time. Safe to run again. */
export async function migrate(db) {
  const statements = readFileSync(SCHEMA_URL, 'utf8').split(/^-- split\s*$/m);
  for (const statement of statements) {
    if (statement.trim()) await db.query(statement);
  }
}
