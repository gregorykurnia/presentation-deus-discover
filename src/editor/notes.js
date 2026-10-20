// Speaker notes drawer (edit.html, along the bottom), as an editor plugin (see
// editor.js): the current slide's notes (api.current) in a plain text box.
// Typing is a live edit (the slide's data-notes and the autosave follow at once);
// leaving the box, or moving to another slide, makes it one undo step.
import { setNotes, slideLabel } from '../model.js';

/** "Slide 2", "Slide A3", "Appendix divider", "Hidden slide". */
function nameOf(label) {
  if (!label) return 'Hidden slide';
  return label === 'A' ? 'Appendix divider' : `Slide ${label}`;
}

export function notesPlugin(api) {
  const drawer = api.drawer;
  const doc = drawer.ownerDocument;
  const h = (tag, attrs = {}, ...children) => {
    const node = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    node.append(...children);
    return node;
  };

  const where = h('span', { class: 'ed-notes__slide' });
  const toggle = h('button', { type: 'button', class: 'ed-notes__toggle', 'aria-expanded': 'true', 'aria-controls': 'ed-notes-text' }, 'Hide');
  const box = h('textarea', {
    id: 'ed-notes-text',
    class: 'ed-notes__text',
    rows: '3',
    placeholder: 'What to say on this slide. Only you see it: press N while presenting.',
  });
  drawer.append(
    h('div', { class: 'ed-notes__head' },
      h('label', { class: 'ed-notes__title', for: 'ed-notes-text' }, 'Speaker notes'),
      where,
      h('span', { class: 'ed-notes__hint' }, 'Press N while presenting to see them'),
      toggle),
    box,
  );
  drawer.hidden = false;

  let shownId = null;
  let typed = false; // live edits not yet made an undo step

  function show() {
    const { deck } = api;
    const slide = deck.slides.find((s) => s.id === api.current);
    shownId = slide?.id ?? null;
    where.textContent = slide ? nameOf(slideLabel(deck, slide.id)) : '';
    const notes = slide?.notes ?? '';
    if (box.value !== notes) box.value = notes; // e.g. after an undo
    box.disabled = !slide;
  }

  function commit() {
    if (!typed) return;
    typed = false;
    api.commit();
  }

  box.addEventListener('input', () => {
    if (!shownId) return;
    typed = true;
    api.edit(setNotes(api.deck, shownId, box.value));
  });
  box.addEventListener('blur', commit);

  toggle.addEventListener('click', () => {
    const collapsed = drawer.classList.toggle('is-collapsed');
    toggle.textContent = collapsed ? 'Show' : 'Hide';
    toggle.setAttribute('aria-expanded', String(!collapsed));
  });

  api.onCurrent(() => {
    commit(); // the notes typed for the previous slide are one undo step
    show();
  });
  api.onChange(show);
  show();
}
