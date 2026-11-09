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
const CORNERS = [0, 7, 56, 63];
/** Square → the corner it sits beside (X- or C-square), or -1. */
const CORNER_OF: number[] = Array(CELLS).fill(-1);
for (const [corner, near] of CORNER_NEIGHBOURS) for (const n of near) CORNER_OF[n] = corner;
const NEIGHBOURS: number[][] = RAYS.map(() => []);
for (let i = 0; i < CELLS; i++) {
  const r = Math.floor(i / SIZE), c = i % SIZE;
  for (const [dr, dc] of DIRS) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE) NEIGHBOURS[i].push(idx(rr, cc));
  }
}

/**
 * The four lines through each square (row, column, two diagonals), as
 * [neighbour one way, neighbour the other way (-1 = edge), line id].
 */
const AXES: [number, number, number][][] = [];
const LINES: number[][] = [];
{
  const lineIds = new Map<string, number>();
  const lineOf = (key: string, cells: () => number[]) => {
    let id = lineIds.get(key);
    if (id === undefined) {
      id = LINES.length;
      lineIds.set(key, id);
      LINES.push(cells());
    }
    return id;
  };
  const inside = (r: number, c: number) => r >= 0 && r < SIZE && c >= 0 && c < SIZE;
  const walk = (r: number, c: number, dr: number, dc: number) => {
    while (inside(r - dr, c - dc)) { r -= dr; c -= dc; }
    const out: number[] = [];
    for (; inside(r, c); r += dr, c += dc) out.push(idx(r, c));
    return out;
  };
  for (let i = 0; i < CELLS; i++) {
    const r = Math.floor(i / SIZE), c = i % SIZE;
    const axes: [number, number, number][] = [];
    for (const [dr, dc, key] of [[0, 1, `r${r}`], [1, 0, `c${c}`], [1, 1, `d${r - c}`], [1, -1, `a${r + c}`]] as const) {
      const a = inside(r - dr, c - dc) ? idx(r - dr, c - dc) : -1;
      const b = inside(r + dr, c + dc) ? idx(r + dr, c + dc) : -1;
      axes.push([a, b, lineOf(key, () => walk(r, c, dr, dc))]);
    }
    AXES.push(axes);
  }
}

const WIN = 1_000_000;

/**
 * Discs that can never be flipped (a safe under-estimate): along each of its
 * four lines a stable disc has the edge or a stable disc of its own colour
 * beside it, or the whole line is full. Grown outward from the corners.
 */
export function stableDiscs(board: readonly Cell[]): Uint8Array {
  const stable = new Uint8Array(CELLS);
  if (!board[0] && !board[7] && !board[56] && !board[63]) return stable;
  const full = LINES.map((line) => line.every((i) => board[i] !== 0));
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < CELLS; i++) {
      const c = board[i];
      if (c === 0 || stable[i]) continue;
      let ok = true;
      for (const [a, b, line] of AXES[i]) {
        if (full[line]) continue;
        if (a === -1 || b === -1) continue;
        if ((stable[a] && board[a] === c) || (stable[b] && board[b] === c)) continue;
        ok = false;
        break;
      }
      if (ok) {
        stable[i] = 1;
        changed = true;
      }
    }
  }
  return stable;
}

/**
 * Static judgement of a position for `me` (the side to move): corners and
 * stable discs, mobility, frontier, square weights and, late on, parity.
 */
export function evaluate(board: readonly Cell[], me: Player, myMoves = mobility(board, me)): number {
  const opp = other(me);
  let pos = 0, discs = 0, empties = 0, myFront = 0, oppFront = 0;
  for (let i = 0; i < CELLS; i++) {
    const c = board[i];
    if (c === 0) {
      empties++;
      continue;
    }
    let w = WEIGHTS[i];
    // Once a corner is owned, the squares beside it are no longer a liability.
    const corner = CORNER_OF[i];
    if (corner >= 0 && board[corner] !== 0) w = 0;
    let front = false;
    for (const n of NEIGHBOURS[i]) if (board[n] === 0) { front = true; break; }
    if (c === me) {
      pos += w;
      discs++;
      if (front) myFront++;
    } else {
      pos -= w;
      discs--;
      if (front) oppFront++;
    }
  }
  let corners = 0;
  for (const k of CORNERS) corners += board[k] === me ? 1 : board[k] === opp ? -1 : 0;
  let stable = 0;
  const st = stableDiscs(board);
  for (let i = 0; i < CELLS; i++) if (st[i]) stable += board[i] === me ? 1 : -1;
  const oppMob = mobility(board, opp);
  const mob = (100 * (myMoves - oppMob)) / (myMoves + oppMob + 2);
  const frontier = (100 * (oppFront - myFront)) / (myFront + oppFront + 2);
  const late = empties < 20;
  // With an odd number of squares left, the side to move expects the last move.
  const parity = late ? (empties % 2 === 1 ? 30 : -30) : 0;
  return 3 * pos + 250 * corners + 40 * stable + (late ? 3 : 5) * mob + 4 * frontier + parity + (late ? 8 * discs : 0);
}

function finalScore(board: readonly Cell[], me: Player): number {
  const n = counts(board);
  const diff = n[me] - n[other(me)];
  return diff > 0 ? WIN + diff : diff < 0 ? -WIN + diff : 0;
}

/** Thrown out of a search when its time is up. */
const TIMEOUT = Symbol('timeout');

interface Searcher {
  deadline: number;
  now: () => number;
  nodes: number;
  /** Cut-off history per player and square, for move ordering. */
  history: Int32Array;
}

/** Rough "how good does this move look" for ordering: corners first, X/C squares beside an empty corner last. */
function movePriority(board: readonly Cell[], m: number): number {
  const corner = CORNER_OF[m];
  if (corner >= 0 && board[corner] === 0) return WEIGHTS[m] * 4;
  return WEIGHTS[m] === -20 || WEIGHTS[m] === -50 ? 8 : WEIGHTS[m];
}

function orderMoves(board: readonly Cell[], moves: number[], me: Player, s: Searcher): number[] {
  const h = s.history;
  const base = me === 1 ? 0 : CELLS;
  const keyed = moves.map((m) => ({ m, k: movePriority(board, m) * 1000 + Math.min(h[base + m], 999) }));
  keyed.sort((a, b) => b.k - a.k);
  return keyed.map((x) => x.m);
}

/** Negamax with alpha-beta; plays and unplays in place for speed. */
function search(board: Cell[], me: Player, depth: number, alpha: number, beta: number, passedLast: boolean, s: Searcher): number {
  if ((++s.nodes & 1023) === 0 && s.now() > s.deadline) throw TIMEOUT;
  const opp = other(me);
  const moves = legalMoves(board, me);
  if (moves.length === 0) {
    if (passedLast) return finalScore(board, me);
    return -search(board, opp, depth, -beta, -alpha, true, s);
  }
  if (depth <= 0) return evaluate(board, me, moves.length);
  const ordered = moves.length > 1 ? orderMoves(board, moves, me, s) : moves;
  let best = -Infinity;
  for (const m of ordered) {
    const flips = flipsFor(board, m, me);
    board[m] = me;
    for (const f of flips) board[f] = me;
    let v: number;
    try {
      v = -search(board, opp, depth - 1, -beta, -alpha, false, s);
    } finally {
      board[m] = 0;
      for (const f of flips) board[f] = opp;
    }
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) {
      s.history[(me === 1 ? 0 : CELLS) + m] += depth * depth;
      break;
    }
  }
  return best;
}

/** Exact endgame search: final disc difference, fastest-first ordering. */
function solve(board: Cell[], me: Player, empties: number, alpha: number, beta: number, passedLast: boolean, s: Searcher): number {
  if ((++s.nodes & 1023) === 0 && s.now() > s.deadline) throw TIMEOUT;
  const opp = other(me);
  const moves = legalMoves(board, me);
  if (moves.length === 0) {
    if (passedLast) return finalScore(board, me);
    return -solve(board, opp, empties, -beta, -alpha, true, s);
  }
  let ordered = moves;
  if (empties > 5 && moves.length > 1) {
    // Fastest first: replies that leave the opponent the fewest options.
    const keyed = moves.map((m) => {
      const flips = flipsFor(board, m, me);
      board[m] = me;
      for (const f of flips) board[f] = me;
      const k = mobility(board, opp) * 16 - (CORNER_OF[m] === -1 && WEIGHTS[m] === 100 ? 8 : 0);
      board[m] = 0;
      for (const f of flips) board[f] = opp;
      return { m, k };
    });
    keyed.sort((a, b) => a.k - b.k);
    ordered = keyed.map((x) => x.m);
  }
  let best = -Infinity;
  for (const m of ordered) {
    const flips = flipsFor(board, m, me);
    board[m] = me;
    for (const f of flips) board[f] = me;
    let v: number;
    try {
      v = -solve(board, opp, empties - 1, -beta, -alpha, false, s);
    } finally {
      board[m] = 0;
      for (const f of flips) board[f] = opp;
    }
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

/** Fixed search depth used when no time budget is given (tests, replays). */
export const HARD_DEPTH = 6;
/** Time the hard opponent may think in the app (ms; aimed at a phone). */
export const HARD_BUDGET_MS = 150;
/** Deepest iterative-deepening pass with a time budget. */
const MAX_DEPTH = 24;
/** With this few empty squares left, hard always searches to the very end. */
export const SOLVE_EMPTIES = 10;
/** With a time budget, hard also tries an exact solve from this many empties. */
const TRY_SOLVE_EMPTIES = 14;

export interface SearchOptions {
  /** Fixed midgame depth (deterministic). Used when no budget is given. */
  depth?: number;
  /** Think by iterative deepening for about this long (ms) instead. */
  budgetMs?: number;
  /** Clock, injectable for tests. */
  now?: () => number;
}

const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** One full-width pass over the root moves; returns them best first. */
function rootPass(work: Cell[], player: Player, moves: number[], score: (m: number, alpha: number) => number): { best: number; value: number; order: number[] } {
  const opp = other(player);
  let alpha = -Infinity;
  let best = moves[0];
  const values: number[] = [];
  for (const m of moves) {
    const flips = flipsFor(work, m, player);
    work[m] = player;
    for (const f of flips) work[f] = player;
    let v: number;
    try {
      v = score(m, alpha);
    } finally {
      work[m] = 0;
      for (const f of flips) work[f] = opp;
    }
    values.push(v);
    if (v > alpha) {
      alpha = v;
      best = m;
    }
  }
  // Next pass looks at the best move first, then in the order found (stable).
  const order = moves.map((m, k) => ({ m, v: values[k] })).sort((a, b) => b.v - a.v).map((x) => x.m);
  return { best, value: alpha, order };
}

function hardMove(board: readonly Cell[], player: Player, moves: number[], rng: Rng, opts: SearchOptions): number {
  const work = board.slice() as Cell[];
  const empties = counts(work).empty;
  const opp = other(player);
  const now = opts.now ?? clock;
  const budget = opts.budgetMs;
  const start = now();
  const s: Searcher = { deadline: Infinity, now, nodes: 0, history: new Int32Array(CELLS * 2) };
  // Shuffle first so equal moves are broken by the rng, then order by square.
  let order = rng.shuffle(moves).sort((a, b) => movePriority(work, b) - movePriority(work, a));
  if (moves.length === 1) return moves[0];

  const exact = () => rootPass(work, player, order, (_m, alpha) => -solve(work, opp, empties - 1, -Infinity, -alpha, false, s));

  if (empties <= SOLVE_EMPTIES) return exact().best;

  if (budget === undefined) {
    // Deterministic: iterative deepening to a fixed depth (for ordering).
    const depth = Math.max(1, opts.depth ?? HARD_DEPTH);
    let best = order[0];
    for (let d = 1; d <= depth; d++) {
      const r = rootPass(work, player, order, (_m, alpha) => -search(work, opp, d - 1, -Infinity, -alpha, false, s));
      best = r.best;
      order = r.order;
    }
    return best;
  }

  let best = order[0];
  // Near the end, a quick shallow answer first, then the rest of the time on an exact solve.
  const endgame = empties <= TRY_SOLVE_EMPTIES;
  for (let d = 1; d <= Math.min(endgame ? 4 : MAX_DEPTH, empties); d++) {
    // Depth 1 and 2 always finish so there is always a considered answer.
    s.deadline = d <= 2 ? Infinity : start + budget;
    try {
      const r = rootPass(work, player, order, (_m, alpha) => -search(work, opp, d - 1, -Infinity, -alpha, false, s));
      best = r.best;
      order = r.order;
    } catch (e) {
      if (e !== TIMEOUT) throw e;
      return best;
    }
    if (now() - start > budget / 2) break; // the next pass would not finish
  }
  // Try to see all the way to the last disc; keep the shallow answer if time runs out.
  if (endgame) {
    s.deadline = start + budget;
    try {
      return exact().best;
    } catch (e) {
      if (e !== TIMEOUT) throw e;
    }
  }
  return best;
}

/**
 * Pick a move for `player`, or null if they have none (or the game is over).
 * Easy: mostly random, nudged toward bigger flips. Hard: alpha-beta search with
 * iterative deepening (to `opts.depth`, or for `opts.budgetMs` of thinking),
 * and an exact solve once few squares are left. Deterministic for a given
 * rng state when no time budget is given.
 */
export function chooseMove(board: readonly Cell[], player: Player, level: Level, rng: Rng, opts: SearchOptions = {}): number | null {
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
  return hardMove(board, player, moves, rng, opts);
}

/** Square name like "d3" for screen readers. */
export const squareName = (i: number) => `${'abcdefgh'[i % SIZE]}${Math.floor(i / SIZE) + 1}`;
