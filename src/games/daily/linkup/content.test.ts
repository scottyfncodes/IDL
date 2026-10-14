import { addDays, LAUNCH_DATE } from '../../../lib/date';
import { POOL } from './content';
import { MAX_WORD_LENGTH, puzzleFor, validatePuzzle, wordKey } from './logic';
import mod from './index';

describe('linkup content', () => {
  it('has a long runway of puzzles', () => {
    expect(POOL.length).toBeGreaterThanOrEqual(80);
  });

  it('every puzzle is valid', () => {
    const problems = POOL.flatMap(validatePuzzle);
    expect(problems).toEqual([]);
  });

  it.each(POOL.map((p) => [p.id, p] as const))('%s: 4 groups × 4 unique words, levels 0-3', (_id, p) => {
    expect(p.groups).toHaveLength(4);
    for (const g of p.groups) {
      expect(g.words).toHaveLength(4);
      expect(g.label.trim().length).toBeGreaterThan(0);
      for (const w of g.words) {
        expect(w.length).toBeLessThanOrEqual(MAX_WORD_LENGTH);
        expect(wordKey(w)).not.toBe(wordKey(g.label));
      }
    }
    const words = p.groups.flatMap((g) => g.words.map(wordKey));
    expect(new Set(words).size).toBe(16);
    expect(p.groups.map((g) => g.level).sort()).toEqual([0, 1, 2, 3]);
  });

  it('ids are unique and sequential', () => {
    POOL.forEach((p, i) => expect(p.id).toBe(`L${String(i + 1).padStart(3, '0')}`));
  });

  it('no two puzzles share the same set of words', () => {
    const sigs = POOL.map((p) => p.groups.flatMap((g) => g.words).sort().join());
    expect(new Set(sigs).size).toBe(POOL.length);
  });

  it('pins the puzzle for known dates (pool is append-only)', () => {
    expect(mod.getPuzzle(LAUNCH_DATE).id).toBe('L001');
    expect(mod.getPuzzle('2026-10-14').id).toBe('L044');
    expect(mod.getPuzzle('2026-10-14').groups[0].words).toEqual(['TENT', 'LANTERN', 'COMPASS', 'SLEEPING BAG']);
  });

  it('getPuzzle is deterministic and covers the whole pool before repeating', () => {
    expect(mod.getPuzzle('2026-10-14')).toEqual(mod.getPuzzle('2026-10-14'));
    const ids = new Set<string>();
    for (let i = 0; i < POOL.length; i++) ids.add(puzzleFor(POOL, addDays(LAUNCH_DATE, i)).id);
    expect(ids.size).toBe(POOL.length);
  });
});
