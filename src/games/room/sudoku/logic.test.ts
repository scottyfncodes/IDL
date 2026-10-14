import {
  CLUE_RANGE,
  DIFFICULTIES,
  PEERS,
  UNITS,
  boxOf,
  canPlace,
  clueCount,
  completedDigits,
  conflicts,
  countSolutions,
  eraseCell,
  formatTime,
  generate,
  hasNote,
  isSolvedGrid,
  isWon,
  noteDigits,
  placeDigit,
  randomFullGrid,
  solvableBySingles,
  solve,
  toggleNote,
  toggleNoteMask,
  undoChange,
  type Board,
  type Grid,
} from './logic';
import { createRng } from '../../../lib/rng';

const parse = (s: string): Grid => [...s.replace(/\s/g, '')].map((c) => (c === '.' || c === '0' ? 0 : Number(c)));

// A well-known valid solution grid and a uniquely solvable puzzle from it.
const SOLVED = parse(`
534678912 672195348 198342567
859761423 426853791 713924856
961537284 287419635 345286179`);
const PUZZLE = parse(`
53..7.... 6..195... .98....6.
8...6...3 4..8.3..1 7...2...6
.6....28. ...419..5 ....8..79`);

const boardFrom = (givens: Grid): Board => ({ givens, values: givens.slice(), notes: Array(81).fill(0) });

describe('geometry', () => {
  it('has 27 units of 9 and 20 peers per cell', () => {
    expect(UNITS).toHaveLength(27);
    UNITS.forEach((u) => expect(new Set(u).size).toBe(9));
    PEERS.forEach((p, i) => {
      expect(p).toHaveLength(20);
      expect(p).not.toContain(i);
    });
    expect(boxOf(0)).toBe(0);
    expect(boxOf(80)).toBe(8);
    expect(boxOf(30)).toBe(4);
  });
});

describe('rule validation', () => {
  it('accepts a solved grid', () => {
    expect(isSolvedGrid(SOLVED)).toBe(true);
    expect(conflicts(SOLVED).size).toBe(0);
  });

  it('flags row, column and box conflicts', () => {
    const row = Array(81).fill(0);
    row[0] = 5;
    row[8] = 5;
    expect([...conflicts(row)].sort((a, b) => a - b)).toEqual([0, 8]);

    const col = Array(81).fill(0);
    col[4] = 3;
    col[76] = 3;
    expect([...conflicts(col)].sort((a, b) => a - b)).toEqual([4, 76]);

    const box = Array(81).fill(0);
    box[0] = 7;
    box[20] = 7; // row 2, col 2 — same box, different row & col
    expect([...conflicts(box)].sort((a, b) => a - b)).toEqual([0, 20]);
  });

  it('canPlace respects peers only', () => {
    expect(canPlace(PUZZLE, 2, 5)).toBe(false); // 5 already in row 0
    expect(canPlace(PUZZLE, 2, 4)).toBe(true);
    expect(canPlace(PUZZLE, 2, 6)).toBe(false); // 6 in box 0
    expect(canPlace(PUZZLE, 2, 8)).toBe(false); // 8 sits at row 2, column 2
  });

  it('rejects incomplete or broken grids as solved', () => {
    const broken = SOLVED.slice();
    [broken[0], broken[1]] = [broken[1], broken[0]];
    expect(isSolvedGrid(broken)).toBe(false);
    const holey = SOLVED.slice();
    holey[40] = 0;
    expect(isSolvedGrid(holey)).toBe(false);
  });
});

describe('solver', () => {
  it('solves a classic puzzle correctly', () => {
    expect(solve(PUZZLE)).toEqual(SOLVED);
  });

  it('keeps every given in the solution', () => {
    const s = solve(PUZZLE)!;
    PUZZLE.forEach((d, i) => d && expect(s[i]).toBe(d));
  });

  it('returns null for contradictory givens', () => {
    const bad = PUZZLE.slice();
    bad[2] = 5; // duplicates the 5 in row 0
    expect(solve(bad)).toBeNull();
    expect(countSolutions(bad)).toBe(0);
  });

  it('returns null when a valid-looking grid has no completion', () => {
    // Row 0 is missing only 9 but column 8 already has a 9.
    const g = Array(81).fill(0);
    [1, 2, 3, 4, 5, 6, 7, 8].forEach((d, c) => (g[c] = d));
    g[9 * 5 + 8] = 9;
    expect(countSolutions(g)).toBe(0);
  });

  it('counts unique, multiple and zero solutions', () => {
    expect(countSolutions(PUZZLE)).toBe(1);
    expect(countSolutions(SOLVED)).toBe(1);
    expect(countSolutions(Array(81).fill(0))).toBe(2); // capped at limit
    expect(countSolutions(Array(81).fill(0), 5)).toBe(5);
    // Remove a "deadly rectangle": swap-able pair of digits → two solutions.
    const two = SOLVED.slice();
    // cells (0,0)=5,(0,1)=3 ... find a rectangle by search
    let found = false;
    outer: for (let r1 = 0; r1 < 9; r1++)
      for (let r2 = r1 + 1; r2 < 9; r2++)
        for (let c1 = 0; c1 < 9; c1++)
          for (let c2 = c1 + 1; c2 < 9; c2++) {
            const a = SOLVED[r1 * 9 + c1], b = SOLVED[r1 * 9 + c2];
            if (SOLVED[r2 * 9 + c1] === b && SOLVED[r2 * 9 + c2] === a && Math.floor(r1 / 3) === Math.floor(r2 / 3)) {
              [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2].forEach((i) => (two[i] = 0));
              found = true;
              break outer;
            }
          }
    expect(found).toBe(true);
    expect(countSolutions(two)).toBe(2);
  });

  it('builds random full grids that are valid and seed-dependent', () => {
    const a = randomFullGrid(createRng(1));
    const b = randomFullGrid(createRng(2));
    expect(isSolvedGrid(a)).toBe(true);
    expect(isSolvedGrid(b)).toBe(true);
    expect(a).not.toEqual(b);
    expect(randomFullGrid(createRng(1))).toEqual(a);
  });

  it('singles solver solves easy grids and stalls on harder ones without guessing', () => {
    expect(solvableBySingles(PUZZLE)).toBe(true);
    expect(solvableBySingles(Array(81).fill(0))).toBe(false);
  });
});

describe('generator', () => {
  const SEEDS = Array.from({ length: 15 }, (_, k) => 1000 + k * 7717);
  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty}: unique solution, clue count in range, symmetric, graded`, () => {
      const [lo, hi] = CLUE_RANGE[difficulty];
      for (const seed of SEEDS) {
        const p = generate(seed, difficulty);
        expect(isSolvedGrid(p.solution)).toBe(true);
        expect(countSolutions(p.puzzle, 2)).toBe(1);
        expect(solve(p.puzzle)).toEqual(p.solution);
        p.puzzle.forEach((d, i) => d && expect(p.solution[i]).toBe(d));
        const n = clueCount(p.puzzle);
        expect(n).toBeGreaterThanOrEqual(lo);
        expect(n).toBeLessThanOrEqual(hi);
        // 180° rotational symmetry of the clue pattern
        p.puzzle.forEach((d, i) => expect(Boolean(d)).toBe(Boolean(p.puzzle[80 - i])));
        if (difficulty === 'easy') expect(solvableBySingles(p.puzzle)).toBe(true);
        if (difficulty === 'hard') expect(solvableBySingles(p.puzzle)).toBe(false);
      }
    });
  }

  it('is deterministic per seed and differs across seeds', () => {
    expect(generate(42, 'medium')).toEqual(generate(42, 'medium'));
    expect(generate(42, 'medium').puzzle).not.toEqual(generate(43, 'medium').puzzle);
  });

  it('is fast enough for a phone', () => {
    const t = performance.now();
    for (let s = 0; s < 10; s++) generate(s, 'hard');
    expect((performance.now() - t) / 10).toBeLessThan(150);
  });
});

describe('notes', () => {
  it('toggles bits for digits 1..9', () => {
    let m = 0;
    m = toggleNoteMask(m, 3);
    m = toggleNoteMask(m, 9);
    expect(hasNote(m, 3)).toBe(true);
    expect(hasNote(m, 4)).toBe(false);
    expect(noteDigits(m)).toEqual([3, 9]);
    expect(noteDigits(toggleNoteMask(m, 3))).toEqual([9]);
  });

  it('toggleNote only works on empty, non-given cells', () => {
    const b = boardFrom(PUZZLE);
    expect(toggleNote(b, 0, 4).change).toBeNull(); // given
    const r = toggleNote(b, 2, 4);
    expect(noteDigits(r.board.notes[2])).toEqual([4]);
    const placed = placeDigit(r.board, 2, 4, SOLVED).board;
    expect(toggleNote(placed, 2, 1).change).toBeNull(); // filled
  });

  it('placing a digit clears own notes and that digit from peer notes only', () => {
    let b = boardFrom(PUZZLE);
    b = toggleNote(b, 2, 4).board;
    b = toggleNote(b, 2, 2).board;
    b = toggleNote(b, 3, 4).board; // same row as 2 → peer
    b = toggleNote(b, 3, 2).board;
    b = toggleNote(b, 70, 4).board; // not a peer
    const r = placeDigit(b, 2, 4, SOLVED);
    expect(r.board.values[2]).toBe(4);
    expect(r.board.notes[2]).toBe(0);
    expect(noteDigits(r.board.notes[3])).toEqual([2]);
    expect(noteDigits(r.board.notes[70])).toEqual([4]);
    // undo restores both the cell and the peer notes
    const back = undoChange(r.board, r.change!);
    expect(back.values[2]).toBe(0);
    expect(noteDigits(back.notes[2])).toEqual([2, 4]);
    expect(noteDigits(back.notes[3])).toEqual([2, 4]);
  });
});

describe('moves', () => {
  it('reports mistakes against the solution', () => {
    const b = boardFrom(PUZZLE);
    expect(placeDigit(b, 2, 4, SOLVED).mistake).toBe(false);
    expect(placeDigit(b, 2, 1, SOLVED).mistake).toBe(true);
  });

  it('never changes givens', () => {
    const b = boardFrom(PUZZLE);
    expect(placeDigit(b, 0, 9, SOLVED).board).toBe(b);
    expect(eraseCell(b, 0).board).toBe(b);
  });

  it('re-entering the same digit clears it; erase clears value or notes', () => {
    const b = boardFrom(PUZZLE);
    const one = placeDigit(b, 2, 4, SOLVED).board;
    expect(placeDigit(one, 2, 4, SOLVED).board.values[2]).toBe(0);
    expect(eraseCell(one, 2).board.values[2]).toBe(0);
    const noted = toggleNote(b, 2, 7).board;
    expect(eraseCell(noted, 2).board.notes[2]).toBe(0);
    expect(eraseCell(b, 2).change).toBeNull(); // nothing to erase
  });
});

describe('win detection', () => {
  it('wins only when every cell matches the solution', () => {
    let b = boardFrom(PUZZLE);
    expect(isWon(b.values, SOLVED)).toBe(false);
    const blanks = PUZZLE.map((d, i) => (d ? -1 : i)).filter((i) => i >= 0);
    for (const i of blanks.slice(0, -1)) b = placeDigit(b, i, SOLVED[i], SOLVED).board;
    expect(isWon(b.values, SOLVED)).toBe(false);
    const last = blanks[blanks.length - 1];
    const wrong = placeDigit(b, last, (SOLVED[last] % 9) + 1, SOLVED).board;
    expect(isWon(wrong.values, SOLVED)).toBe(false);
    b = placeDigit(b, last, SOLVED[last], SOLVED).board;
    expect(isWon(b.values, SOLVED)).toBe(true);
    expect(completedDigits(b.values, SOLVED).size).toBe(9);
  });

  it('counts a digit complete only when all nine are correct', () => {
    const v = SOLVED.slice();
    const i = v.indexOf(5);
    v[i] = 0;
    expect(completedDigits(v, SOLVED).has(5)).toBe(false);
    expect(completedDigits(v, SOLVED).has(1)).toBe(true);
  });
});

describe('formatTime', () => {
  it('formats minutes and hours', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65_400)).toBe('1:05');
    expect(formatTime(3_725_000)).toBe('1:02:05');
  });
});
