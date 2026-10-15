/**
 * Mystery Grid — logic-grid puzzle generation, clue text, hints and checking.
 * Pure functions, no React.
 *
 * Three categories of four items. Category 0 is the people; an assignment
 * maps each person p to an item in every category: assign[cat][p] = item
 * (assign[0] is always the identity). There are 4! × 4! = 576 assignments,
 * so every question is answered by brute force.
 */
import { createRng, type Rng } from '../../../lib/rng';
import { THEMES, type Theme } from './content';

export type Difficulty = 'gentle' | 'tricky';
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { gentle: 'Gentle', tricky: 'Tricky' };

export type Assign = number[][];

export interface Ref {
  cat: number;
  item: number;
}

export type Clue =
  | { kind: 'is'; a: Ref; b: Ref }
  | { kind: 'not'; a: Ref; b: Ref }
  | { kind: 'either'; a: Ref; b: Ref; c: Ref } // b and c share a category
  | { kind: 'before'; a: Ref; b: Ref; ord: number } // a's position in category `ord` is lower than b's
  | { kind: 'justBefore'; a: Ref; b: Ref; ord: number }; // exactly one lower

export interface Puzzle {
  seed: number;
  difficulty: Difficulty;
  themeId: string;
  solution: Assign;
  clues: Clue[];
}

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------

const permutations = (n: number): number[][] => {
  if (n === 1) return [[0]];
  const out: number[][] = [];
  for (const p of permutations(n - 1)) {
    for (let k = 0; k <= p.length; k++) out.push([...p.slice(0, k), n - 1, ...p.slice(k)]);
  }
  return out;
};

export const PERMS = permutations(4);
const IDENTITY = [0, 1, 2, 3];
export const ALL_ASSIGNS: Assign[] = PERMS.flatMap((b) => PERMS.map((c) => [IDENTITY, b, c]));

export const personOf = (assign: Assign, ref: Ref) => assign[ref.cat].indexOf(ref.item);

export function themeById(id: string): Theme {
  const t = THEMES.find((x) => x.id === id);
  if (!t) throw new Error(`unknown theme ${id}`);
  return t;
}

export const ordinalCat = (theme: Theme): number => theme.categories.findIndex((c) => !!c.ordinal);

// ---------------------------------------------------------------------------
// Clue evaluation
// ---------------------------------------------------------------------------

export function holds(clue: Clue, assign: Assign): boolean {
  const pa = personOf(assign, clue.a);
  const pb = personOf(assign, clue.b);
  switch (clue.kind) {
    case 'is':
      return pa === pb;
    case 'not':
      return pa !== pb;
    case 'either':
      return pa === pb || pa === personOf(assign, clue.c);
    case 'before':
      return assign[clue.ord][pa] < assign[clue.ord][pb];
    case 'justBefore':
      return assign[clue.ord][pa] === assign[clue.ord][pb] - 1;
  }
}

/** Indices into ALL_ASSIGNS that satisfy every clue. */
export function solutionsOf(clues: Clue[], within: number[] = ALL_ASSIGNS.map((_, i) => i)): number[] {
  return within.filter((i) => clues.every((c) => holds(c, ALL_ASSIGNS[i])));
}

export const sameAssign = (a: Assign, b: Assign) => a.every((row, k) => row.every((v, i) => v === b[k][i]));

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/** Every true clue about `solution`, with random subject/object orientation. */
export function allTrueClues(theme: Theme, solution: Assign, rng: Rng): Clue[] {
  const out: Clue[] = [];
  const ref = (cat: number, p: number): Ref => ({ cat, item: solution[cat][p] });
  const ord = ordinalCat(theme);
  for (let x = 0; x < 3; x++) {
    for (let y = 0; y < 3; y++) {
      if (x === y) continue;
      for (let p = 0; p < 4; p++) {
        // 'is' / 'not' — one orientation per unordered pair, chosen at random
        if (x < y) {
          // people read best as the subject of a plain statement
          const [s, o] = x === 0 || rng.chance(0.5) ? [x, y] : [y, x];
          out.push({ kind: 'is', a: ref(s, p), b: ref(o, p) });
          for (let q = 0; q < 4; q++) {
            if (q === p) continue;
            const [s2, o2] = rng.chance(0.5) ? [x, y] : [y, x];
            out.push({ kind: 'not', a: ref(s2, s2 === x ? p : q), b: ref(o2, o2 === y ? q : p) });
          }
        }
        // 'either' — subject in x, true + false option in y
        for (let q = 0; q < 4; q++) {
          if (q === p) continue;
          const t = ref(y, p), f = ref(y, q);
          const [b, c] = t.item < f.item ? [t, f] : [f, t]; // list options in their natural order
          out.push({ kind: 'either', a: ref(x, p), b, c });
        }
      }
    }
  }
  if (ord >= 0) {
    const cats = [0, 1, 2].filter((k) => k !== ord);
    for (const x of cats) {
      for (const y of cats) {
        for (let p = 0; p < 4; p++) {
          for (let q = 0; q < 4; q++) {
            if (p === q) continue;
            const op = solution[ord][p], oq = solution[ord][q];
            if (op < oq) out.push({ kind: 'before', a: ref(x, p), b: ref(y, q), ord });
            if (op === oq - 1) out.push({ kind: 'justBefore', a: ref(x, p), b: ref(y, q), ord });
          }
        }
      }
    }
  }
  return out;
}

const WEIGHTS: Record<Difficulty, Record<Clue['kind'], number>> = {
  gentle: { is: 6, not: 1.5, either: 2, before: 1, justBefore: 2.5 },
  tricky: { is: 0.15, not: 3, either: 2.5, before: 3, justBefore: 1.5 },
};
/** Most direct "X is Y" clues a puzzle may keep. */
const MAX_IS: Record<Difficulty, number> = { gentle: 4, tricky: 1 };

/**
 * Seeded generator: random theme and solution; clues drawn (weighted by
 * difficulty) from every true statement until exactly one assignment
 * remains, then pruned so no clue is redundant.
 */
export function generate(seed: number, difficulty: Difficulty): Puzzle {
  const rng = createRng(`mystery-grid:${seed}:${difficulty}`);
  const theme = rng.pick(THEMES);
  for (;;) {
    const solution: Assign = [IDENTITY.slice(), rng.shuffle(IDENTITY), rng.shuffle(IDENTITY)];
    const pool = allTrueClues(theme, solution, rng)
      .map((clue) => ({ clue, key: Math.pow(rng.next(), 1 / WEIGHTS[difficulty][clue.kind]) }))
      .sort((p, q) => q.key - p.key)
      .map((p) => p.clue);

    let cand = ALL_ASSIGNS.map((_, i) => i);
    let chosen: Clue[] = [];
    let isCount = 0;
    for (const clue of pool) {
      if (clue.kind === 'is' && isCount >= MAX_IS[difficulty]) continue;
      const next = cand.filter((i) => holds(clue, ALL_ASSIGNS[i]));
      if (next.length === cand.length) continue; // adds nothing
      chosen.push(clue);
      if (clue.kind === 'is') isCount++;
      cand = next;
      if (cand.length === 1) break;
    }
    if (cand.length !== 1) continue; // can't happen in practice; re-roll
    // Prune redundant clues in random order.
    for (const clue of rng.shuffle(chosen)) {
      const rest = chosen.filter((c) => c !== clue);
      if (solutionsOf(rest).length === 1) chosen = rest;
    }
    return { seed, difficulty, themeId: theme.id, solution, clues: rng.shuffle(chosen) };
  }
}

// ---------------------------------------------------------------------------
// Clue text
// ---------------------------------------------------------------------------

const fill = (tpl: string, item: string) => tpl.replace('{}', item);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function clueText(theme: Theme, clue: Clue): string {
  const cat = (r: Ref) => theme.categories[r.cat];
  const item = (r: Ref) => cat(r).items[r.item];
  const subj = (r: Ref) => fill(cat(r).subject, item(r));
  const obj = (r: Ref) => fill(cat(r).obj, item(r));
  switch (clue.kind) {
    case 'is':
      return cap(`${subj(clue.a)} ${cat(clue.b).verb} ${obj(clue.b)}.`);
    case 'not':
      return cap(`${subj(clue.a)} ${cat(clue.b).negVerb} ${obj(clue.b)}.`);
    case 'either':
      return cap(`${subj(clue.a)} ${cat(clue.b).verb} either ${obj(clue.b)} or ${obj(clue.c)}.`);
    case 'before':
      return cap(`${subj(clue.a)} ${theme.categories[clue.ord].ordinal!.before} ${subj(clue.b)}.`);
    case 'justBefore':
      return cap(`${subj(clue.a)} ${theme.categories[clue.ord].ordinal!.justBefore} ${subj(clue.b)}.`);
  }
}

// ---------------------------------------------------------------------------
// The grid: three 4×4 sub-grids, staircase pairs
// ---------------------------------------------------------------------------

/** [row category, column category] for each sub-grid. */
export const GRIDS: [number, number][] = [
  [0, 1],
  [0, 2],
  [2, 1],
];

export type Mark = 0 | 1 | 2; // empty, ✕ (no), ● (yes)
export const EMPTY: Mark = 0;
export const CROSS: Mark = 1;
export const DOT: Mark = 2;

export const cellIndex = (g: number, r: number, c: number) => g * 16 + r * 4 + c;
export const cellPos = (i: number) => ({ g: Math.floor(i / 16), r: Math.floor((i % 16) / 4), c: i % 4 });
export const emptyMarks = (): Mark[] => Array(48).fill(EMPTY);

/** Is row item r and column item c the same person in this assignment? */
export function truth(assign: Assign, cell: number): Mark {
  const { g, r, c } = cellPos(cell);
  const [rc, cc] = GRIDS[g];
  return personOf(assign, { cat: rc, item: r }) === personOf(assign, { cat: cc, item: c }) ? DOT : CROSS;
}

export const cycleMark = (m: Mark): Mark => ((m + 1) % 3) as Mark;

/** Set a cell; placing ● can also cross out the rest of its row and column. */
export function setMark(marks: Mark[], cell: number, value: Mark, autoCross: boolean): Mark[] {
  const next = marks.slice();
  next[cell] = value;
  if (value === DOT && autoCross) {
    const { g, r, c } = cellPos(cell);
    for (let k = 0; k < 4; k++) {
      if (k !== c && next[cellIndex(g, r, k)] === EMPTY) next[cellIndex(g, r, k)] = CROSS;
      if (k !== r && next[cellIndex(g, k, c)] === EMPTY) next[cellIndex(g, k, c)] = CROSS;
    }
  }
  return next;
}

export const consistentWithMarks = (assign: Assign, marks: Mark[]) => marks.every((m, i) => m === EMPTY || truth(assign, i) === m);

/** Every sub-grid has exactly one ● in each row and each column. */
export function isComplete(marks: Mark[]): boolean {
  for (let g = 0; g < 3; g++) {
    for (let k = 0; k < 4; k++) {
      let row = 0, col = 0;
      for (let j = 0; j < 4; j++) {
        if (marks[cellIndex(g, k, j)] === DOT) row++;
        if (marks[cellIndex(g, j, k)] === DOT) col++;
      }
      if (row !== 1 || col !== 1) return false;
    }
  }
  return true;
}

export interface CheckResult {
  complete: boolean;
  /** Number of ● marks that don't match the solution (out of 12 when complete). */
  wrong: number;
  solved: boolean;
}

export function check(solution: Assign, marks: Mark[]): CheckResult {
  const complete = isComplete(marks);
  let wrong = 0;
  marks.forEach((m, i) => {
    if (m === DOT && truth(solution, i) !== DOT) wrong++;
  });
  return { complete, wrong, solved: complete && wrong === 0 };
}

// ---------------------------------------------------------------------------
// Hints
// ---------------------------------------------------------------------------

export type Hint =
  | { kind: 'wrong'; cell: number; mark: Mark }
  | { kind: 'cell'; cell: number; value: Mark; clues: number[] }
  | { kind: 'none' };

/**
 * One helpful step. If any mark contradicts the solution, point it out.
 * Otherwise find an empty cell whose value is forced, preferring reasons the
 * player can follow: their own marks alone, then one clue, then two, then all.
 */
export function hint(puzzle: Puzzle, marks: Mark[]): Hint {
  const { solution, clues } = puzzle;
  for (let i = 0; i < 48; i++) {
    if (marks[i] !== EMPTY && marks[i] !== truth(solution, i)) return { kind: 'wrong', cell: i, mark: marks[i] };
  }
  const open = marks.map((m, i) => (m === EMPTY ? i : -1)).filter((i) => i >= 0);
  if (open.length === 0) return { kind: 'none' };
  const base = ALL_ASSIGNS.map((_, i) => i).filter((i) => consistentWithMarks(ALL_ASSIGNS[i], marks));

  const forced = (set: number[]): { cell: number; value: Mark } | null => {
    if (set.length === 0) return null;
    let firstCross: { cell: number; value: Mark } | null = null;
    for (const cell of open) {
      const v = truth(ALL_ASSIGNS[set[0]], cell);
      if (set.every((i) => truth(ALL_ASSIGNS[i], cell) === v)) {
        if (v === DOT) return { cell, value: v };
        firstCross ??= { cell, value: v };
      }
    }
    return firstCross;
  };

  const tryWith = (idx: number[]): Hint | null => {
    const f = forced(base.filter((i) => idx.every((k) => holds(clues[k], ALL_ASSIGNS[i]))));
    return f ? { kind: 'cell', ...f, clues: idx } : null;
  };

  const levels: number[][][] = [[[]], clues.map((_, k) => [k])];
  const pairs: number[][] = [];
  for (let a = 0; a < clues.length; a++) for (let b = a + 1; b < clues.length; b++) pairs.push([a, b]);
  levels.push(pairs, [clues.map((_, k) => k)]);
  for (const level of levels) {
    for (const idx of level) {
      const h = tryWith(idx);
      if (h) return h;
    }
  }
  /* c8 ignore next */
  return { kind: 'none' };
}

/** Human description of a cell, e.g. "Ines × leeks". */
export function cellLabel(theme: Theme, cell: number): { row: string; col: string; grid: string } {
  const { g, r, c } = cellPos(cell);
  const [rc, cc] = GRIDS[g];
  return {
    row: theme.categories[rc].items[r],
    col: theme.categories[cc].items[c],
    grid: `${theme.categories[rc].name} × ${theme.categories[cc].name}`,
  };
}

/** One row per person for the solution table. */
export function solutionRows(theme: Theme, solution: Assign): string[][] {
  return [0, 1, 2, 3].map((p) => theme.categories.map((cat, k) => cat.items[solution[k][p]]));
}

/**
 * Personal-best score for a solve: hints taken plus checks that came back
 * wrong (lower is better). There's no clock in Mystery Grid.
 */
export function solveScore(difficulty: Difficulty, hints: number, checks: number): { variant: string; value: number; better: 'lower'; label: string } {
  const wrong = Math.max(0, checks - 1);
  const parts = [hints === 0 ? 'No hints' : `${hints} hint${hints === 1 ? '' : 's'}`];
  if (wrong) parts.push(`${wrong} wrong check${wrong === 1 ? '' : 's'}`);
  return { variant: difficulty, value: hints + wrong, better: 'lower', label: parts.join(' · ') };
}
