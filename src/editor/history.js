// Undo/redo over whole-deck snapshots (decks are immutable, so snapshots are cheap).
// push(deck) records a new current deck and drops anything that could be redone;
// undo()/redo() return the deck to show, or null when there is nothing to do.

export function createHistory(limit = 50) {
  const past = [];
  const future = [];
  let present;

  return {
    push(deck) {
      if (deck === present) return;
      if (present !== undefined) past.push(present);
      if (past.length > limit) past.shift();
      present = deck;
      future.length = 0;
    },
    undo() {
      if (!past.length) return null;
      future.push(present);
      present = past.pop();
      return present;
    },
    redo() {
      if (!future.length) return null;
      past.push(present);
      present = future.pop();
      return present;
    },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },
  };
}
