// Errors shared by every store adapter (local now, Firebase in Phase 3).

export const CONFLICT_MESSAGE = 'Someone else changed this deck. Reload to see their changes.';

/** saveDraft() rejects with this when the stored draft's rev is not the expected one. */
export class ConflictError extends Error {
  constructor(message = CONFLICT_MESSAGE) {
    super(message);
    this.name = 'ConflictError';
  }
}
