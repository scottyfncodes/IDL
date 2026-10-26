/**
 * Couplet board interactions as pure functions over a list of placements.
 * The UI turns taps and drags into these calls; tests drive them directly.
 */
import { cellValues, isSolved, neighbours, regionStatuses, type Board, type Placement } from './logic';

/** Direction from a domino's first half to its second: right, down, left, up. */
export type Dir = 0 | 1 | 2 | 3;
export const DIRS: Dir[] = [0, 1, 2, 3];

export function step(board: Board, cell: number, dir: Dir): number {
  const r = Math.floor(cell / board.w);
  const c = cell % board.w;
  const [dr, dc] = [[0, 1], [1, 0], [0, -1], [-1, 0]][dir];
  const nr = r + dr;
  const nc = c + dc;
  if (nr < 0 || nc < 0 || nr >= board.h || nc >= board.w) return -1;
  return nr * board.w + nc;
}

export function dirBetween(board: Board, a: number, b: number): Dir {
  if (b === a + 1) return 0;
  if (b === a + board.w) return 1;
  if (b === a - 1) return 2;
  return 3;
}

export interface TierState {
  placements: Placement[];
  /** Dominoes placed by a hint: fixed in their solution spot. */
  hinted: number[];
  /** Milliseconds spent on this board so far. */
  ms: number;
  solved: boolean;
}

export const emptyTier = (): TierState => ({ placements: [], hinted: [], ms: 0, solved: false });

const onBoard = (board: Board) => new Set(board.cells);

/** Cell → domino currently covering it. */
export function occupancy(placements: Placement[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const p of placements) {
    m.set(p.a, p.d);
    m.set(p.b, p.d);
  }
  return m;
}

/** Can domino `d` lie on cells a,b (ignoring its own current spot)? */
export function fits(board: Board, placements: Placement[], d: number, a: number, b: number): boolean {
  const cells = onBoard(board);
  if (!cells.has(a) || !cells.has(b) || a === b) return false;
  if (!neighbours(board.w, board.h, a).includes(b)) return false;
  const occ = occupancy(placements);
  const ta = occ.get(a);
  const tb = occ.get(b);
  return (ta === undefined || ta === d) && (tb === undefined || tb === d);
}

const without = (placements: Placement[], d: number) => placements.filter((p) => p.d !== d);

/** Put domino d with its first value on a and second on b. Moves it if already placed. */
export function place(board: Board, placements: Placement[], d: number, a: number, b: number): Placement[] | null {
  if (!fits(board, placements, d, a, b)) return null;
  return [...without(placements, d), { d, a, b }];
}

export function remove(placements: Placement[], d: number): Placement[] {
  return without(placements, d);
}

/**
 * Place an unplaced (or moving) domino by tapping a single cell. Tries the
 * player's chosen way round first, with either half on the tapped cell, then
 * the other three turns. `first` is which domino value goes first along `dir`.
 */
export function placeAt(board: Board, placements: Placement[], d: number, cell: number, dir: Dir, flipped: boolean): Placement[] | null {
  const order: Dir[] = [dir, ((dir + 1) % 4) as Dir, ((dir + 2) % 4) as Dir, ((dir + 3) % 4) as Dir];
  for (const k of order) {
    // The tapped cell takes the leading half; else the trailing half.
    const ahead = step(board, cell, k);
    const behind = step(board, cell, ((k + 2) % 4) as Dir);
    const tries: [number, number][] = [];
    if (ahead >= 0) tries.push(flipped ? [ahead, cell] : [cell, ahead]);
    if (behind >= 0) tries.push(flipped ? [cell, behind] : [behind, cell]);
    for (const [a, b] of tries) {
      const next = place(board, placements, d, a, b);
      if (next) return next;
    }
  }
  return null;
}

/**
 * Turn a placed domino a quarter clockwise around the half that was tapped,
 * skipping spots that are blocked. If it can't turn at all, flip it end for
 * end so the numbers swap.
 */
export function rotate(board: Board, placements: Placement[], d: number, pivot: number): Placement[] | null {
  const p = placements.find((x) => x.d === d);
  if (!p) return null;
  const pivotIsA = pivot === p.a;
  const other = pivotIsA ? p.b : p.a;
  const dir = dirBetween(board, pivot, other);
  for (let k = 1; k <= 3; k++) {
    const nd = ((dir + k) % 4) as Dir;
    const to = step(board, pivot, nd);
    if (to < 0) continue;
    const next = pivotIsA ? place(board, placements, d, pivot, to) : place(board, placements, d, to, pivot);
    if (next) return next;
  }
  return [...without(placements, d), { d, a: p.b, b: p.a }];
}

export interface BoardView {
  values: number[];
  statuses: ReturnType<typeof regionStatuses>;
  full: boolean;
  solved: boolean;
}

export function view(board: Board, placements: Placement[]): BoardView {
  const occ = occupancy(placements);
  return {
    values: cellValues(board, placements),
    statuses: regionStatuses(board, placements),
    full: board.cells.every((c) => occ.has(c)),
    solved: isSolved(board, placements),
  };
}

/**
 * Hint: put one domino where the solution has it, clearing anything in the
 * way. Picks the solution domino in the smallest region first, so hints point
 * at the board's anchors before its open spaces.
 */
export function hint(board: Board, state: TierState): { placements: Placement[]; hinted: number[]; d: number } | null {
  const correct = (s: Placement) => state.placements.some((p) => p.d === s.d && ((p.a === s.a && p.b === s.b) || (board.dominoes[s.d][0] === board.dominoes[s.d][1] && p.a === s.b && p.b === s.a)));
  const regionSize = (c: number) => board.regions.find((r) => r.cells.includes(c))?.cells.length ?? 99;
  const candidates = board.solution.filter((s) => !state.hinted.includes(s.d) && !correct(s));
  if (!candidates.length) return null;
  candidates.sort((x, y) => Math.min(regionSize(x.a), regionSize(x.b)) - Math.min(regionSize(y.a), regionSize(y.b)) || x.a - y.a);
  const s = candidates[0];
  const occ = occupancy(state.placements);
  const blockers = new Set([occ.get(s.a), occ.get(s.b)].filter((x): x is number => x !== undefined && x !== s.d));
  const placements = state.placements.filter((p) => p.d !== s.d && !blockers.has(p.d)).concat({ ...s });
  return { placements, hinted: [...state.hinted, s.d], d: s.d };
}
