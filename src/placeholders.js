// Find and highlight [bracketed placeholders] in deck text.
// A placeholder is "[" + one or more characters (no brackets, no line breaks) + "]".
const PLACEHOLDER = /\[[^[\]\n]+\]/g;

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

/** Returns every placeholder in `text`, brackets included, in order. */
export function findPlaceholders(text) {
  return String(text ?? '').match(PLACEHOLDER) ?? [];
}

/**
 * Returns `text` HTML-escaped. When `enabled`, each placeholder is wrapped in
 * <mark class="ph">. Escaping never touches brackets, so marking after escaping
 * finds the same placeholders.
 */
export function highlightPlaceholders(text, enabled) {
  const escaped = escapeHtml(String(text ?? ''));
  if (!enabled) return escaped;
  return escaped.replace(PLACEHOLDER, (match) => `<mark class="ph">${match}</mark>`);
}
