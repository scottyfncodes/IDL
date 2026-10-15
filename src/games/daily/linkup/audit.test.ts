import { addDays, LAUNCH_DATE } from '../../../lib/date';
import published from './published.json';
import { POOL } from './content';
import { puzzleFor, wordKey } from './logic';
import { crossFits, familiesOf, fingerprint, nearDuplicateGroups, REVIEWED_RED_HERRINGS } from './audit';

const sorted = (w: string) => [...wordKey(w).replace(/[^A-Z]/g, '')].sort().join('');

describe('linkup content audit', () => {
  it('never changes a puzzle that has already shipped', () => {
    expect(published.puzzles.length).toBeGreaterThanOrEqual(84);
    published.puzzles.forEach((line, i) => expect(fingerprint(POOL[i])).toBe(line));
  });

  it('keeps every shipped date on the same puzzle as the pool grows', () => {
    for (let i = 0; i < published.puzzles.length; i++) {
      const date = addDays(LAUNCH_DATE, i);
      expect(puzzleFor(POOL, date).id).toBe(`L${String(i + 1).padStart(3, '0')}`);
    }
    // Spot-checks of real archive dates.
    expect(puzzleFor(POOL, '2026-09-01').id).toBe('L001');
    expect(puzzleFor(POOL, '2026-10-14').id).toBe('L044');
    expect(puzzleFor(POOL, '2026-11-23').id).toBe('L084');
  });

  it('has a runway of at least 180 puzzles', () => {
    expect(POOL.length).toBeGreaterThanOrEqual(180);
  });

  it('has no word that also fits another group in the same puzzle, unless reviewed', () => {
    const hits = crossFits(POOL).map((c) => `${c.puzzle}:${c.word}`);
    const unreviewed = crossFits(POOL).filter((c) => !REVIEWED_RED_HERRINGS[`${c.puzzle}:${c.word}`]);
    expect(unreviewed).toEqual([]);
    // Every allowlist entry still corresponds to a real hit (no stale entries).
    for (const key of Object.keys(REVIEWED_RED_HERRINGS)) expect(hits).toContain(key);
  });

  it('has no near-duplicate groups anywhere in the pool', () => {
    expect(nearDuplicateGroups(POOL)).toEqual([]);
  });

  it('keeps labels distinct within a puzzle and varied across the pool', () => {
    const uses = new Map<string, number>();
    for (const p of POOL) {
      const labels = p.groups.map((g) => g.label.toLowerCase());
      expect(new Set(labels).size).toBe(4);
      // Two groups from the same broad family in one puzzle invite confusion.
      const fams = p.groups.flatMap((g) => familiesOf(g.label));
      expect(new Set(fams).size, `${p.id} repeats a category family`).toBe(fams.length);
      for (const l of labels) uses.set(l, (uses.get(l) ?? 0) + 1);
    }
    const overused = [...uses].filter(([, n]) => n > 2).map(([l, n]) => `${l} ×${n}`);
    expect(overused).toEqual([]);
  });

  it('uses only clean uppercase words', () => {
    for (const p of POOL) for (const g of p.groups) for (const w of g.words) expect(w, `${p.id} ${w}`).toMatch(/^[A-Z][A-Z '-]*[A-Z]$/);
  });

  it('verifies the wordplay that can be checked mechanically', () => {
    for (const p of POOL)
      for (const g of p.groups) {
        const anagram = /^Anagrams of ([A-Z]{2,})$/.exec(g.label); // "Anagrams of POST" (a literal word)
        if (anagram) for (const w of g.words) expect(sorted(w), `${p.id} ${w}`).toBe(sorted(anagram[1]));
        if (/^Palindromes$/i.test(g.label)) for (const w of g.words) expect([...w].reverse().join(''), `${p.id} ${w}`).toBe(w);
        const letters = (w: string) => wordKey(w).replace(/[^A-Z]/g, '');
        if (/^Letters in alphabetical order$/i.test(g.label))
          for (const w of g.words) expect(letters(w), `${p.id} ${w}`).toBe([...letters(w)].sort().join(''));
        if (/^Contain every vowel$/i.test(g.label))
          for (const w of g.words) for (const v of 'AEIOU') expect(letters(w), `${p.id} ${w}`).toContain(v);
        if (/^No A, E, I, O or U$/i.test(g.label)) for (const w of g.words) expect(letters(w), `${p.id} ${w}`).not.toMatch(/[AEIOU]/);
        if (/three alphabet letters in a row/i.test(g.label))
          for (const w of g.words) {
            const l = letters(w);
            const run = [...l].some((c, i) => i + 2 < l.length && l.charCodeAt(i + 1) === c.charCodeAt(0) + 1 && l.charCodeAt(i + 2) === c.charCodeAt(0) + 2);
            expect(run, `${p.id} ${w}`).toBe(true);
          }
        const silent = /^Silent ([A-Z])$/.exec(g.label);
        if (silent) for (const w of g.words) expect(letters(w), `${p.id} ${w}`).toContain(silent[1]);
        const hidden = /^Hidden (\w+)$/i.exec(g.label);
        if (hidden) for (const w of g.words) expect(w.length, `${p.id} hidden word ${w} must be longer than what it hides`).toBeGreaterThan(3);
      }
  });
});
