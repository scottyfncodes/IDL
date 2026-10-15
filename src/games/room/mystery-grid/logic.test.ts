import { THEMES } from './content';
import {
  solveScore,
  ALL_ASSIGNS,
  CROSS,
  DOT,
  EMPTY,
  GRIDS,
  allTrueClues,
  cellIndex,
  cellLabel,
  check,
  clueText,
  consistentWithMarks,
  cycleMark,
  emptyMarks,
  generate,
  hint,
  holds,
  isComplete,
  personOf,
  sameAssign,
  setMark,
  solutionRows,
  solutionsOf,
  themeById,
  truth,
  type Assign,
  type Clue,
  type Difficulty,
  type Mark,
  type Puzzle,
} from './logic';
import { createRng } from '../../../lib/rng';

const DIFFS: Difficulty[] = ['gentle', 'tricky'];
const SEEDS = Array.from({ length: 60 }, (_, k) => 17 + k * 104729);

const solvedMarks = (solution: Assign): Mark[] => emptyMarks().map((_, i) => truth(solution, i));
const dotsOnly = (solution: Assign): Mark[] => emptyMarks().map((_, i) => (truth(solution, i) === DOT ? DOT : EMPTY));

describe('assignments', () => {
  it('enumerates all 576 distinct assignments', () => {
    expect(ALL_ASSIGNS).toHaveLength(576);
    expect(new Set(ALL_ASSIGNS.map((a) => JSON.stringify(a))).size).toBe(576);
    ALL_ASSIGNS.forEach((a) => expect(a[0]).toEqual([0, 1, 2, 3]));
  });

  it('evaluates each clue kind', () => {
    const a: Assign = [[0, 1, 2, 3], [2, 0, 3, 1], [3, 2, 1, 0]];
    // person 0 has item 2 in cat1 and item 3 in cat2
    expect(personOf(a, { cat: 1, item: 2 })).toBe(0);
    expect(holds({ kind: 'is', a: { cat: 0, item: 0 }, b: { cat: 1, item: 2 } }, a)).toBe(true);
    expect(holds({ kind: 'is', a: { cat: 1, item: 2 }, b: { cat: 2, item: 3 } }, a)).toBe(true);
    expect(holds({ kind: 'not', a: { cat: 1, item: 2 }, b: { cat: 2, item: 3 } }, a)).toBe(false);
    expect(holds({ kind: 'either', a: { cat: 0, item: 1 }, b: { cat: 1, item: 0 }, c: { cat: 1, item: 3 } }, a)).toBe(true);
    expect(holds({ kind: 'either', a: { cat: 0, item: 1 }, b: { cat: 1, item: 1 }, c: { cat: 1, item: 3 } }, a)).toBe(false);
    // ordinal cat 2: person 3 has 0, person 2 has 1, person 1 has 2, person 0 has 3
    expect(holds({ kind: 'before', a: { cat: 0, item: 3 }, b: { cat: 0, item: 0 }, ord: 2 }, a)).toBe(true);
    expect(holds({ kind: 'before', a: { cat: 0, item: 0 }, b: { cat: 0, item: 3 }, ord: 2 }, a)).toBe(false);
    expect(holds({ kind: 'justBefore', a: { cat: 0, item: 3 }, b: { cat: 0, item: 2 }, ord: 2 }, a)).toBe(true);
    expect(holds({ kind: 'justBefore', a: { cat: 0, item: 3 }, b: { cat: 0, item: 1 }, ord: 2 }, a)).toBe(false);
  });

  it('every generated pool clue is true of its solution', () => {
    const rng = createRng(5);
    for (const theme of THEMES) {
      const solution: Assign = [[0, 1, 2, 3], rng.shuffle([0, 1, 2, 3]), rng.shuffle([0, 1, 2, 3])];
      const pool = allTrueClues(theme, solution, rng);
      expect(pool.length).toBeGreaterThan(50);
      pool.forEach((c) => expect(holds(c, solution)).toBe(true));
      if (theme.categories.some((c) => c.ordinal)) expect(pool.some((c) => c.kind === 'before')).toBe(true);
      else expect(pool.some((c) => c.kind === 'before' || c.kind === 'justBefore')).toBe(false);
    }
  });
});

describe('generator', () => {
  for (const difficulty of DIFFS) {
    it(`${difficulty}: unique solution, all clues true, no redundant clue`, () => {
      for (const seed of SEEDS) {
        const p = generate(seed, difficulty);
        const sols = solutionsOf(p.clues);
        expect(sols).toHaveLength(1);
        expect(sameAssign(ALL_ASSIGNS[sols[0]], p.solution)).toBe(true);
        p.clues.forEach((c) => expect(holds(c, p.solution)).toBe(true));
        p.clues.forEach((_, k) => {
          const rest = p.clues.filter((__, j) => j !== k);
          expect(solutionsOf(rest).length).toBeGreaterThan(1);
        });
      }
    });
  }

  it('is deterministic per seed and varies across seeds', () => {
    expect(generate(99, 'tricky')).toEqual(generate(99, 'tricky'));
    const many = new Set(SEEDS.slice(0, 20).map((s) => JSON.stringify(generate(s, 'gentle').solution) + generate(s, 'gentle').themeId));
    expect(many.size).toBeGreaterThan(15);
  });

  it('uses many themes', () => {
    const themes = new Set(SEEDS.map((s) => generate(s, 'gentle').themeId));
    expect(themes.size).toBeGreaterThanOrEqual(8);
  });

  it('gentle leans on direct clues, tricky on indirect ones', () => {
    const share = (d: Difficulty) => {
      let is = 0, total = 0;
      for (const s of SEEDS) {
        const p = generate(s, d);
        total += p.clues.length;
        is += p.clues.filter((c) => c.kind === 'is').length;
        if (d === 'tricky') expect(p.clues.filter((c) => c.kind === 'is').length).toBeLessThanOrEqual(1);
      }
      return { is: is / total, avg: total / SEEDS.length };
    };
    const g = share('gentle');
    const t = share('tricky');
    expect(g.is).toBeGreaterThan(t.is + 0.15);
    expect(t.avg).toBeGreaterThanOrEqual(g.avg);
  });
});

describe('clue text', () => {
  it('renders every clue as a clean sentence', () => {
    for (const d of DIFFS) {
      for (const seed of SEEDS) {
        const p = generate(seed, d);
        const theme = themeById(p.themeId);
        for (const c of p.clues) {
          const t = clueText(theme, c);
          expect(t).not.toContain('{}');
          expect(t).not.toMatch(/undefined|\s{2}/);
          expect(t).toMatch(/^[A-Z].*\.$/);
          expect(t).not.toMatch(/\bthe the\b/i);
        }
      }
    }
  });

  it('phrases each kind as expected', () => {
    const theme = themeById('allotment');
    const c = (clue: Clue) => clueText(theme, clue);
    expect(c({ kind: 'is', a: { cat: 0, item: 0 }, b: { cat: 1, item: 0 } })).toBe('Ines grows leeks.');
    expect(c({ kind: 'not', a: { cat: 1, item: 1 }, b: { cat: 0, item: 1 } })).toBe('Whoever grows pumpkins is not Bram.');
    expect(c({ kind: 'either', a: { cat: 0, item: 2 }, b: { cat: 2, item: 0 }, c: { cat: 2, item: 3 } })).toBe('Odile tends either plot 1 or plot 4.');
    expect(c({ kind: 'before', a: { cat: 1, item: 2 }, b: { cat: 0, item: 3 }, ord: 2 })).toBe('Whoever grows beans has a lower-numbered plot than Kofi.');
    expect(c({ kind: 'justBefore', a: { cat: 0, item: 3 }, b: { cat: 1, item: 3 }, ord: 2 })).toBe('Kofi tends the plot just before whoever grows rhubarb.');
    const pets = themeById('pet-show');
    expect(clueText(pets, { kind: 'either', a: { cat: 0, item: 0 }, b: { cat: 1, item: 1 }, c: { cat: 1, item: 2 } })).toBe('Hattie owns either the ferret or the parrot.');
    expect(clueText(pets, { kind: 'is', a: { cat: 1, item: 2 }, b: { cat: 2, item: 0 } })).toBe('The parrot owner won the blue ribbon.');
  });
});

describe('grid marks', () => {
  it('cycles empty → ✕ → ● → empty', () => {
    expect(cycleMark(EMPTY)).toBe(CROSS);
    expect(cycleMark(CROSS)).toBe(DOT);
    expect(cycleMark(DOT)).toBe(EMPTY);
  });

  it('auto-crosses the rest of the row and column only when asked', () => {
    let m = emptyMarks();
    m[cellIndex(1, 0, 3)] = DOT; // existing mark is left alone
    const auto = setMark(m, cellIndex(1, 1, 2), DOT, true);
    expect(auto[cellIndex(1, 1, 2)]).toBe(DOT);
    [0, 1, 3].forEach((c) => expect(auto[cellIndex(1, 1, c)]).toBe(CROSS));
    [0, 2, 3].forEach((r) => expect(auto[cellIndex(1, r, 2)]).toBe(CROSS));
    expect(auto[cellIndex(1, 0, 3)]).toBe(DOT);
    expect(auto[cellIndex(0, 1, 0)]).toBe(EMPTY); // other grids untouched
    m = setMark(emptyMarks(), cellIndex(1, 1, 2), DOT, false);
    expect(m.filter((x) => x !== EMPTY)).toHaveLength(1);
  });

  it('truth matches the staircase layout', () => {
    const a: Assign = [[0, 1, 2, 3], [1, 0, 3, 2], [2, 3, 0, 1]];
    expect(GRIDS).toEqual([[0, 1], [0, 2], [2, 1]]);
    expect(truth(a, cellIndex(0, 0, 1))).toBe(DOT); // person 0 ↔ cat1 item 1
    expect(truth(a, cellIndex(0, 0, 0))).toBe(CROSS);
    expect(truth(a, cellIndex(1, 2, 0))).toBe(DOT); // person 2 ↔ cat2 item 0
    expect(truth(a, cellIndex(2, 2, 1))).toBe(DOT); // cat2 item 2 is person 0 → cat1 item 1
    const labels = cellLabel(themeById('allotment'), cellIndex(2, 3, 1));
    expect(labels).toEqual({ row: 'plot 4', col: 'pumpkins', grid: 'Plot × Crop' });
  });
});

describe('check / win', () => {
  const p = generate(1234, 'gentle');

  it('is incomplete until every row and column of every grid has one ●', () => {
    expect(isComplete(emptyMarks())).toBe(false);
    const dots = dotsOnly(p.solution);
    expect(isComplete(dots)).toBe(true);
    const missing = dots.slice();
    missing[missing.indexOf(DOT)] = EMPTY;
    expect(check(p.solution, missing).complete).toBe(false);
    const doubled = dots.slice();
    doubled[doubled.indexOf(EMPTY)] = DOT;
    expect(isComplete(doubled)).toBe(false);
  });

  it('wins with the right ● marks (crosses optional)', () => {
    expect(check(p.solution, dotsOnly(p.solution))).toEqual({ complete: true, wrong: 0, solved: true });
    expect(check(p.solution, solvedMarks(p.solution)).solved).toBe(true);
  });

  it('counts wrong matches without needing to reveal them', () => {
    // swap two rows of grid 0: two ● become wrong
    const m = dotsOnly(p.solution);
    const row = (r: number) => [0, 1, 2, 3].map((c) => m[cellIndex(0, r, c)]);
    const r0 = row(0), r1 = row(1);
    [0, 1, 2, 3].forEach((c) => {
      m[cellIndex(0, 0, c)] = r1[c];
      m[cellIndex(0, 1, c)] = r0[c];
    });
    const res = check(p.solution, m);
    expect(res).toEqual({ complete: true, wrong: 2, solved: false });
  });

  it('produces a solution table with one row per person', () => {
    const rows = solutionRows(themeById(p.themeId), p.solution);
    expect(rows).toHaveLength(4);
    rows.forEach((r) => expect(r).toHaveLength(3));
    expect(new Set(rows.map((r) => r[1])).size).toBe(4);
  });
});

describe('hints', () => {
  const forcedBy = (puzzle: Puzzle, marks: Mark[], clueIdx: number[], cell: number, value: Mark) =>
    ALL_ASSIGNS.filter((a) => consistentWithMarks(a, marks) && clueIdx.every((k) => holds(puzzle.clues[k], a))).every((a) => truth(a, cell) === value);

  it('flags a wrong mark first', () => {
    const p = generate(77, 'tricky');
    const m = emptyMarks();
    const bad = [...Array(48).keys()].find((i) => truth(p.solution, i) === DOT)!;
    m[bad] = CROSS;
    expect(hint(p, m)).toEqual({ kind: 'wrong', cell: bad, mark: CROSS });
  });

  it('returns a correct, logically forced cell — and its cited clues force it', () => {
    for (const d of DIFFS) {
      for (const seed of SEEDS.slice(0, 15)) {
        const p = generate(seed, d);
        let marks = emptyMarks();
        // Follow hints all the way to a full solution.
        for (let step = 0; step < 48; step++) {
          const h = hint(p, marks);
          if (h.kind === 'none') break;
          expect(h.kind).toBe('cell');
          if (h.kind !== 'cell') break;
          expect(marks[h.cell]).toBe(EMPTY);
          expect(h.value).toBe(truth(p.solution, h.cell));
          expect(forcedBy(p, marks, h.clues, h.cell, h.value)).toBe(true);
          marks = setMark(marks, h.cell, h.value, false);
        }
        expect(marks.every((m, i) => m === truth(p.solution, i))).toBe(true);
        expect(check(p.solution, marks).solved).toBe(true);
        expect(hint(p, marks)).toEqual({ kind: 'none' });
      }
    }
  });

  it('prefers deductions from the player’s own marks', () => {
    const p = generate(2024, 'gentle');
    const dot = [...Array(48).keys()].find((i) => truth(p.solution, i) === DOT)!;
    const marks = setMark(emptyMarks(), dot, DOT, false);
    const h = hint(p, marks);
    expect(h.kind).toBe('cell');
    if (h.kind === 'cell') expect(h.clues).toEqual([]);
  });
});

describe('mystery grid: personal-best score', () => {
  it('counts hints and wrong checks, lower is better', () => {
    expect(solveScore('gentle', 0, 1)).toEqual({ variant: 'gentle', value: 0, better: 'lower', label: 'No hints' });
    expect(solveScore('tricky', 1, 1)).toMatchObject({ variant: 'tricky', value: 1, label: '1 hint' });
    expect(solveScore('gentle', 2, 3)).toMatchObject({ value: 4, label: '2 hints · 2 wrong checks' });
    expect(solveScore('gentle', 0, 2)).toMatchObject({ value: 1, label: 'No hints · 1 wrong check' });
  });
});
