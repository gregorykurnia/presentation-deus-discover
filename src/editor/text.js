// Inline text editing for the [data-field] elements of edit-mode slides, and the
// overflow warning. Text is plain: no formatting, no line breaks, pasted HTML
// becomes its plain text. While a field has focus its placeholder marks and
// symbol glyphs are unwrapped to plain characters (so the caret never lands in
// a hidden overlay); the editor redraws them when the field loses focus.

const FIELD = '[data-field][contenteditable]';

/** Makes every text field of a rendered slide editable. */
export function makeEditable(slideEl) {
  for (const el of slideEl.querySelectorAll('[data-field]')) {
    el.setAttribute('contenteditable', 'plaintext-only');
    el.setAttribute('spellcheck', 'true');
  }
  return slideEl;
}

/** The field's text as stored in the deck: line breaks and no-break spaces become spaces. */
export function fieldText(el) {
  return el.textContent.replace(/[\n\r ]/g, ' ');
}

/** Replaces placeholder marks and symbol glyphs with their plain characters. */
function unwrapDecorations(el) {
  el.querySelectorAll('.glyph').forEach((g) => g.replaceWith(g.getAttribute('aria-label') ?? ''));
  el.querySelectorAll('mark.ph').forEach((m) => m.replaceWith(m.textContent));
  el.normalize();
}

/**
 * Overflow check, the same rule as scripts/qa.js inspectSlides(): a [data-fit] box
 * overflows when its content is more than 1px taller or wider than the box.
 * Toggles .fits-error on each box; returns the number of boxes that overflow.
 * Text is never shrunk to fit.
 */
export function checkFit(slideEl, tol = 1) {
  let count = 0;
  for (const box of slideEl.querySelectorAll('[data-fit]')) {
    const over = box.scrollHeight - box.clientHeight > tol || box.scrollWidth - box.clientWidth > tol;
    box.classList.toggle('fits-error', over);
    if (over) count += 1;
  }
  return count;
}

function insertPlainText(text) {
  // execCommand keeps the caret where the user expects and fires `input`.
  if (document.execCommand('insertText', false, text)) return;
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
  node.parentElement.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
}

/**
 * Wires text editing on a container of slides (event delegation, so re-rendered
 * slides need no re-wiring).
 *   onInput(el, value)  a field's text changed (every keystroke)
 *   onCommit(el)        a field lost focus
 *   onHistory('undo' | 'redo')  the browser's own undo/redo was asked for (Edit menu)
 */
export function attachTextEditing(container, { onInput, onCommit, onHistory }) {
  const fieldOf = (target) => target?.closest?.(FIELD);

  container.addEventListener('focusin', (e) => {
    const el = fieldOf(e.target);
    if (el) unwrapDecorations(el);
  });

  container.addEventListener('focusout', (e) => {
    const el = fieldOf(e.target);
    if (el) onCommit(el);
  });

  container.addEventListener('input', (e) => {
    const el = fieldOf(e.target);
    if (el) onInput(el, fieldText(el));
  });

  container.addEventListener('beforeinput', (e) => {
    if (!fieldOf(e.target)) return;
    if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') e.preventDefault();
    if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') {
      e.preventDefault();
      onHistory(e.inputType === 'historyUndo' ? 'undo' : 'redo');
    }
  });

  container.addEventListener('keydown', (e) => {
    const el = fieldOf(e.target);
    if (el && (e.key === 'Enter' || e.key === 'Escape')) {
      e.preventDefault();
      el.blur();
    }
  });

  container.addEventListener('paste', (e) => {
    if (!fieldOf(e.target)) return;
    e.preventDefault();
    const text = (e.clipboardData?.getData('text/plain') ?? '').replace(/\s*[\r\n]+\s*/g, ' ');
    if (text) insertPlainText(text);
  });
}
