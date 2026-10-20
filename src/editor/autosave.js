// Debounced autosave of the draft. One save runs at a time; changes made while
// it runs are saved right after it. A ConflictError stops saving for good (the
// editor asks for a reload). A refusal (an error with a 4xx .status: the deck
// itself was not accepted) is not retried: the next change tries again. Any other
// error (network, 5xx) retries after a pause.
//   onStatus({ state: 'pending' | 'saving' | 'saved' | 'error' | 'failed' | 'conflict', error })
import { ConflictError } from '../store/errors.js';

export function createAutosave({ save, rev, delay = 800, retryDelay = 4000, onStatus = () => {} }) {
  let pending = null;
  let timer = null;
  let running = null;
  let stopped = false;
  const status = (state, error = null) => onStatus({ state, error });

  async function run() {
    while (pending && !stopped) {
      const deck = pending;
      pending = null;
      status('saving');
      try {
        ({ rev } = await save(deck, rev));
      } catch (error) {
        pending ??= deck;
        if (error instanceof ConflictError) {
          stopped = true;
          status('conflict', error);
        } else if (error?.status >= 400 && error.status < 500) {
          status('failed', error); // retrying would be refused again
        } else {
          status('error', error);
          timer = setTimeout(flush, retryDelay);
        }
        return;
      }
    }
    if (!stopped) status('saved');
  }

  /** Saves now (cancelling the debounce); resolves when nothing is left to save or saving failed. */
  async function flush() {
    clearTimeout(timer);
    timer = null;
    while (running) await running;
    if (!pending || stopped) return;
    running = run();
    try {
      await running;
    } finally {
      running = null;
    }
  }

  return {
    /** Queues `deck` as the draft to save after `delay` ms of quiet. */
    schedule(deck) {
      pending = deck;
      if (stopped) return;
      status('pending');
      clearTimeout(timer);
      timer = setTimeout(flush, delay);
    },
    flush,
    get rev() { return rev; },
    /** True while a change has not reached the store yet. */
    get unsaved() { return pending !== null || running !== null; },
  };
}
