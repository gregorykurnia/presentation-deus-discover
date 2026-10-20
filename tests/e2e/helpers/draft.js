// The editor e2e specs work on a temp copy of content/deck.json (Ruling R1):
// playwright.config.js starts the dev server with DECK_FILE pointing here, and
// each spec resets it, so tests never modify content/deck.json. Uploads go to
// UPLOAD_DIR (served at /assets/uploads/ by the dev plugin), never to assets/uploads/.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const DRAFT_FILE = join(root, '.e2e', 'deck.json');
export const UPLOAD_DIR = join(root, '.e2e', 'uploads');

export function resetDraft() {
  mkdirSync(dirname(DRAFT_FILE), { recursive: true });
  copyFileSync(join(root, 'content', 'deck.json'), DRAFT_FILE);
}

export const readDraft = () => JSON.parse(readFileSync(DRAFT_FILE, 'utf8'));

export function writeDraft(deck) {
  writeFileSync(DRAFT_FILE, `${JSON.stringify(deck, null, 2)}\n`);
}
