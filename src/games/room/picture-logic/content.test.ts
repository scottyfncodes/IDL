import { PICTURES_5, PICTURES_10 } from './content';
import { ALL_PUZZLES } from './puzzles';
import { deriveClues, isLineSolvable, parseBitmap, solveGrid } from './logic';

describe('picture logic: authored library', () => {
  it('has at least 100 pictures with unique ids and titles', () => {
    expect(PICTURES_5.length).toBeGreaterThanOrEqual(34);
    expect(PICTURES_10.length).toBeGreaterThanOrEqual(53);
    expect(ALL_PUZZLES.length).toBeGreaterThanOrEqual(100);
    expect(new Set(ALL_PUZZLES.map((p) => p.id)).size).toBe(ALL_PUZZLES.length);
    for (const set of [PICTURES_5, PICTURES_10]) expect(new Set(set.map((p) => p.title)).size).toBe(set.length);
  });

  it('keeps the original pictures first, in order (progress is stored by id)', () => {
    expect(PICTURES_5.slice(0, 3).map((p) => p.id)).toEqual(['s-heart', 's-house', 's-mug']);
    expect(PICTURES_5[18].id).toBe('s-hourglass');
    expect(PICTURES_10.slice(0, 3).map((p) => p.id)).toEqual(['l-heart', 'l-house', 'l-sailboat']);
    expect(PICTURES_10[22].id).toBe('l-bulb');
  });

  it('every bitmap is square and the right size', () => {
    for (const p of PICTURES_5) expect(p.rows.length === 5 && p.rows.every((r) => r.length === 5 && /^[#.]+$/.test(r))).toBe(true);
    for (const p of PICTURES_10) expect(p.rows.length === 10 && p.rows.every((r) => r.length === 10 && /^[#.]+$/.test(r))).toBe(true);
  });

  it('no two pictures share the same bitmap, and none is blank', () => {
    const keys = ALL_PUZZLES.map((p) => p.rows.join('/'));
    expect(new Set(keys).size).toBe(keys.length);
    for (const p of ALL_PUZZLES) expect(p.rows.join('')).toContain('#');
  });

  for (const p of [...PICTURES_5, ...PICTURES_10]) {
    it(`${p.id} (${p.title}) is uniquely solvable by line logic`, () => {
      const size = p.rows.length;
      const bm = parseBitmap(p.rows);
      const r = solveGrid(deriveClues(bm, size));
      expect(r.contradiction).toBe(false);
      expect(r.complete).toBe(true);
      expect(r.cells.map((v) => v === 1)).toEqual(bm);
      expect(isLineSolvable(bm, size)).toBe(true);
    });
  }
});
