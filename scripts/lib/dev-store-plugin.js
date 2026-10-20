// Dev-only Vite plugin behind src/store/local.js (Ruling R1). The draft is a file:
// content/deck.json, or the file named by the DECK_FILE env variable. Uploads go
// to assets/uploads/, or to the UPLOAD_DIR env directory (served at the same
// /assets/uploads/ URLs). The e2e specs point both at temp paths.
//   GET  /__deck    -> { deck, locked: false, role: 'editor', hash }
//   PUT  /__deck    { deck, expectedRev, expectedHash } -> { rev, hash }
//                   409 when the file's rev differs, or when its content is not the
//                   one the editor was served or last wrote (hash): an edit made
//                   outside the editor (Claude Code, git, by hand) is never overwritten.
// The deck file is left out of Vite's hot updates: a save never reloads open pages
// (present.html in dev reads the deck from GET /__deck, not as a module).
//   POST /__upload  raw bytes, content-type image/jpeg|png|webp or video/mp4
//                   -> { src: 'assets/uploads/<content-hash>.<ext>' }
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { validateDeck } from '../../src/model.js';

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4' };
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;
const UPLOAD_URL = '/assets/uploads/';

/** The draft file and the upload directory, from the env overrides or the defaults. */
export function storePaths(root, env = process.env) {
  return {
    deckFile: resolve(root, env.DECK_FILE || 'content/deck.json'),
    uploadDir: resolve(root, env.UPLOAD_DIR || 'assets/uploads'),
  };
}

/**
 * The uploaded file a /assets/uploads/<name> URL path names in uploadDir:
 * { file, type }, or null for other paths, missing files and paths that would
 * leave uploadDir.
 */
export function uploadedFile(uploadDir, urlPath) {
  if (!urlPath.startsWith(UPLOAD_URL)) return null;
  let name;
  try { name = decodeURIComponent(urlPath.slice(UPLOAD_URL.length)); } catch { return null; }
  const dir = resolve(uploadDir);
  const file = resolve(dir, name);
  if (!name || !file.startsWith(dir + sep) || !existsSync(file) || !statSync(file).isFile()) return null;
  const ext = file.slice(file.lastIndexOf('.') + 1).toLowerCase();
  const type = Object.keys(EXTENSIONS).find((t) => EXTENSIONS[t] === ext) ?? 'application/octet-stream';
  return { file, type };
}

/** The content hash of the deck file's text (sha256, hex). */
export const hashOf = (text) => createHash('sha256').update(text).digest('hex');

/** The request handlers as plain functions: each returns { status, json }. */
export function createDeckHandlers({ deckFile, uploadDir, uploadPrefix = 'assets/uploads/' }) {
  const read = () => {
    const text = readFileSync(deckFile, 'utf8');
    return { deck: JSON.parse(text), hash: hashOf(text) };
  };
  return {
    getDeck() {
      const { deck, hash } = read();
      return { status: 200, json: { deck, locked: false, role: 'editor', hash } };
    },

    putDeck(body) {
      const { deck, expectedRev, expectedHash } = body ?? {};
      const { deck: current, hash } = read();
      if (current.rev !== expectedRev || hash !== expectedHash) {
        return { status: 409, json: { error: 'conflict', rev: current.rev } };
      }
      const errors = validateDeck(deck);
      if (errors.length) return { status: 400, json: { errors } };
      const rev = expectedRev + 1;
      const { id, rev: _old, ...rest } = deck;
      // Pretty-printed with id and rev first, like the seed: edits are readable git diffs.
      const text = `${JSON.stringify({ id: id ?? current.id, rev, ...rest }, null, 2)}\n`;
      const tmp = `${deckFile}.tmp`;
      writeFileSync(tmp, text);
      renameSync(tmp, deckFile); // atomic: a reader never sees half a file
      return { status: 200, json: { rev, hash: hashOf(text) } };
    },

    upload(bytes, contentType) {
      const ext = EXTENSIONS[String(contentType).split(';')[0].trim()];
      if (!ext) return { status: 415, json: { error: 'Please use a JPG, PNG or WebP image (or an MP4 video).' } };
      const name = `${createHash('sha256').update(bytes).digest('hex').slice(0, 16)}.${ext}`;
      mkdirSync(uploadDir, { recursive: true });
      const file = join(uploadDir, name);
      if (!existsSync(file)) writeFileSync(file, bytes);
      return { status: 200, json: { src: `${uploadPrefix}${name}` } };
    },
  };
}

/** The request body as a Buffer; rejects with status 413 past limit bytes. */
export function readBody(req, limit) {
  return new Promise((ok, fail) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        fail(Object.assign(new Error('File is too large.'), { status: 413 }));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => ok(Buffer.concat(chunks)));
    req.on('error', fail);
  });
}

function send(res, { status, json }) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(json));
}

export function devStorePlugin() {
  let deckFile = null;
  return {
    name: 'deus-dev-store',
    apply: 'serve',
    configResolved(config) {
      ({ deckFile } = storePaths(config.root));
    },
    // Each save rewrites the deck file. Were it a module (content/deck.json imported by
    // present.js), Vite would reload every open tab, the editor too, mid-typing.
    hotUpdate({ file }) {
      if (deckFile && resolve(file) === deckFile) return [];
      return undefined;
    },
    configureServer(server) {
      const root = server.config.root;
      const { uploadDir } = storePaths(root);
      // Vite serves assets/uploads/ itself; another upload dir is served here at the same URLs.
      const ownUploadDir = uploadDir !== resolve(root, 'assets/uploads');
      const api = createDeckHandlers({ deckFile, uploadDir });
      server.config.logger.info(`  deck draft: ${deckFile}`);
      if (ownUploadDir) server.config.logger.info(`  uploads: ${uploadDir}`);
      if (!existsSync(dirname(deckFile))) mkdirSync(dirname(deckFile), { recursive: true });

      server.middlewares.use(async (req, res, next) => {
        const path = req.url.split('?')[0];
        try {
          if (path === '/__deck' && req.method === 'GET') return send(res, api.getDeck());
          if (path === '/__deck' && req.method === 'PUT') {
            const body = JSON.parse((await readBody(req, MAX_UPLOAD_BYTES)).toString('utf8'));
            return send(res, api.putDeck(body));
          }
          if (path === '/__upload' && req.method === 'POST') {
            return send(res, api.upload(await readBody(req, MAX_UPLOAD_BYTES), req.headers['content-type']));
          }
          const uploaded = ownUploadDir && req.method === 'GET' && uploadedFile(uploadDir, path);
          if (uploaded) {
            res.setHeader('content-type', uploaded.type);
            res.setHeader('cache-control', 'no-store');
            return createReadStream(uploaded.file).pipe(res);
          }
        } catch (err) {
          const status = err.status ?? (err instanceof SyntaxError ? 400 : 500);
          return send(res, { status, json: { error: err.message } });
        }
        return next();
      });
    },
  };
}
