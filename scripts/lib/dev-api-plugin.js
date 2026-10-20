// Dev-only Vite plugin for `npm run dev:server` (VITE_STORE=server): mounts the same
// server/http.js handle() the Vercel function uses at /api/*. Plain `npm run dev` and
// `npm run edit` don't set VITE_STORE, so this plugin then does nothing.
//   DB:    PGlite kept in .data/pglite (gitignored), or in memory with DEV_DB=memory.
//   Mail:  always the console mailer (codes print in the terminal); with MAIL_LOG set,
//          each code is also appended to that file as "<email> <code>" (the e2e reads it).
//   Env:   .env / .env.local and the shell; OWNER_EMAIL and AUTH_SECRET have dev defaults.
//   POST /api/upload-local  raw bytes, for an editor session: saved to UPLOAD_DIR with
//                           the Phase 2 /__upload checks (dev-store-plugin.js).
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';
import { createPgliteDb } from '../../server/db.js';
import { handle, parseCookies } from '../../server/http.js';
import { createMailer } from '../../server/mailer.js';
import { createDeckHandlers, MAX_UPLOAD_BYTES, readBody, storePaths } from './dev-store-plugin.js';

const DEV_OWNER = 'gregory.kurnia@deushcs.com';
const DEV_SECRET = 'dev-only-secret-not-for-production';
const MAX_JSON_BYTES = 5 * 1024 * 1024;

function openDb(root, env) {
  if (env.DEV_DB === 'memory') return createPgliteDb();
  const dataDir = resolve(root, '.data/pglite');
  mkdirSync(dataDir, { recursive: true });
  return createPgliteDb(dataDir);
}

function send(res, { status, headers, body }) {
  res.statusCode = status;
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end(body);
}

export function devApiPlugin() {
  return {
    name: 'deus-dev-api',
    apply: 'serve',
    configureServer(server) {
      if (process.env.VITE_STORE !== 'server') return;
      const root = server.config.root;
      const logger = server.config.logger;
      const fileEnv = loadEnv(server.config.mode, root, '');
      const env = {
        ...fileEnv,
        OWNER_EMAIL: fileEnv.OWNER_EMAIL || DEV_OWNER,
        AUTH_SECRET: fileEnv.AUTH_SECRET || DEV_SECRET,
        MAIL_LOG: fileEnv.MAIL_LOG ? resolve(root, fileEnv.MAIL_LOG) : '',
        RESEND_API_KEY: '', // local runs never send real email
        NODE_ENV: 'development',
      };
      const dbReady = openDb(root, env);
      dbReady.catch((err) => logger.error(`  dev api: database failed to start: ${err.message}`));
      server.httpServer?.on('close', () => dbReady.then((db) => db.close(), () => {}));
      const { upload } = createDeckHandlers(storePaths(root));
      const mailer = createMailer(env, (line) => logger.info(`  ${line}`));
      logger.info(`  dev api: /api/* (owner ${env.OWNER_EMAIL}, database ${env.DEV_DB === 'memory' ? 'in memory' : '.data/pglite'})`);

      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/')) return next();
        const path = req.url.split('?')[0];
        try {
          const limit = path === '/api/upload-local' ? MAX_UPLOAD_BYTES : MAX_JSON_BYTES;
          const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req, limit);
          const ctx = { db: await dbReady, env, mailer, now: () => new Date(), localUpload: upload };
          return send(res, await handle(ctx, {
            method: req.method, path, headers: req.headers, body, cookies: parseCookies(req.headers.cookie),
          }));
        } catch (err) {
          if (!err.status) logger.error(`  dev api: ${err.stack ?? err}`);
          const message = err.status ? err.message : 'Something went wrong. Please try again.';
          return send(res, {
            status: err.status ?? 500,
            headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
            body: JSON.stringify({ error: message }),
          });
        }
      });
    },
  };
}
