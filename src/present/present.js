const SHOW_PLACEHOLDER_HIGHLIGHT = globalThis.SHOW_PLACEHOLDER_HIGHLIGHT ?? true;
// Entry for present.html (and the offline deck.html built from it).
//   present.html                -> built (deck.html): the deck bundled from content/deck.json;
//                                  dev server: the draft from GET /__deck, so a save never
//                                  reloads open tabs (the deck file is not a module there)
//   present.html?source=draft   -> the editor's saved draft from the dev server (Preview, Ruling R3);
//                                  the bundled deck is then never loaded.
import { startPresenter } from './presenter.js';

async function loadDeck(params) {
  const draft = params.get('source') === 'draft';
  if (draft || import.meta.env.DEV) {
    const res = await fetch('/__deck', { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(draft
        ? `Could not load the draft (${res.status}). Preview needs the dev server: npm run dev.`
        : `Could not load the deck (${res.status}).`);
    }
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
