// Offline build: one self-contained deck.html (inline CSS, JS, deck content, font as a
// data: URI) that works from file://, plus dist/offline/ (deck.html + only the
// referenced images that exist) as a copy-to-USB bundle.
//
//   npm run export:offline [-- --source local|published]
//
// Approach: Vite's programmatic build() of present.html (kept in memory, nothing
// written by Vite), then a small inline step below. vite-plugin-singlefile was not
// added: the step is ~20 lines and keeps the first classic <script> (the readable
// SHOW_PLACEHOLDER_HIGHLIGHT flag, Ruling R1a) exactly as authored.
import { build } from 'vite';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nullMissingSrcs, startsWithFlagScript } from './lib/offline-transform.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'dist', 'offline');

/** Asset paths used by code rather than deck.json (kept in sync with src/layouts/common.js). */
const CODE_ASSETS = ['assets/logo-mark-wordmark-dark.svg'];

function parseArgs(argv) {
  const i = argv.indexOf('--source');
  const eq = argv.find((a) => a.startsWith('--source='));
  return { source: eq ? eq.slice('--source='.length) : i >= 0 ? argv[i + 1] : 'local' };
}

/** Every image/video/poster `src` string in the deck JSON. */
function deckSrcs(deck) {
  const found = [];
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    if (typeof o.src === 'string') found.push(o.src);
    Object.values(o).forEach(walk);
  };
  walk(deck);
  return found;
}

/** Ruling R3: repo-relative srcs whose file is not on disk become null in the built deck (content/deck.json is untouched). */
function nullMissingAssets() {
  return {
    name: 'deus-null-missing-assets',
    enforce: 'pre', // run before Vite's JSON plugin turns the file into a JS module
    transform(code, id) {
      if (!id.split('?')[0].endsWith(`${join('content', 'deck.json')}`)) return null;
      const deck = JSON.parse(code);
      nullMissingSrcs(deck, (p) => existsSync(join(root, p)));
      return { code: JSON.stringify(deck), map: null };
    },
  };
}

/** Escapes text placed inside an inline <script>/<style> so it cannot close the tag early. */
const safeInline = (s, tag) => s.replace(new RegExp(`</(${tag})`, 'gi'), '<\\/$1');

async function buildHtml() {
  const result = await build({
    root,
    configFile: false,
    logLevel: 'warn',
    plugins: [nullMissingAssets()],
    build: {
      write: false,
      assetsInlineLimit: 100_000_000, // DM Sans woff2 becomes a data: URI
      cssCodeSplit: false,
      modulePreload: false,
      // present.js loads the deck with import() (so ?source=draft never fetches it);
      // inlined here so the offline file stays one script.
      rollupOptions: { input: join(root, 'present.html'), output: { codeSplitting: false } },
    },
  });
  const files = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output);
  const htmlFile = files.find((f) => f.fileName.endsWith('.html'));
  let html = String(htmlFile.source);
  const byName = new Map(files.map((f) => [f.fileName, f]));
  const lookup = (href) => byName.get(href.replace(/^\.?\//, ''));

  html = html.replace(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (m, href) => {
    const css = lookup(href);
    return css ? `<style>\n${safeInline(String(css.source), 'style')}\n  </style>` : m;
  });
  html = html.replace(/<script\b[^>]*type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (m, src) => {
    const js = lookup(src);
    return js ? `<script type="module">\n${safeInline(js.code, 'script')}\n  </script>` : m;
  });
  html = html.replace(/\s*<link\b[^>]*rel="modulepreload"[^>]*>/g, '');

  const leftover = html.match(/<(script|link)\b[^>]*(src|href)="(?!data:|#)[^"]*"/);
  if (leftover) throw new Error(`deck.html still references an external file: ${leftover[0]}`);
  if (!startsWithFlagScript(html)) {
    throw new Error('first <script> must be the classic SHOW_PLACEHOLDER_HIGHLIGHT flag script (R1a)');
  }
  return html;
}

async function main() {
  const { source } = parseArgs(process.argv.slice(2));
  if (source === 'published') {
    console.error('--source published is available after Phase 3 (Task 12)');
    process.exit(1);
  }
  if (source !== 'local') {
    console.error(`unknown --source "${source}" (expected local)`);
    process.exit(1);
  }

  const deck = JSON.parse(readFileSync(join(root, 'content', 'deck.json'), 'utf8'));
  const html = await buildHtml();

  const assets = [...new Set([...CODE_ASSETS, ...deckSrcs(deck)])].filter((p) => existsSync(join(root, p)));

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(join(outDir, 'assets'), { recursive: true });
  writeFileSync(join(outDir, 'deck.html'), html);
  for (const p of assets) {
    mkdirSync(dirname(join(outDir, p)), { recursive: true });
    cpSync(join(root, p), join(outDir, p));
  }
  writeFileSync(join(root, 'deck.html'), html);

  const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
  console.log(`deck.html: ${kb(statSync(join(root, 'deck.html')).size)} (repo root, committed)`);
  console.log(`dist/offline/: deck.html + ${assets.length} assets`);
  for (const p of assets) console.log(`  ${p}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
