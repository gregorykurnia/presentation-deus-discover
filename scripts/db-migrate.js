// npm run db:migrate: applies server/schema.sql to DATABASE_URL and adds the starting
// editors (the owner is implicit, from OWNER_EMAIL). Safe to run again.
import { existsSync } from 'node:fs';
import { createNeonDb, migrate } from '../server/db.js';

const STARTING_EDITORS = [
  'gregory.kurnia@gmail.com',
  'thania.ferdinanto@deushcs.com',
  'audrey.wijaya@deushcs.com',
];

for (const file of ['.env.local', '.env']) {
  if (existsSync(file)) process.loadEnvFile(file);
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.');
  process.exit(1);
}

const db = createNeonDb(process.env.DATABASE_URL);
await migrate(db);
for (const email of STARTING_EDITORS) {
  await db.query('insert into editors (email) values ($1) on conflict (email) do nothing', [email]);
}
console.log('Database is up to date.');
