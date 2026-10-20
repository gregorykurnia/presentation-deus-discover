const SHOW_PLACEHOLDER_HIGHLIGHT = globalThis.SHOW_PLACEHOLDER_HIGHLIGHT ?? true;
// Entry for present.html (and the offline deck.html built from it).
//   present.html                -> the deck bundled from content/deck.json
//   present.html?source=draft   -> the editor's saved draft from the dev server (Preview, Ruling R3);
//                                  the bundled deck is then never loaded.
import { startPresenter } from './presenter.js';

async function loadDeck(params) {
  if (params.get('source') === 'draft') {
    const res = await fetch('/__deck', { cache: 'no-store' });
    if (!res.ok) throw new Error(`Could not load the draft (${res.status}). Preview needs the dev server: npm run dev.`);
    return (await res.json()).deck;
  }
  return (await import('../../content/deck.json')).default;
}

const root = document.getElementById('deck-root');
loadDeck(new URLSearchParams(location.search))
  .then((deck) => startPresenter(deck, root, { highlight: SHOW_PLACEHOLDER_HIGHLIGHT }))
  .catch((err) => {
    root.textContent = err.message;
    root.className = 'load-error';
    throw err;
  });
