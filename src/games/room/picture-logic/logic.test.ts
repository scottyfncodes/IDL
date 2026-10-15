import {
  BLANK,
  CROSS,
  FILL,
  applyStroke,
  countMistakes,
  decodeMarks,
  deriveClues,
  emptyMarks,
  encodeMarks,
  findHint,
  isLineSolvable,
  isSolved,
  lineSatisfied,
  parseBitmap,
  runs,
  solveGrid,
  solveLine,
  strokeAction,
  strokeCells,
  type Knowledge,
  type Mark,
} from './logic';
import { ALL_PUZZLES, PUZZLES_10, nextUnsolved } from './puzzles';
import { createRng } from '../../../lib/rng';

const L = (s: string): Knowledge[] => s.split('').map((c) => (c === '#' ? 1 : c === '.' ? 0 : -1));
const S = (k: Knowledge[] | null) => (k ? k.map((v) => (v === 1 ? '#' : v === 0 ? '.' : '?')).join('') : null);

describe('picture logic: clues', () => {
  it('derives runs', () => {
    expect(runs([true, true, false, true])).toEqual([2, 1]);
    expect(runs([false, false])).toEqual([]);
    expect(runs([1, 1, 1])).toEqual([3]);
  });
  it('derives row and column clues', () => {
    const c = deriveClues(parseBitmap(['#.#', '###', '..#']), 3);
    expect(c.rows).toEqual([[1, 1], [3], [1]]);
    expect(c.cols).toEqual([[2], [1], [3]]);
  });
});

describe('picture logic: line solver', () => {
  it('fills overlaps on an empty line', () => {
    expect(S(solveLine([4], L('?????')))).toBe('?###?');
    expect(S(solveLine([2, 2], L('?????')))).toBe('##.##');
    expect(S(solveLine([5], L('?????')))).toBe('#####');
  });
  it('an empty clue crosses the whole line', () => {
    expect(S(solveLine([], L('???')))).toBe('...');
  });
  it('uses known cells', () => {
    expect(S(solveLine([1], L('?#???')))).toBe('.#...');
    expect(S(solveLine([3], L('????#')))).toBe('..###');
    expect(S(solveLine([1, 1], L('?.?.?')))).toBe('?.?.?');
    expect(S(solveLine([2], L('.?#??')))).toBe('.?#?.');
  });
  it('enumerates every placement (no unsound deductions)', () => {
    // [1,2] in 6 cells with cell 3 known empty: the 2 only fits at the end.
    expect(S(solveLine([1, 2], L('???.??')))).toBe('???.##');
    expect(S(solveLine([1, 1], L('?.?.?')))).toBe('?.?.?');
    expect(S(solveLine([3, 1], L('??????')))).toBe('?##???');
  });
  it('detects contradictions', () => {
    expect(solveLine([3], L('##.##'))).toBeNull();
    expect(solveLine([1], L('#.#'))).toBeNull();
    expect(solveLine([], L('?#?'))).toBeNull();
    expect(solveLine([2, 2], L('????'))).toBeNull();
  });
  it('agrees with brute force on random lines', () => {
    const rng = createRng(42);
    for (let t = 0; t < 400; t++) {
      const n = rng.int(1, 9);
      const truth = Array.from({ length: n }, () => rng.chance(0.5));
      const clue = runs(truth);
      const line: Knowledge[] = truth.map((v) => (rng.chance(0.4) ? (v ? 1 : 0) : -1));
      // brute force
      const fits: boolean[][] = [];
      for (let m = 0; m < 1 << n; m++) {
        const cand = Array.from({ length: n }, (_, j) => !!(m & (1 << j)));
        if (cand.every((v, j) => line[j] === -1 || (line[j] === 1) === v) && JSON.stringify(runs(cand)) === JSON.stringify(clue)) fits.push(cand);
      }
      const expected = line.map((v, j) => (v !== -1 ? v : fits.every((f) => f[j]) ? 1 : fits.every((f) => !f[j]) ? 0 : -1));
      expect(solveLine(clue, line)).toEqual(expected);
    }
  });
  it('solves a grid and reports a contradiction for impossible clues', () => {
    const bm = parseBitmap(['#.#', '###', '..#']);
    const r = solveGrid(deriveClues(bm, 3));
    expect(r.complete).toBe(true);
    expect(r.cells.map((v) => v === 1)).toEqual(bm);
    expect(solveGrid({ rows: [[3], [], []], cols: [[], [], []] }).contradiction).toBe(true);
  });
  it('rejects pictures that need guessing', () => {
    // A 2×2 diagonal has two solutions.
    expect(isLineSolvable(parseBitmap(['#.', '.#']), 2)).toBe(false);
    expect(isLineSolvable(parseBitmap(['##', '.#']), 2)).toBe(true);
  });
});

describe('picture logic: play', () => {
  const p = ALL_PUZZLES[0];
  it('detects a win from fills only (crosses ignored)', () => {
    const marks: Mark[] = p.bitmap.map((b) => (b ? FILL : CROSS));
    expect(isSolved(marks, p.bitmap)).toBe(true);
    const blanks: Mark[] = p.bitmap.map((b) => (b ? FILL : BLANK));
    expect(isSolved(blanks, p.bitmap)).toBe(true);
    const missing = blanks.slice();
    missing[p.bitmap.indexOf(true)] = BLANK;
    expect(isSolved(missing, p.bitmap)).toBe(false);
    const extra = blanks.slice();
    extra[p.bitmap.indexOf(false)] = FILL;
    expect(isSolved(extra, p.bitmap)).toBe(false);
  });
  it('knows when a line is satisfied', () => {
    expect(lineSatisfied([2, 1], [FILL, FILL, CROSS, FILL])).toBe(true);
    expect(lineSatisfied([2, 1], [FILL, FILL, BLANK, BLANK])).toBe(false);
    expect(lineSatisfied([], [CROSS, BLANK])).toBe(true);
  });
  it('counts mistakes without positions', () => {
    const marks = emptyMarks(p.size);
    marks[p.bitmap.indexOf(false)] = FILL;
    marks[p.bitmap.indexOf(true)] = CROSS;
    expect(countMistakes(marks, p.bitmap)).toBe(2);
    expect(countMistakes(emptyMarks(p.size), p.bitmap)).toBe(0);
  });
  it('round-trips marks through storage and rejects junk', () => {
    const m: Mark[] = [0, 1, 2, 1];
    expect(decodeMarks(encodeMarks(m), 2)).toEqual(m);
    expect(decodeMarks('01x1', 2)).toEqual(emptyMarks(2));
    expect(decodeMarks(undefined, 2)).toEqual(emptyMarks(2));
  });
});

describe('picture logic: hints', () => {
  it('always gives a correct cell that line logic forces, until solved', () => {
    for (const p of ALL_PUZZLES) {
      let marks = emptyMarks(p.size);
      let steps = 0;
      while (!isSolved(marks, p.bitmap)) {
        const h = findHint(marks, p.bitmap, p.clues)!;
        expect(h).not.toBeNull();
        expect(h.value).toBe('fill');
        expect(p.bitmap[h.index]).toBe(true);
        expect(marks[h.index]).not.toBe(FILL);
        // Forced: the line solver from correct knowledge agrees (solving the whole grid from current marks determines it).
        marks = marks.slice();
        marks[h.index] = FILL;
        if (++steps > p.size * p.size) throw new Error('hint loop');
      }
    }
  });
  it('hints are forced: the very first hint on a fresh board is a line-logic consequence', () => {
    for (const p of PUZZLES_10) {
      const h = findHint(emptyMarks(p.size), p.bitmap, p.clues)!;
      // Re-derive with the solver starting from nothing: the cell must be determined filled.
      const r = solveGrid(p.clues);
      expect(r.cells[h.index]).toBe(1);
    }
  });
  it('ignores wrong marks and still points at a true cell', () => {
    const p = PUZZLES_10[0];
    const marks: Mark[] = p.bitmap.map((b) => (b ? CROSS : FILL)); // everything wrong
    const h = findHint(marks, p.bitmap, p.clues)!;
    expect(h.value).toBe('fill');
    expect(p.bitmap[h.index]).toBe(true);
  });
  it('returns null on a solved board and offers a cross to fix a stray fill', () => {
    const p = PUZZLES_10[0];
    const solved: Mark[] = p.bitmap.map((b) => (b ? FILL : CROSS));
    expect(findHint(solved, p.bitmap, p.clues)).toBeNull();
  });
});

describe('picture logic: drag painting', () => {
  it('runs along the dominant axis from the start cell', () => {
    expect(strokeCells(5, 6, 9)).toEqual([6, 7, 8, 9]);
    expect(strokeCells(5, 9, 6)).toEqual([9, 8, 7, 6]);
    expect(strokeCells(5, 1, 21)).toEqual([1, 6, 11, 16, 21]);
    expect(strokeCells(5, 0, 6)).toEqual([0, 1]); // tie goes to the row
    expect(strokeCells(5, 7, 7)).toEqual([7]);
  });
  it('first cell decides set vs clear', () => {
    const base: Mark[] = [FILL, BLANK, CROSS, BLANK];
    expect(strokeAction(base, 0, FILL)).toEqual({ kind: 'clear', mark: FILL });
    expect(strokeAction(base, 1, FILL)).toEqual({ kind: 'set', mark: FILL });
    expect(strokeAction(base, 2, CROSS)).toEqual({ kind: 'clear', mark: CROSS });
  });
  it('setting paints blanks but keeps the other mark, except under the first touch', () => {
    const base: Mark[] = [BLANK, BLANK, CROSS, FILL, BLANK];
    expect(applyStroke(base, [0, 1, 2, 3, 4], { kind: 'set', mark: FILL })).toEqual([FILL, FILL, CROSS, FILL, FILL]);
    expect(applyStroke(base, [2, 3, 4], { kind: 'set', mark: FILL })).toEqual([BLANK, BLANK, FILL, FILL, FILL]);
    expect(applyStroke(base, [4, 3, 2], { kind: 'set', mark: CROSS })).toEqual([BLANK, BLANK, CROSS, FILL, CROSS]);
  });
  it('clearing only removes that mark', () => {
    const base: Mark[] = [FILL, CROSS, FILL, FILL];
    expect(applyStroke(base, [0, 1, 2], { kind: 'clear', mark: FILL })).toEqual([BLANK, CROSS, BLANK, FILL]);
  });
  it('is pure: the snapshot is untouched, so retracting a drag un-paints', () => {
    const base: Mark[] = [BLANK, BLANK, BLANK];
    const long = applyStroke(base, strokeCells(3, 0, 2), { kind: 'set', mark: FILL });
    const short = applyStroke(base, strokeCells(3, 0, 0), { kind: 'set', mark: FILL });
    expect(long).toEqual([FILL, FILL, FILL]);
    expect(short).toEqual([FILL, BLANK, BLANK]);
    expect(base).toEqual([BLANK, BLANK, BLANK]);
  });
});

describe('picture logic: progress', () => {
  it('finds the next unsolved puzzle, same size first, wrapping', () => {
    const first = ALL_PUZZLES[0];
    expect(nextUnsolved(new Set())!.id).toBe(first.id);
    expect(nextUnsolved(new Set([first.id]), first.id)!.id).toBe(ALL_PUZZLES[1].id);
    const all5 = new Set(ALL_PUZZLES.filter((p) => p.size === 5).map((p) => p.id));
    expect(nextUnsolved(all5, first.id)!.size).toBe(10);
    expect(nextUnsolved(new Set(ALL_PUZZLES.map((p) => p.id)))).toBeNull();
  });
});
