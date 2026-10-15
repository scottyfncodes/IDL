/**
 * Mines — pure rules, generation and a no-guess solver. No React here.
 *
 * Cells are indexed row-major: i = row * cols + col.
 */
import { createRng } from '../../../lib/rng';

export type SizeId = 'small' | 'medium' | 'large';

export interface SizeSpec {
  cols: number;
  rows: number;
  mines: number;
  label: string;
}

/**
 * Columns are capped at 10 so every cell stays at least ~36px wide on a
 * 375px phone. The large field is taller instead of wider and scrolls
 * vertically on short screens.
 */
export const SIZES: Record<SizeId, SizeSpec> = {
  small: { cols: 8, rows: 8, mines: 10, label: 'Small' },
  medium: { cols: 10, rows: 12, mines: 20, label: 'Medium' },
  large: { cols: 10, rows: 19, mines: 36, label: 'Large' },
};
export const SIZE_IDS: SizeId[] = ['small', 'medium', 'large'];

/** 0 hidden, 1 revealed, 2 flagged. */
export type CellState = 0 | 1 | 2;
export const HIDDEN = 0 as const;
export const REVEALED = 1 as const;
export const FLAGGED = 2 as const;

export type Status = 'ready' | 'playing' | 'won' | 'lost';

export interface Field {
  cols: number;
  rows: number;
  mineCount: number;
  /** Mine indices; empty until the first reveal. */
  mines: number[];
  cells: CellState[];
  status: Status;
  /** The mine that ended the game, if any. */
  exploded: number | null;
}

export const neighbours = (cols: number, rows: number, i: number): number[] => {
  const r = Math.floor(i / cols);
  const c = i % cols;
  const out: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const rr = r + dr;
      const cc = c + dc;
      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) out.push(rr * cols + cc);
    }
  }
  return out;
};

/** Precomputed neighbour lists for a board size. */
const nbCache = new Map<string, number[][]>();
export function neighbourTable(cols: number, rows: number): number[][] {
  const key = `${cols}x${rows}`;
  let t = nbCache.get(key);
  if (!t) {
    t = Array.from({ length: cols * rows }, (_, i) => neighbours(cols, rows, i));
    nbCache.set(key, t);
  }
  return t;
}

export function mineMask(n: number, mines: readonly number[]): Uint8Array {
  const m = new Uint8Array(n);
  for (const i of mines) m[i] = 1;
  return m;
}

/** Adjacent-mine count for every cell (mines themselves get their count too). */
export function adjacentCounts(cols: number, rows: number, mines: readonly number[]): number[] {
  const nb = neighbourTable(cols, rows);
  const counts = new Array<number>(cols * rows).fill(0);
  for (const m of mines) for (const j of nb[m]) counts[j]++;
  return counts;
}

export function newField(size: SizeId): Field {
  const s = SIZES[size];
  return { cols: s.cols, rows: s.rows, mineCount: s.mines, mines: [], cells: Array(s.cols * s.rows).fill(HIDDEN), status: 'ready', exploded: null };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

/** Place mines at random, never on `safe` or its neighbours. */
export function placeMines(cols: number, rows: number, count: number, safe: number, rng: { int(a: number, b: number): number }): number[] {
  const n = cols * rows;
  const banned = new Set([safe, ...neighbourTable(cols, rows)[safe]]);
  const pool: number[] = [];
  for (let i = 0; i < n; i++) if (!banned.has(i)) pool.push(i);
  const k = Math.min(count, pool.length);
  // Partial Fisher–Yates.
  for (let i = 0; i < k; i++) {
    const j = rng.int(i, pool.length - 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, k).sort((a, b) => a - b);
}

export interface Generated {
  mines: number[];
  /** True when the board was verified to need no guessing. */
  noGuess: boolean;
  attempts: number;
}

export const NO_GUESS_MAX_ATTEMPTS = 250;

/**
 * Generate a mine layout after the first tap at `safe`. With `noGuess`, keep
 * drawing (from the same seeded stream) until the solver can clear the board
 * from that tap without guessing; give up after a budget of attempts and fall
 * back to the last ordinary layout.
 */
export function generateMines(cols: number, rows: number, count: number, safe: number, seed: number, noGuess: boolean, maxAttempts = NO_GUESS_MAX_ATTEMPTS): Generated {
  const rng = createRng(`mines:v1:${seed}`);
  let mines = placeMines(cols, rows, count, safe, rng);
  if (!noGuess) return { mines, noGuess: false, attempts: 1 };
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt > 1) mines = placeMines(cols, rows, count, safe, rng);
    if (solve(cols, rows, mines, safe).solved) return { mines, noGuess: true, attempts: attempt };
  }
  return { mines, noGuess: false, attempts: maxAttempts };
}

// ---------------------------------------------------------------------------
// Solver (single-cell rules + subset rule + global count)
// ---------------------------------------------------------------------------

export interface SolveResult {
  solved: boolean;
  /** Cells the solver managed to reveal (including the start region). */
  revealed: number;
}

/**
 * Plays the board the way a careful human would, never guessing:
 *  - a number whose mines are all found clears its other neighbours;
 *  - a number with exactly as many hidden neighbours as missing mines flags them;
 *  - subset rule: if A's unknowns ⊆ B's unknowns, B \ A holds (b − a) mines;
 *  - global count: when remaining mines are 0 or equal to the remaining unknowns.
 */
export function solve(cols: number, rows: number, mines: readonly number[], start: number, rules: { subset?: boolean; global?: boolean } = {}): SolveResult {
  const useSubset = rules.subset ?? true;
  const useGlobal = rules.global ?? true;
  const n = cols * rows;
  const nb = neighbourTable(cols, rows);
  const isMine = mineMask(n, mines);
  if (isMine[start]) return { solved: false, revealed: 0 };
  const counts = adjacentCounts(cols, rows, mines);
  // 0 unknown, 1 revealed (safe), 2 known mine
  const know = new Uint8Array(n);
  let revealed = 0;
  let knownMines = 0;
  const safeTotal = n - mines.length;

  const open = (i: number) => {
    if (know[i] !== 0) return;
    const stack = [i];
    know[i] = 1;
    revealed++;
    while (stack.length) {
      const c = stack.pop()!;
      if (counts[c] !== 0) continue;
      for (const j of nb[c]) {
        if (know[j] === 0) {
          know[j] = 1;
          revealed++;
          stack.push(j);
        }
      }
    }
  };
  const mark = (i: number) => {
    if (know[i] === 0) {
      know[i] = 2;
      knownMines++;
    }
  };

  open(start);
  while (revealed < safeTotal) {
    let progress = false;
    // Constraints from the frontier.
    const cons: { cells: number[]; need: number }[] = [];
    for (let i = 0; i < n; i++) {
      if (know[i] !== 1 || counts[i] === 0) continue;
      const unk: number[] = [];
      let flagged = 0;
      for (const j of nb[i]) {
        if (know[j] === 0) unk.push(j);
        else if (know[j] === 2) flagged++;
      }
      if (!unk.length) continue;
      const need = counts[i] - flagged;
      if (need === 0) {
        for (const j of unk) open(j);
        progress = true;
      } else if (need === unk.length) {
        for (const j of unk) mark(j);
        progress = true;
      } else cons.push({ cells: unk, need });
    }
    if (progress) continue;
    if (!useSubset && !useGlobal) break;

    // Subset rule. Constraints are small (≤ 8 cells), so pairwise is cheap.
    const byCell = new Map<number, number[]>();
    cons.forEach((c, k) => c.cells.forEach((cell) => (byCell.get(cell) ?? byCell.set(cell, []).get(cell)!).push(k)));
    outer: for (let a = 0; useSubset && a < cons.length; a++) {
      const A = cons[a];
      const candidates = new Set<number>();
      for (const cell of A.cells) for (const b of byCell.get(cell)!) if (b !== a) candidates.add(b);
      for (const b of candidates) {
        const B = cons[b];
        if (B.cells.length <= A.cells.length) continue;
        if (!A.cells.every((x) => B.cells.includes(x))) continue;
        const rest = B.cells.filter((x) => !A.cells.includes(x));
        const diff = B.need - A.need;
        if (diff === 0) {
          for (const j of rest) open(j);
          progress = true;
        } else if (diff === rest.length) {
          for (const j of rest) mark(j);
          progress = true;
        }
        if (progress) break outer;
      }
    }
    if (progress) continue;

    // Global mine count.
    if (!useGlobal) break;
    const left = mines.length - knownMines;
    let unknown = 0;
    for (let i = 0; i < n; i++) if (know[i] === 0) unknown++;
    if (unknown > 0 && left === 0) {
      for (let i = 0; i < n; i++) if (know[i] === 0) open(i);
      continue;
    }
    if (unknown > 0 && left === unknown) {
      for (let i = 0; i < n; i++) if (know[i] === 0) mark(i);
      continue;
    }
    break;
  }
  return { solved: revealed === safeTotal, revealed };
}

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

/** Reveal `i` and flood-fill outward from any zero. Assumes `i` is safe. */
export function floodReveal(f: Field, cells: CellState[], i: number, counts: number[], isMine: Uint8Array): void {
  const nb = neighbourTable(f.cols, f.rows);
  if (cells[i] !== HIDDEN || isMine[i]) return;
  const stack = [i];
  cells[i] = REVEALED;
  while (stack.length) {
    const c = stack.pop()!;
    if (counts[c] !== 0) continue;
    for (const j of nb[c]) {
      if (cells[j] === HIDDEN && !isMine[j]) {
        cells[j] = REVEALED;
        stack.push(j);
      }
    }
  }
}

export function isCleared(cells: readonly CellState[], isMine: Uint8Array): boolean {
  for (let i = 0; i < cells.length; i++) if (!isMine[i] && cells[i] !== REVEALED) return false;
  return true;
}

function finish(f: Field, cells: CellState[], isMine: Uint8Array, exploded: number | null): Field {
  if (exploded !== null) return { ...f, cells, status: 'lost', exploded };
  if (isCleared(cells, isMine)) {
    // Flag every mine on a win so the finished board reads cleanly.
    return { ...f, cells: cells.map((c, i) => (isMine[i] ? FLAGGED : c)), status: 'won' };
  }
  return { ...f, cells, status: 'playing' };
}

/** Reveal a single hidden cell. On a 'ready' field, `mines` must be supplied (see generateMines). */
export function reveal(f: Field, i: number, minesForFirst?: number[]): Field {
  if (f.status === 'won' || f.status === 'lost') return f;
  let field = f;
  if (f.status === 'ready') {
    if (!minesForFirst) throw new Error('first reveal needs a mine layout');
    field = { ...f, mines: minesForFirst, status: 'playing' };
  }
  if (field.cells[i] !== HIDDEN) return field === f ? f : field;
  const isMine = mineMask(field.cells.length, field.mines);
  const cells = field.cells.slice();
  if (isMine[i]) {
    cells[i] = REVEALED;
    return finish(field, cells, isMine, i);
  }
  floodReveal(field, cells, i, adjacentCounts(field.cols, field.rows, field.mines), isMine);
  return finish(field, cells, isMine, null);
}

export function toggleFlag(f: Field, i: number): Field {
  if (f.status === 'won' || f.status === 'lost') return f;
  const c = f.cells[i];
  if (c === REVEALED) return f;
  const cells = f.cells.slice();
  cells[i] = c === FLAGGED ? HIDDEN : FLAGGED;
  return { ...f, cells };
}

/**
 * Chord: on a revealed number whose adjacent flags equal its count, reveal
 * every other hidden neighbour. A wrongly placed flag means a mine gets
 * revealed — and the game is lost.
 */
export function chord(f: Field, i: number): Field {
  if (f.status !== 'playing' || f.cells[i] !== REVEALED) return f;
  const nb = neighbourTable(f.cols, f.rows)[i];
  const counts = adjacentCounts(f.cols, f.rows, f.mines);
  const isMine = mineMask(f.cells.length, f.mines);
  if (isMine[i] || counts[i] === 0) return f;
  const flags = nb.filter((j) => f.cells[j] === FLAGGED).length;
  if (flags !== counts[i]) return f;
  const hidden = nb.filter((j) => f.cells[j] === HIDDEN);
  if (!hidden.length) return f;
  const cells = f.cells.slice();
  let exploded: number | null = null;
  for (const j of hidden) {
    if (isMine[j]) {
      cells[j] = REVEALED;
      if (exploded === null) exploded = j;
    } else floodReveal(f, cells, j, counts, isMine);
  }
  return finish(f, cells, isMine, exploded);
}

export const flagsPlaced = (f: Field) => f.cells.reduce<number>((n, c) => n + (c === FLAGGED ? 1 : 0), 0);
export const minesLeft = (f: Field) => f.mineCount - flagsPlaced(f);

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** Validate a stored field (saved data may be stale or corrupt). */
export function isValidField(f: unknown): f is Field {
  if (!f || typeof f !== 'object') return false;
  const x = f as Field;
  return (
    Number.isInteger(x.cols) &&
    Number.isInteger(x.rows) &&
    Array.isArray(x.cells) &&
    x.cells.length === x.cols * x.rows &&
    Array.isArray(x.mines) &&
    ['ready', 'playing', 'won', 'lost'].includes(x.status)
  );
}
