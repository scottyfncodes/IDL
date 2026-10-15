/**
 * Picture Logic — pure rules: clues, a complete line solver, hints, drag
 * painting and win detection. No React here.
 *
 * Cells are indexed row-major. Knowledge values: -1 unknown, 0 empty, 1 filled.
 * Player marks: 0 blank, 1 filled, 2 crossed (marked empty).
 */

export type Bitmap = boolean[]; // row-major, length = size * size
export type Knowledge = -1 | 0 | 1;
export type Mark = 0 | 1 | 2;
export const BLANK = 0 as const;
export const FILL = 1 as const;
export const CROSS = 2 as const;

export interface Clues {
  rows: number[][];
  cols: number[][];
}

/** Parse authored rows ('#' filled, anything else empty). */
export function parseBitmap(rows: readonly string[]): Bitmap {
  return rows.join('').split('').map((c) => c === '#');
}

/** Runs of filled cells in a line. An empty line has the clue []. */
export function runs(line: readonly (boolean | number)[]): number[] {
  const out: number[] = [];
  let n = 0;
  for (const v of line) {
    if (v === true || v === 1) n++;
    else if (n) {
      out.push(n);
      n = 0;
    }
  }
  if (n) out.push(n);
  return out;
}

export const rowOf = <T>(cells: readonly T[], size: number, r: number): T[] => cells.slice(r * size, r * size + size);
export const colOf = <T>(cells: readonly T[], size: number, c: number): T[] => Array.from({ length: size }, (_, r) => cells[r * size + c]);

export function deriveClues(bitmap: Bitmap, size: number): Clues {
  return {
    rows: Array.from({ length: size }, (_, r) => runs(rowOf(bitmap, size, r))),
    cols: Array.from({ length: size }, (_, c) => runs(colOf(bitmap, size, c))),
  };
}

// ---------------------------------------------------------------------------
// Line solver: enumerate every placement of the clue that agrees with what is
// already known, then keep the cells that agree across all placements.
// ---------------------------------------------------------------------------

/**
 * Returns the line with every forced cell filled in, or null if no placement
 * of the clue fits (a contradiction).
 */
export function solveLine(clue: readonly number[], line: readonly Knowledge[]): Knowledge[] | null {
  const n = line.length;
  const canFill = new Array<boolean>(n).fill(false);
  const canEmpty = new Array<boolean>(n).fill(false);
  const cur = new Array<number>(n).fill(0);
  let found = false;
  // Minimum length needed for blocks k.. (blocks plus single gaps).
  const minLen = new Array<number>(clue.length + 1).fill(0);
  for (let k = clue.length - 1; k >= 0; k--) minLen[k] = clue[k] + (k < clue.length - 1 ? 1 : 0) + minLen[k + 1];

  const place = (k: number, pos: number) => {
    if (k === clue.length) {
      for (let j = pos; j < n; j++) if (line[j] === 1) return;
      found = true;
      for (let j = 0; j < n; j++) {
        if (j < pos ? cur[j] : 0) canFill[j] = true;
        else canEmpty[j] = true;
      }
      return;
    }
    const len = clue[k];
    for (let s = pos; s + minLen[k] <= n; s++) {
      // Cells pos..s-1 are empty: stop once one of them is known filled.
      if (s > pos && line[s - 1] === 1) break;
      let ok = true;
      for (let j = s; j < s + len; j++) if (line[j] === 0) { ok = false; break; }
      if (!ok) continue;
      const end = s + len;
      if (end < n && line[end] === 1) continue;
      for (let j = pos; j < s; j++) cur[j] = 0;
      for (let j = s; j < end; j++) cur[j] = 1;
      if (end < n) cur[end] = 0;
      place(k + 1, Math.min(n, end + 1));
    }
  };
  place(0, 0);
  if (!found) return null;
  return line.map((v, j) => (v !== -1 ? v : canFill[j] && !canEmpty[j] ? 1 : canEmpty[j] && !canFill[j] ? 0 : -1));
}

export interface GridSolve {
  cells: Knowledge[];
  contradiction: boolean;
  complete: boolean;
}

/** Repeatedly apply the line solver to every row and column. */
export function solveGrid(clues: Clues, start?: readonly Knowledge[]): GridSolve {
  const size = clues.rows.length;
  const cells: Knowledge[] = start ? start.slice() : new Array<Knowledge>(size * size).fill(-1);
  let changed = true;
  while (changed) {
    changed = false;
    for (let axis = 0; axis < 2; axis++) {
      for (let k = 0; k < size; k++) {
        const idx = Array.from({ length: size }, (_, j) => (axis === 0 ? k * size + j : j * size + k));
        const line = idx.map((i) => cells[i]);
        if (!line.includes(-1)) {
          if (solveLine(axis === 0 ? clues.rows[k] : clues.cols[k], line) === null) return { cells, contradiction: true, complete: false };
          continue;
        }
        const next = solveLine(axis === 0 ? clues.rows[k] : clues.cols[k], line);
        if (!next) return { cells, contradiction: true, complete: false };
        next.forEach((v, j) => {
          if (v !== line[j]) {
            cells[idx[j]] = v;
            changed = true;
          }
        });
      }
    }
  }
  return { cells, contradiction: false, complete: !cells.includes(-1) };
}

/** True when line logic alone reaches exactly this picture. */
export function isLineSolvable(bitmap: Bitmap, size: number): boolean {
  const r = solveGrid(deriveClues(bitmap, size));
  return r.complete && !r.contradiction && r.cells.every((v, i) => (v === 1) === bitmap[i]);
}

// ---------------------------------------------------------------------------
// Play
// ---------------------------------------------------------------------------

export const emptyMarks = (size: number): Mark[] => new Array<Mark>(size * size).fill(BLANK);

/** Solved when the filled cells are exactly the picture (crosses don't matter). */
export function isSolved(marks: readonly Mark[], bitmap: Bitmap): boolean {
  return marks.length === bitmap.length && marks.every((m, i) => (m === FILL) === bitmap[i]);
}

/** Does this line's filled pattern already match its clue? */
export function lineSatisfied(clue: readonly number[], line: readonly Mark[]): boolean {
  const r = runs(line.map((m) => m === FILL));
  return r.length === clue.length && r.every((v, i) => v === clue[i]);
}

/** Filled where it should be empty, or crossed where it should be filled. */
export function countMistakes(marks: readonly Mark[], bitmap: Bitmap): number {
  let n = 0;
  marks.forEach((m, i) => {
    if ((m === FILL && !bitmap[i]) || (m === CROSS && bitmap[i])) n++;
  });
  return n;
}

export interface Hint {
  index: number;
  value: 'fill' | 'cross';
}

/**
 * A cell that line logic forces from what the player has right so far. Wrong
 * marks are ignored (treated as unknown). Prefers a cell to fill; offers a
 * cross only when nothing is left to fill. Null when the picture is complete.
 */
export function findHint(marks: readonly Mark[], bitmap: Bitmap, clues: Clues): Hint | null {
  const size = clues.rows.length;
  const know: Knowledge[] = marks.map((m, i) => (m === FILL && bitmap[i] ? 1 : m === CROSS && !bitmap[i] ? 0 : -1));
  let crossCandidate: number | null = null;
  // Step line by line from the player's knowledge; the first newly forced
  // filled cell that the player hasn't filled is the hint.
  for (let guard = 0; guard < size * size * 4; guard++) {
    let progressed = false;
    for (let axis = 0; axis < 2; axis++) {
      for (let k = 0; k < size; k++) {
        const idx = Array.from({ length: size }, (_, j) => (axis === 0 ? k * size + j : j * size + k));
        const line = idx.map((i) => know[i]);
        if (!line.includes(-1)) continue;
        const next = solveLine(axis === 0 ? clues.rows[k] : clues.cols[k], line);
        if (!next) return null; // cannot happen for consistent knowledge
        for (let j = 0; j < size; j++) {
          if (line[j] !== -1 || next[j] === -1) continue;
          const i = idx[j];
          if (next[j] === 1 && marks[i] !== FILL) return { index: i, value: 'fill' };
          if (next[j] === 0 && marks[i] !== CROSS && crossCandidate === null) crossCandidate = i;
          know[i] = next[j];
          progressed = true;
        }
      }
    }
    if (!progressed) break;
  }
  // Every filled cell is in place? Offer a cross, if any are still unmarked.
  const missingFill = bitmap.findIndex((b, i) => b && marks[i] !== FILL);
  if (missingFill !== -1) return { index: missingFill, value: 'fill' }; // only for non-line-solvable input
  if (crossCandidate !== null) return { index: crossCandidate, value: 'cross' };
  const wrongFill = marks.findIndex((m, i) => m === FILL && !bitmap[i]);
  return wrongFill === -1 ? null : { index: wrongFill, value: 'cross' };
}

// ---------------------------------------------------------------------------
// Drag painting
// ---------------------------------------------------------------------------

/**
 * Cells a stroke covers: a straight run along the row or column of the start
 * cell, whichever axis the pointer has moved along more.
 */
export function strokeCells(size: number, start: number, end: number): number[] {
  const r0 = Math.floor(start / size);
  const c0 = start % size;
  const r1 = Math.floor(end / size);
  const c1 = end % size;
  const out: number[] = [];
  if (Math.abs(c1 - c0) >= Math.abs(r1 - r0)) {
    const step = c1 >= c0 ? 1 : -1;
    for (let c = c0; c !== c1 + step; c += step) out.push(r0 * size + c);
  } else {
    const step = r1 >= r0 ? 1 : -1;
    for (let r = r0; r !== r1 + step; r += step) out.push(r * size + c0);
  }
  return out;
}

export type StrokeAction = { kind: 'set'; mark: 1 | 2 } | { kind: 'clear'; mark: 1 | 2 };

/**
 * What a stroke does is decided by the first cell: touching a cell that
 * already has the current mode's mark clears that mark along the stroke;
 * otherwise the stroke sets it.
 */
export function strokeAction(base: readonly Mark[], start: number, mode: 1 | 2): StrokeAction {
  return base[start] === mode ? { kind: 'clear', mark: mode } : { kind: 'set', mark: mode };
}

/**
 * Apply a stroke to a snapshot taken when the stroke began (so pulling the
 * finger back un-paints). Setting never overwrites the other kind of mark,
 * except on the starting cell, so a fill stroke won't wipe your crosses.
 */
export function applyStroke(base: readonly Mark[], cells: readonly number[], action: StrokeAction): Mark[] {
  const out = base.slice();
  cells.forEach((i, k) => {
    if (action.kind === 'clear') {
      if (out[i] === action.mark) out[i] = BLANK;
    } else if (out[i] === BLANK || k === 0) out[i] = action.mark;
  });
  return out;
}

// ---------------------------------------------------------------------------
// Compact storage
// ---------------------------------------------------------------------------

export const encodeMarks = (marks: readonly Mark[]): string => marks.join('');
export function decodeMarks(s: unknown, size: number): Mark[] {
  if (typeof s !== 'string' || s.length !== size * size || /[^012]/.test(s)) return emptyMarks(size);
  return s.split('').map((c) => Number(c) as Mark);
}

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, '0')}`;
}
