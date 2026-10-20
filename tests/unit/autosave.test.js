import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAutosave } from '../../src/editor/autosave.js';
import { ConflictError } from '../../src/store/errors.js';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(save) {
  const states = [];
  const autosave = createAutosave({ save, rev: 1, delay: 800, retryDelay: 4000, onStatus: ({ state }) => states.push(state) });
  return { autosave, states };
}

describe('createAutosave', () => {
  it('saves once after the quiet period with the latest deck and tracks rev', async () => {
    const save = vi.fn(async (deck, rev) => ({ rev: rev + 1 }));
    const { autosave, states } = setup(save);
    autosave.schedule({ n: 1 });
    autosave.schedule({ n: 2 });
    await vi.advanceTimersByTimeAsync(799);
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith({ n: 2 }, 1);
    expect(autosave.rev).toBe(2);
    expect(autosave.unsaved).toBe(false);
    expect(states.at(-1)).toBe('saved');
  });

  it('flush() saves right away', async () => {
    const save = vi.fn(async (deck, rev) => ({ rev: rev + 1 }));
    const { autosave } = setup(save);
    autosave.schedule({ n: 1 });
    await autosave.flush();
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('a change made during a save is saved after it, with the new rev', async () => {
    let finish;
    const save = vi.fn((deck, rev) => new Promise((ok) => { finish = () => ok({ rev: rev + 1 }); }));
    const { autosave } = setup(save);
    autosave.schedule({ n: 1 });
    const first = autosave.flush();
    autosave.schedule({ n: 2 });
    const second = autosave.flush();
    finish();
    await vi.advanceTimersByTimeAsync(0);
    finish();
    await Promise.all([first, second]);
    expect(save.mock.calls).toEqual([[{ n: 1 }, 1], [{ n: 2 }, 2]]);
  });

  it('a conflict stops saving and reports it', async () => {
    const save = vi.fn(async () => { throw new ConflictError(); });
    const { autosave, states } = setup(save);
    autosave.schedule({ n: 1 });
    await autosave.flush();
    expect(states.at(-1)).toBe('conflict');
    autosave.schedule({ n: 2 });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(autosave.unsaved).toBe(true);
  });

  it('other errors are retried', async () => {
    const save = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce({ rev: 2 });
    const { autosave, states } = setup(save);
    autosave.schedule({ n: 1 });
    await autosave.flush();
    expect(states.at(-1)).toBe('error');
    await vi.advanceTimersByTimeAsync(4000);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]).toEqual([{ n: 1 }, 1]);
    expect(states.at(-1)).toBe('saved');
  });
});
