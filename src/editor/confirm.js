// An in-page confirmation for the editor (a modal <dialog>, never window.confirm()).
//   const ask = createConfirm(doc);
//   await ask({ title, text, confirmLabel }) -> true (confirmed) | false (Cancel, Escape)
// Styles: .ed-confirm in src/styles/editor.css.

export function createConfirm(doc) {
  const make = (tag, attrs, text = '') => {
    const node = doc.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    node.textContent = text;
    return node;
  };
  const title = make('h2', { class: 'ed-confirm__title', id: 'ed-confirm-title' });
  const text = make('p', { class: 'ed-confirm__text', id: 'ed-confirm-text' });
  // method="dialog": each button closes the dialog with its value as returnValue.
  const cancel = make('button', { value: 'cancel', class: 'ed-btn', autofocus: '' }, 'Cancel');
  const confirm = make('button', { value: 'confirm', class: 'ed-btn ed-btn--danger' });
  const form = make('form', { method: 'dialog', class: 'ed-confirm__actions' });
  form.append(cancel, confirm);
  const dialog = make('dialog', { class: 'ed-confirm', 'aria-labelledby': 'ed-confirm-title', 'aria-describedby': 'ed-confirm-text' });
  dialog.append(title, text, form);
  doc.body.append(dialog);

  return function ask(opts) {
    title.textContent = opts.title;
    text.textContent = opts.text;
    confirm.textContent = opts.confirmLabel;
    dialog.returnValue = '';
    dialog.showModal();
    return new Promise((resolve) => {
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true });
    });
  };
}
