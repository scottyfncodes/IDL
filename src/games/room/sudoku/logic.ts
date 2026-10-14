/**
 * Pocket Sudoku — rules, solver, generator and play helpers.
 * Pure functions, no React. A grid is 81 numbers in row-major order, 0 = empty.
 */
import { createRng, type Rng } from '../../../lib/rng';

export type Grid = number[];
export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

/** Inclusive clue-count ranges per difficulty. */
export const CLUE_RANGE: Record<Difficulty, [number, number]> = {
  easy: [38, 42],
  medium: [30, 34],
  hard: [25, 28],
};

export const rowOf = (i: number) => Math.floor(i / 9);
export const colOf = (i: number) => i % 9;
export const boxOf = (i: number) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);

/** Every unit (9 rows, 9 cols, 9 boxes) as a list of cell indices. */
export const UNITS: number[][] = (() => {
  const u: number[][] = [];
  for (let r = 0; r < 9; r++) u.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) u.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  for (let b = 0; b < 9; b++) {
    const r0 = Math.floor(b / 3) * 3;
    const c0 = (b % 3) * 3;
    u.push(Array.from({ length: 9 }, (_, k) => (r0 + Math.floor(k / 3)) * 9 + c0 + (k % 3)));
  }
  return u;
})();

/** The 20 peers of every cell (same row, column or box). */
export const PEERS: number[][] = Array.from({ length: 81 }, (_, i) => {
  const s = new Set<number>();
  for (let k = 0; k < 81; k++) {
    if (k !== i && (rowOf(k) === rowOf(i) || colOf(k) === colOf(i) || boxOf(k) === boxOf(i))) s.add(k);
  }
  return [...s];
});

const ALL = 0x3fe; // bits 1..9
const bit = (d: number) => 1 << d;
const popcount = (m: number) => {
  let n = 0;
  while (m) {
    m &= m - 1;
    n++;
  }
  return n;
};
const digitsOf = (m: number) => {
  const out: number[] = [];
  for (let d = 1; d <= 9; d++) if (m & bit(d)) out.push(d);
  return out;
};

export const emptyGrid = (): Grid => Array(81).fill(0);

// ---------------------------------------------------------------------------
// Rule validation
// ---------------------------------------------------------------------------

/** Can digit d go in cell i without clashing with any peer? (ignores the cell's own value) */
export function canPlace(grid: Grid, i: number, d: number): boolean {
  for (const p of PEERS[i]) if (grid[p] === d) return false;
  return true;
}

/** Indices of every filled cell that shares a digit with a peer. */
export function conflicts(grid: Grid): Set<number> {
  const out = new Set<number>();
  for (const unit of UNITS) {
    const seen = new Map<number, number[]>();
    for (const i of unit) {
      const d = grid[i];
      if (!d) continue;
      const list = seen.get(d) ?? [];
      list.push(i);
      seen.set(d, list);
    }
    for (const list of seen.values()) if (list.length > 1) list.forEach((i) => out.add(i));
  }
  return out;
}

/** A complete grid that obeys every rule. */
export function isSolvedGrid(grid: Grid): boolean {
  return grid.length === 81 && grid.every((d) => d >= 1 && d <= 9) && conflicts(grid).size === 0;
}

// ---------------------------------------------------------------------------
// Solver (bitmask backtracking, most-constrained cell first)
// ---------------------------------------------------------------------------

interface SearchState {
  grid: Grid;
  rows: number[];
  cols: number[];
  boxes: number[];
}

function initState(grid: Grid): SearchState | null {
  const s: SearchState = { grid: grid.slice(), rows: Array(9).fill(0), cols: Array(9).fill(0), boxes: Array(9).fill(0) };
  for (let i = 0; i < 81; i++) {
    const d = grid[i];
    if (!d) continue;
    const b = bit(d);
    const r = rowOf(i), c = colOf(i), x = boxOf(i);
    if (s.rows[r] & b || s.cols[c] & b || s.boxes[x] & b) return null; // already broken
    s.rows[r] |= b;
    s.cols[c] |= b;
    s.boxes[x] |= b;
  }
  return s;
}

/** Find the empty cell with fewest candidates. Returns -1 when full, -2 on a dead end. */
function pickCell(s: SearchState): { i: number; mask: number } {
  let best = -1;
  let bestMask = 0;
  let bestCount = 10;
  for (let i = 0; i < 81; i++) {
    if (s.grid[i]) continue;
    const mask = ALL & ~(s.rows[rowOf(i)] | s.cols[colOf(i)] | s.boxes[boxOf(i)]);
    const n = popcount(mask);
    if (n === 0) return { i: -2, mask: 0 };
    if (n < bestCount) {
      best = i;
      bestMask = mask;
      bestCount = n;
      if (n === 1) break;
    }
  }
  return { i: best, mask: bestMask };
}

function search(s: SearchState, limit: number, found: Grid[], rng?: Rng): number {
  const { i, mask } = pickCell(s);
  if (i === -2) return 0;
  if (i === -1) {
    found.push(s.grid.slice());
    return 1;
  }
  let count = 0;
  const digits = rng ? rng.shuffle(digitsOf(mask)) : digitsOf(mask);
  const r = rowOf(i), c = colOf(i), x = boxOf(i);
  for (const d of digits) {
    const b = bit(d);
    s.grid[i] = d;
    s.rows[r] |= b;
    s.cols[c] |= b;
    s.boxes[x] |= b;
    count += search(s, limit - count, found, rng);
    s.grid[i] = 0;
    s.rows[r] &= ~b;
    s.cols[c] &= ~b;
    s.boxes[x] &= ~b;
    if (count >= limit) break;
  }
  return count;
}

/** Number of solutions, counting no further than `limit` (default 2: enough to test uniqueness). */
export function countSolutions(grid: Grid, limit = 2): number {
  const s = initState(grid);
  if (!s) return 0;
  return search(s, limit, []);
}

/** The first solution found, or null if there is none. */
export function solve(grid: Grid): Grid | null {
  const s = initState(grid);
  if (!s) return null;
  const found: Grid[] = [];
  search(s, 1, found);
  return found[0] ?? null;
}

/** A random complete, valid grid. */
export function randomFullGrid(rng: Rng): Grid {
  const s = initState(emptyGrid())!;
  const found: Grid[] = [];
  search(s, 1, found, rng);
  return found[0];
}

// ---------------------------------------------------------------------------
// Human-style grading: naked + hidden singles only
// ---------------------------------------------------------------------------

/**
 * Fill as much as possible using only naked singles (a cell with one candidate)
 * and hidden singles (a digit with one home in a unit). Returns the resulting grid.
 */
export function solveWithSingles(grid: Grid): Grid {
  const g = grid.slice();
  const cand = (i: number) => {
    let used = 0;
    for (const p of PEERS[i]) used |= bit(g[p]);
    return ALL & ~used;
  };
  let progress = true;
  while (progress) {
    progress = false;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const m = cand(i);
      if (popcount(m) === 1) {
        g[i] = digitsOf(m)[0];
        progress = true;
      }
    }
    for (const unit of UNITS) {
      for (let d = 1; d <= 9; d++) {
        if (unit.some((i) => g[i] === d)) continue;
        let home = -1;
        let n = 0;
        for (const i of unit) {
          if (!g[i] && cand(i) & bit(d)) {
            home = i;
            n++;
            if (n > 1) break;
          }
        }
        if (n === 1) {
          g[home] = d;
          progress = true;
        }
      }
    }
  }
  return g;
}

export const solvableBySingles = (grid: Grid) => solveWithSingles(grid).every(Boolean);

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

export interface Puzzle {
  puzzle: Grid; // givens, 0 = blank
  solution: Grid;
  difficulty: Difficulty;
  seed: number;
}

export const clueCount = (grid: Grid) => grid.filter(Boolean).length;

/**
 * Seeded generator. Builds a random full grid, then removes clues in
 * 180°-symmetric pairs (random order) while the puzzle stays uniquely
 * solvable, stopping at a target count inside the difficulty's range.
 * Easy puzzles must also fall to naked/hidden singles alone; Hard puzzles
 * must not (they need at least one step beyond singles).
 * Never returns a puzzle without exactly one solution.
 */
export function generate(seed: number, difficulty: Difficulty): Puzzle {
  const rng = createRng(`sudoku:${seed}:${difficulty}`);
  const [lo, hi] = CLUE_RANGE[difficulty];
  for (let attempt = 0; attempt < 200; attempt++) {
    const solution = randomFullGrid(rng);
    const puzzle = solution.slice();
    const target = rng.int(lo, hi);
    let clues = 81;
    // cells 0..40 with their mirror 80-i (cell 40 is its own mirror)
    const order = rng.shuffle(Array.from({ length: 41 }, (_, i) => i));
    for (const i of order) {
      if (clues <= target) break;
      const j = 80 - i;
      const n = i === j ? 1 : 2;
      if (clues - n < lo) continue;
      const a = puzzle[i], b = puzzle[j];
      puzzle[i] = 0;
      puzzle[j] = 0;
      const ok = countSolutions(puzzle, 2) === 1 && (difficulty !== 'easy' || solvableBySingles(puzzle));
      if (ok) clues -= n;
      else {
        puzzle[i] = a;
        puzzle[j] = b;
      }
    }
    // Hard grids must need more than singles somewhere.
    const graded = difficulty !== 'hard' || !solvableBySingles(puzzle);
    if (clues >= lo && clues <= hi && graded && countSolutions(puzzle, 2) === 1) {
      return { puzzle, solution, difficulty, seed };
    }
  }
  /* c8 ignore next */
  throw new Error('sudoku generator exhausted');
}

// ---------------------------------------------------------------------------
// Play state helpers
// ---------------------------------------------------------------------------

/** Notes are a 9-bit mask per cell: bit d set = pencil mark d. */
export const hasNote = (mask: number, d: number) => (mask & bit(d)) !== 0;
export const toggleNoteMask = (mask: number, d: number) => mask ^ bit(d);
export const noteDigits = (mask: number) => digitsOf(mask);

export interface Board {
  givens: Grid;
  values: Grid; // includes givens
  notes: number[];
}

/** One undoable step: previous value + notes of each cell it touched. */
export interface Change {
  cells: [index: number, value: number, notes: number][];
}

export interface MoveResult {
  board: Board;
  change: Change | null;
  mistake: boolean;
}

function snapshot(board: Board, idx: number[]): Change {
  return { cells: idx.map((i) => [i, board.values[i], board.notes[i]]) };
}

/**
 * Put digit d in cell i (or remove it if the same digit is already there).
 * Clears the cell's notes and the d-note from every peer.
 */
export function placeDigit(board: Board, i: number, d: number, solution: Grid): MoveResult {
  if (board.givens[i]) return { board, change: null, mistake: false };
  if (board.values[i] === d) return eraseCell(board, i);
  const touched = [i, ...PEERS[i].filter((p) => !board.values[p] && hasNote(board.notes[p], d))];
  const change = snapshot(board, touched);
  const values = board.values.slice();
  const notes = board.notes.slice();
  values[i] = d;
  notes[i] = 0;
  for (const p of touched) if (p !== i) notes[p] = toggleNoteMask(notes[p], d);
  return { board: { ...board, values, notes }, change, mistake: solution[i] !== d };
}

/** Toggle pencil mark d in an empty cell. */
export function toggleNote(board: Board, i: number, d: number): MoveResult {
  if (board.givens[i] || board.values[i]) return { board, change: null, mistake: false };
  const change = snapshot(board, [i]);
  const notes = board.notes.slice();
  notes[i] = toggleNoteMask(notes[i], d);
  return { board: { ...board, notes }, change, mistake: false };
}

/** Clear a player digit, or all notes in an empty cell. */
export function eraseCell(board: Board, i: number): MoveResult {
  if (board.givens[i] || (!board.values[i] && !board.notes[i])) return { board, change: null, mistake: false };
  const change = snapshot(board, [i]);
  const values = board.values.slice();
  const notes = board.notes.slice();
  values[i] = 0;
  notes[i] = 0;
  return { board: { ...board, values, notes }, change, mistake: false };
}

export function undoChange(board: Board, change: Change): Board {
  const values = board.values.slice();
  const notes = board.notes.slice();
  for (const [i, v, n] of change.cells) {
    values[i] = v;
    notes[i] = n;
  }
  return { ...board, values, notes };
}

export const isWon = (values: Grid, solution: Grid) => values.every((v, i) => v === solution[i]);

/** Digits 1..9 whose nine cells are all correctly filled. */
export function completedDigits(values: Grid, solution: Grid): Set<number> {
  const counts = Array(10).fill(0);
  values.forEach((v, i) => {
    if (v && v === solution[i]) counts[v]++;
  });
  const out = new Set<number>();
  for (let d = 1; d <= 9; d++) if (counts[d] === 9) out.add(d);
  return out;
}

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
