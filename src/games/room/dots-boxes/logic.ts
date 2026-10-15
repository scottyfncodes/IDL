/** Dots & Boxes rules. Pure functions, no React. */
import type { Rng } from '../../../lib/rng';

export type Player = 1 | 2;
export type Size = 3 | 4 | 5;
export const SIZES: readonly Size[] = [3, 4, 5];

/** An edge between two adjacent dots.
 *  'h' edges: row r in 0..n, col c in 0..n-1 (dot (r,c) to dot (r,c+1)).
 *  'v' edges: row r in 0..n-1, col c in 0..n (dot (r,c) to dot (r+1,c)). */
export interface Edge {
  kind: 'h' | 'v';
  r: number;
  c: number;
}

export interface State {
  /** Boxes per side. */
  size: Size;
  /** h[r][c]: who drew it, or 0 if empty. (n+1) rows × n cols. */
  h: (0 | Player)[][];
  /** v[r][c]: who drew it, or 0 if empty. n rows × (n+1) cols. */
  v: (0 | Player)[][];
  /** boxes[r][c]: owner, or 0 if open. n × n. */
  boxes: (0 | Player)[][];
  turn: Player;
  last: Edge | null;
}

export interface MoveResult {
  state: State;
  /** Boxes this move completed, as [row, col]. */
  completed: [number, number][];
  /** True if the mover goes again (closed at least one box and the game isn't over). */
  extraTurn: boolean;
}

const grid = <T,>(rows: number, cols: number, v: T): T[][] => Array.from({ length: rows }, () => Array<T>(cols).fill(v));

export function newGame(size: Size, first: Player = 1): State {
  return {
    size,
    h: grid(size + 1, size, 0 as 0 | Player),
    v: grid(size, size + 1, 0 as 0 | Player),
    boxes: grid(size, size, 0 as 0 | Player),
    turn: first,
    last: null,
  };
}

export const totalEdges = (size: number) => 2 * size * (size + 1);
export const edgeKey = (e: Edge) => `${e.kind}${e.r}-${e.c}`;
export const sameEdge = (a: Edge | null, b: Edge | null) => !!a && !!b && a.kind === b.kind && a.r === b.r && a.c === b.c;

export function inBounds(size: number, e: Edge): boolean {
  if (!Number.isInteger(e.r) || !Number.isInteger(e.c) || e.r < 0 || e.c < 0) return false;
  return e.kind === 'h' ? e.r <= size && e.c < size : e.kind === 'v' ? e.r < size && e.c <= size : false;
}

export function edgeOwner(s: State, e: Edge): 0 | Player {
  return e.kind === 'h' ? s.h[e.r][e.c] : s.v[e.r][e.c];
}

export function isLegal(s: State, e: Edge): boolean {
  return !isOver(s) && inBounds(s.size, e) && edgeOwner(s, e) === 0;
}

export function legalMoves(s: State): Edge[] {
  if (isOver(s)) return [];
  const out: Edge[] = [];
  for (let r = 0; r <= s.size; r++) for (let c = 0; c < s.size; c++) if (!s.h[r][c]) out.push({ kind: 'h', r, c });
  for (let r = 0; r < s.size; r++) for (let c = 0; c <= s.size; c++) if (!s.v[r][c]) out.push({ kind: 'v', r, c });
  return out;
}

/** Number of drawn sides of box (r, c). */
export function sidesDrawn(s: Pick<State, 'h' | 'v'>, r: number, c: number): number {
  return (s.h[r][c] ? 1 : 0) + (s.h[r + 1][c] ? 1 : 0) + (s.v[r][c] ? 1 : 0) + (s.v[r][c + 1] ? 1 : 0);
}

/** Boxes adjacent to an edge (one or two). */
export function boxesTouching(size: number, e: Edge): [number, number][] {
  const out: [number, number][] = [];
  if (e.kind === 'h') {
    if (e.r > 0) out.push([e.r - 1, e.c]);
    if (e.r < size) out.push([e.r, e.c]);
  } else {
    if (e.c > 0) out.push([e.r, e.c - 1]);
    if (e.c < size) out.push([e.r, e.c]);
  }
  return out;
}

/** Applies a move. Returns null if the move is illegal (taken edge, out of bounds, game over). */
export function applyMove(s: State, e: Edge): MoveResult | null {
  if (!isLegal(s, e)) return null;
  const mover = s.turn;
  const h = s.h.map((row) => row.slice());
  const v = s.v.map((row) => row.slice());
  if (e.kind === 'h') h[e.r][e.c] = mover;
  else v[e.r][e.c] = mover;
  const boxes = s.boxes.map((row) => row.slice());
  const completed: [number, number][] = [];
  for (const [r, c] of boxesTouching(s.size, e)) {
    if (!boxes[r][c] && sidesDrawn({ h, v }, r, c) === 4) {
      boxes[r][c] = mover;
      completed.push([r, c]);
    }
  }
  const scored = completed.length > 0;
  const next: State = { size: s.size, h, v, boxes, turn: scored ? mover : other(mover), last: { ...e } };
  return { state: next, completed, extraTurn: scored && !isOver(next) };
}

export const other = (p: Player): Player => (p === 1 ? 2 : 1);

export function score(s: State): { 1: number; 2: number } {
  let a = 0;
  let b = 0;
  for (const row of s.boxes) for (const o of row) {
    if (o === 1) a++;
    else if (o === 2) b++;
  }
  return { 1: a, 2: b };
}

export function drawnCount(s: State): number {
  let n = 0;
  for (const row of s.h) for (const x of row) if (x) n++;
  for (const row of s.v) for (const x of row) if (x) n++;
  return n;
}

export const isOver = (s: State) => drawnCount(s) === totalEdges(s.size);

/** Winner once the game is over: 1, 2, 'tie', or null while still playing. */
export function winner(s: State): Player | 'tie' | null {
  if (!isOver(s)) return null;
  const sc = score(s);
  return sc[1] > sc[2] ? 1 : sc[2] > sc[1] ? 2 : 'tie';
}

// ---- computer opponent ------------------------------------------------------

export type Level = 'easy' | 'hard';

/** Open edges that complete at least one box right now. */
export function capturingEdges(s: State): Edge[] {
  return legalMoves(s).filter((e) => boxesTouching(s.size, e).some(([r, c]) => !s.boxes[r][c] && sidesDrawn(s, r, c) === 3));
}

/** Does drawing `e` leave a box with exactly three sides (a box handed to the opponent)? */
export function givesThirdSide(s: State, e: Edge): boolean {
  return boxesTouching(s.size, e).some(([r, c]) => sidesDrawn(s, r, c) === 2);
}

/** Open edges that neither complete a box nor give away a third side. */
export function safeEdges(s: State): Edge[] {
  const capture = capturingEdges(s);
  return legalMoves(s).filter((e) => !givesThirdSide(s, e) && !capture.some((x) => sameEdge(x, e)));
}

/**
 * Boxes the opponent can take, one after another, after we draw `e`
 * (used when nothing can be captured, so `e` itself completes no box). This is the length of the chain or loop the move
 * opens up — the opponent is assumed to take everything on offer.
 */
export function boxesGivenAway(s: State, e: Edge): number {
  const res = applyMove(s, e);
  if (!res) return 0;
  let t = res.state;
  let taken = 0;
  for (;;) {
    const cap = capturingEdges(t);
    if (!cap.length) return taken;
    const r = applyMove(t, cap[0])!;
    taken += r.completed.length;
    t = r.state;
  }
}

/**
 * The computer's line for whoever is to play, or null once the game is over.
 * Hard: take any box on offer; otherwise draw a line that gives nothing away;
 * when every line gives something away, open the shortest chain.
 * Easy: takes a box about 70% of the time it can; otherwise any line.
 */
export function chooseEdge(s: State, level: Level, rng: Rng): Edge | null {
  const legal = legalMoves(s);
  if (!legal.length) return null;
  const capture = capturingEdges(s);
  if (level === 'easy') return capture.length && rng.chance(0.7) ? rng.pick(capture) : rng.pick(legal);
  if (capture.length) return rng.pick(capture);
  const safe = legal.filter((e) => !givesThirdSide(s, e));
  if (safe.length) return rng.pick(safe);
  let best = Infinity;
  let picks: Edge[] = [];
  for (const e of legal) {
    const n = boxesGivenAway(s, e);
    if (n < best) {
      best = n;
      picks = [e];
    } else if (n === best) picks.push(e);
  }
  return rng.pick(picks);
}
