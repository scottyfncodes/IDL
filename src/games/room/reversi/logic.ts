/**
 * Reversi rules and the on-device opponent. Pure functions, no React.
 *
 * Board: 64 cells, row-major (index = row * 8 + col). 0 empty, 1 player one
 * (solid discs, moves first), 2 player two (pale discs).
 */
import type { Rng } from '../../../lib/rng';

export type Player = 1 | 2;
export type Cell = 0 | Player;
export type Board = Cell[];
export type Level = 'easy' | 'hard';

export const SIZE = 8;
export const CELLS = SIZE * SIZE;

export const other = (p: Player): Player => (p === 1 ? 2 : 1);
export const idx = (row: number, col: number) => row * SIZE + col;

const DIRS: readonly [number, number][] = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

/** For every square, the eight rays of squares walking outward, nearest first. */
const RAYS: number[][][] = Array.from({ length: CELLS }, (_, i) => {
  const r0 = Math.floor(i / SIZE);
  const c0 = i % SIZE;
  const rays: number[][] = [];
  for (const [dr, dc] of DIRS) {
    const ray: number[] = [];
    let r = r0 + dr;
    let c = c0 + dc;
    while (r >= 0 && r < SIZE && c >= 0 && c < SIZE) {
      ray.push(idx(r, c));
      r += dr;
      c += dc;
    }
    if (ray.length >= 2) rays.push(ray);
  }
  return rays;
});

/** Standard start: the four centre squares, crossed. Player one moves first. */
export function initialBoard(): Board {
  const b: Board = Array(CELLS).fill(0);
  b[idx(3, 3)] = 2;
  b[idx(3, 4)] = 1;
  b[idx(4, 3)] = 1;
  b[idx(4, 4)] = 2;
  return b;
}

/** Discs that would flip if `player` placed at `i` (empty list = illegal). */
export function flipsFor(board: readonly Cell[], i: number, player: Player): number[] {
  if (i < 0 || i >= CELLS || board[i] !== 0) return [];
  const opp = other(player);
  const out: number[] = [];
  for (const ray of RAYS[i]) {
    let k = 0;
    while (k < ray.length && board[ray[k]] === opp) k++;
    if (k > 0 && k < ray.length && board[ray[k]] === player) for (let j = 0; j < k; j++) out.push(ray[j]);
  }
  return out;
}

function hasFlip(board: readonly Cell[], i: number, player: Player, opp: Player): boolean {
  if (board[i] !== 0) return false;
  for (const ray of RAYS[i]) {
    if (board[ray[0]] !== opp) continue;
    let k = 1;
    while (k < ray.length && board[ray[k]] === opp) k++;
    if (k < ray.length && board[ray[k]] === player) return true;
  }
  return false;
}

export function legalMoves(board: readonly Cell[], player: Player): number[] {
  const opp = other(player);
  const out: number[] = [];
  for (let i = 0; i < CELLS; i++) if (hasFlip(board, i, player, opp)) out.push(i);
  return out;
}

function mobility(board: readonly Cell[], player: Player): number {
  const opp = other(player);
  let n = 0;
  for (let i = 0; i < CELLS; i++) if (hasFlip(board, i, player, opp)) n++;
  return n;
}

export const canMove = (board: readonly Cell[], player: Player) => mobility(board, player) > 0;

/** New board after a legal move, or null if illegal. */
export function applyMove(board: readonly Cell[], i: number, player: Player): Board | null {
  const flips = flipsFor(board, i, player);
  if (flips.length === 0) return null;
  const next = board.slice() as Board;
  next[i] = player;
  for (const f of flips) next[f] = player;
  return next;
}

export function counts(board: readonly Cell[]): { 1: number; 2: number; empty: number } {
  let a = 0;
  let b = 0;
  for (const c of board) {
    if (c === 1) a++;
    else if (c === 2) b++;
  }
  return { 1: a, 2: b, empty: CELLS - a - b };
}

/** Neither player can move (board full, or both stuck). */
export const boardOver = (board: readonly Cell[]) => !canMove(board, 1) && !canMove(board, 2);

/** Winner by disc count once the game is over: 1, 2, or 0 for a draw. */
export function winnerOf(board: readonly Cell[]): Player | 0 {
  const n = counts(board);
  return n[1] > n[2] ? 1 : n[2] > n[1] ? 2 : 0;
}

// ---- game with history ------------------------------------------------------

export interface Snapshot {
  board: Board;
  /** Who moves next (meaningless once the game is over). */
  turn: Player;
  /** Square of the most recent move. */
  last: number | null;
  /** Set when the player who should have moved next had no move and passed. */
  passed: Player | null;
}

export interface Game extends Snapshot {
  /** Earlier positions, oldest first, each with the player who then moved. */
  history: (Snapshot & { mover: Player })[];
}

export function newGame(): Game {
  return { board: initialBoard(), turn: 1, last: null, passed: null, history: [] };
}

export const isOver = (g: Game) => boardOver(g.board);

/**
 * Play at square `i` for the player to move. Returns the next game, or null
 * for an illegal move or a finished game. If the opponent then has no move
 * they pass automatically and `passed` records it.
 */
export function play(g: Game, i: number): Game | null {
  if (isOver(g)) return null;
  const board = applyMove(g.board, i, g.turn);
  if (!board) return null;
  const opp = other(g.turn);
  let turn: Player = opp;
  let passed: Player | null = null;
  if (!canMove(board, opp) && canMove(board, g.turn)) {
    turn = g.turn;
    passed = opp;
  }
  const { history, ...snap } = g;
  return { board, turn, last: i, passed, history: [...history, { ...snap, mover: g.turn }] };
}

/**
 * Step back. With `until` set, keeps stepping back until a move by that
 * player has been undone (so against the computer you take back your own
 * move plus its replies). Returns null if there is nothing to undo.
 */
export function undo(g: Game, until?: Player): Game | null {
  if (g.history.length === 0) return null;
  const history = g.history.slice();
  let snap = history.pop()!;
  if (until !== undefined) {
    while (snap.mover !== until && history.length > 0) snap = history.pop()!;
    if (snap.mover !== until) return null;
  }
  const { mover: _mover, ...rest } = snap;
  return { ...rest, history };
}

// ---- computer opponent --------------------------------------------------------

/** Classic positional weights: corners gold, X-squares and C-squares risky. */
const WEIGHTS = [
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -50, -2, -2, -2, -2, -50, -20,
  10, -2, 1, 1, 1, 1, -2, 10,
  5, -2, 1, 0, 0, 1, -2, 5,
  5, -2, 1, 0, 0, 1, -2, 5,
  10, -2, 1, 1, 1, 1, -2, 10,
  -20, -50, -2, -2, -2, -2, -50, -20,
  100, -20, 10, 5, 5, 10, -20, 100,
];
/** Corner → its X-square and C-squares, whose risk vanishes once the corner is taken. */
const CORNER_NEIGHBOURS: [number, number[]][] = [
  [0, [1, 8, 9]],
  [7, [6, 15, 14]],
  [56, [57, 48, 49]],
  [63, [62, 55, 54]],
];
const WIN = 100000;

function evaluate(board: Cell[], me: Player): number {
  const opp = other(me);
  let pos = 0;
  for (let i = 0; i < CELLS; i++) {
    const c = board[i];
    if (c === me) pos += WEIGHTS[i];
    else if (c === opp) pos -= WEIGHTS[i];
  }
  // Once a corner is owned, the squares beside it are no longer a liability.
  for (const [corner, near] of CORNER_NEIGHBOURS) {
    if (board[corner] === 0) continue;
    for (const n of near) {
      if (board[n] === me) pos -= WEIGHTS[n];
      else if (board[n] === opp) pos += WEIGHTS[n];
    }
  }
  const myMob = mobility(board, me);
  const oppMob = mobility(board, opp);
  const mob = myMob + oppMob === 0 ? 0 : (100 * (myMob - oppMob)) / (myMob + oppMob + 2);
  return pos + mob;
}

function finalScore(board: Cell[], me: Player): number {
  const n = counts(board);
  const diff = n[me] - n[other(me)];
  return diff > 0 ? WIN + diff : diff < 0 ? -WIN + diff : 0;
}

/** Negamax with alpha-beta; plays and unplays in place for speed. */
function search(board: Cell[], me: Player, depth: number, alpha: number, beta: number, passedLast: boolean): number {
  const opp = other(me);
  const moves = legalMoves(board, me);
  if (moves.length === 0) {
    if (passedLast) return finalScore(board, me);
    return -search(board, opp, depth, -beta, -alpha, true);
  }
  if (depth <= 0) return evaluate(board, me);
  moves.sort((a, b) => WEIGHTS[b] - WEIGHTS[a]);
  let best = -Infinity;
  for (const m of moves) {
    const flips = flipsFor(board, m, me);
    board[m] = me;
    for (const f of flips) board[f] = me;
    const v = -search(board, opp, depth - 1, -beta, -alpha, false);
    board[m] = 0;
    for (const f of flips) board[f] = opp;
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

export const HARD_DEPTH = 4;
/** With this few empty squares left, hard searches to the very end. */
export const SOLVE_EMPTIES = 10;

/**
 * Pick a move for `player`, or null if they have none (or the game is over).
 * Deterministic for a given rng state.
 */
export function chooseMove(board: readonly Cell[], player: Player, level: Level, rng: Rng): number | null {
  const moves = legalMoves(board, player);
  if (moves.length === 0) return null;
  if (level === 'easy') {
    // Mostly random, nudged toward moves that flip more discs.
    const weights = moves.map((m) => 1 + 0.3 * flipsFor(board, m, player).length);
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng.next() * total;
    for (let k = 0; k < moves.length; k++) {
      r -= weights[k];
      if (r < 0) return moves[k];
    }
    return moves[moves.length - 1];
  }
  const work = board.slice() as Cell[];
  const empties = counts(work).empty;
  const depth = empties <= SOLVE_EMPTIES ? empties : HARD_DEPTH;
  const opp = other(player);
  // Shuffle first so equal moves are broken by the rng, then order by weight.
  const ordered = rng.shuffle(moves).sort((a, b) => WEIGHTS[b] - WEIGHTS[a]);
  let best = ordered[0];
  let alpha = -Infinity;
  for (const m of ordered) {
    const flips = flipsFor(work, m, player);
    work[m] = player;
    for (const f of flips) work[f] = player;
    const v = -search(work, opp, depth - 1, -Infinity, -alpha, false);
    work[m] = 0;
    for (const f of flips) work[f] = opp;
    if (v > alpha) {
      alpha = v;
      best = m;
    }
  }
  return best;
}

/** Square name like "d3" for screen readers. */
export const squareName = (i: number) => `${'abcdefgh'[i % SIZE]}${Math.floor(i / SIZE) + 1}`;
