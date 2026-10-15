/** Connect Four rules. Pure functions, no React. */
import type { Rng } from '../../../lib/rng';

export type Player = 1 | 2;
export type Cell = 0 | Player;
/** board[row][col], row 0 is the TOP row. */
export type Board = Cell[][];

export const ROWS = 6;
export const COLS = 7;

export interface Outcome {
  winner: Player | null;
  /** Winning cells as [row, col] (at least four, in line order), or null. */
  cells: [number, number][] | null;
  draw: boolean;
}

export const emptyBoard = (): Board => Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(0));

export const other = (p: Player): Player => (p === 1 ? 2 : 1);

/** Row a disc would land in for `col`, or -1 if the column is full / invalid. */
export function landingRow(board: Board, col: number): number {
  if (!Number.isInteger(col) || col < 0 || col >= COLS) return -1;
  for (let r = ROWS - 1; r >= 0; r--) if (board[r][col] === 0) return r;
  return -1;
}

export const isColumnFull = (board: Board, col: number) => landingRow(board, col) === -1;

const DIRS: readonly [number, number][] = [
  [0, 1], // horizontal
  [1, 0], // vertical
  [1, 1], // diagonal ↘
  [1, -1], // diagonal ↙
];

const inside = (r: number, c: number) => r >= 0 && r < ROWS && c >= 0 && c < COLS;

/** Longest run through (r, c) in each direction; returns the first run of ≥4 found. */
function runThrough(board: Board, r: number, c: number): [number, number][] | null {
  const p = board[r][c];
  if (!p) return null;
  for (const [dr, dc] of DIRS) {
    let sr = r;
    let sc = c;
    while (inside(sr - dr, sc - dc) && board[sr - dr][sc - dc] === p) {
      sr -= dr;
      sc -= dc;
    }
    const run: [number, number][] = [];
    let rr = sr;
    let cc = sc;
    while (inside(rr, cc) && board[rr][cc] === p) {
      run.push([rr, cc]);
      rr += dr;
      cc += dc;
    }
    if (run.length >= 4) return run;
  }
  return null;
}

export function outcome(board: Board): Outcome {
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const run = runThrough(board, r, c);
      if (run) return { winner: board[r][c] as Player, cells: run, draw: false };
    }
  return { winner: null, cells: null, draw: board[0].every((x) => x !== 0) };
}

export const isOver = (board: Board) => {
  const o = outcome(board);
  return o.winner !== null || o.draw;
};

/** Game record: who started and the sequence of columns played. Board is derived. */
export interface Game {
  first: Player;
  moves: number[];
}

export const newGame = (first: Player = 1): Game => ({ first, moves: [] });

export const turnOf = (g: Game): Player => (g.moves.length % 2 === 0 ? g.first : other(g.first));

/** Replay the moves into a board (illegal moves in the record are skipped). */
export function boardOf(g: Game): Board {
  const b = emptyBoard();
  let p = g.first;
  for (const col of g.moves) {
    const r = landingRow(b, col);
    if (r < 0) continue;
    b[r][col] = p;
    p = other(p);
  }
  return b;
}

export function legalColumns(g: Game): number[] {
  const b = boardOf(g);
  if (isOver(b)) return [];
  return Array.from({ length: COLS }, (_, c) => c).filter((c) => landingRow(b, c) >= 0);
}

/** Drop a disc for the player to move. Returns the new game and landing row, or null if illegal. */
export function drop(g: Game, col: number): { game: Game; row: number } | null {
  const b = boardOf(g);
  if (isOver(b)) return null;
  const row = landingRow(b, col);
  if (row < 0) return null;
  return { game: { first: g.first, moves: [...g.moves, col] }, row };
}

/** Undo the last move (only while the game is still in progress). */
export function undo(g: Game): Game | null {
  if (g.moves.length === 0 || isOver(boardOf(g))) return null;
  return { first: g.first, moves: g.moves.slice(0, -1) };
}

/**
 * Vs the computer: undo the human's last move and, if the computer has
 * already replied, that reply too, so it's the human's turn again.
 * Returns null when there is no human move to take back.
 */
export function undoForHuman(g: Game, human: Player): Game | null {
  if (isOver(boardOf(g))) return null;
  const moves = g.moves.slice();
  while (moves.length) {
    moves.pop();
    if (turnOf({ first: g.first, moves }) === human) return { first: g.first, moves };
  }
  return null;
}

// ---- computer opponent ------------------------------------------------------
//
// Search runs on a flat board (index = row * COLS + col, row 0 at the top)
// with column heights, so a move is an O(1) write rather than a replay.

export type Level = 'easy' | 'hard';

/** Search depth (plies) for hard. Typical move < 50 ms on a phone. */
export const HARD_DEPTH = 7;
const ORDER = [3, 2, 4, 1, 5, 0, 6];
const WIN = 1_000_000;

/** Every line of four on the board, as flat indices. */
const WINDOWS: number[][] = [];
for (let r = 0; r < ROWS; r++)
  for (let c = 0; c < COLS; c++)
    for (const [dr, dc] of DIRS) {
      const er = r + dr * 3;
      const ec = c + dc * 3;
      if (inside(er, ec)) WINDOWS.push([0, 1, 2, 3].map((k) => (r + dr * k) * COLS + (c + dc * k)));
    }
/** Windows through each cell (as indices into WINDOWS). */
const CELL_WINDOWS: number[][] = Array.from({ length: ROWS * COLS }, (_, i) =>
  WINDOWS.flatMap((w, k) => (w.includes(i) ? [k] : [])),
);
const CENTRE_WEIGHT = 3;

interface Pos {
  cells: Int8Array;
  /** Next free row per column (-1 when full). */
  top: Int8Array;
  count: number;
  /** Discs per window for player 1 and player 2 (index 0 unused). */
  win: [Int8Array, Int8Array, Int8Array];
}

function play(pos: Pos, col: number, p: Player) {
  const i = pos.top[col] * COLS + col;
  pos.cells[i] = p;
  pos.top[col]--;
  pos.count++;
  const counts = pos.win[p];
  for (const k of CELL_WINDOWS[i]) counts[k]++;
}

function unplay(pos: Pos, col: number) {
  pos.top[col]++;
  const i = pos.top[col] * COLS + col;
  const counts = pos.win[pos.cells[i] as Player];
  for (const k of CELL_WINDOWS[i]) counts[k]--;
  pos.cells[i] = 0;
  pos.count--;
}

function toPos(board: Board): Pos {
  const pos: Pos = {
    cells: new Int8Array(ROWS * COLS),
    top: new Int8Array(COLS).fill(ROWS - 1),
    count: 0,
    win: [new Int8Array(0), new Int8Array(WINDOWS.length), new Int8Array(WINDOWS.length)],
  };
  // Fill bottom-up so heights and window counts stay consistent.
  for (let r = ROWS - 1; r >= 0; r--)
    for (let c = 0; c < COLS; c++) {
      const v = board[r][c];
      if (v) play(pos, c, v);
    }
  return pos;
}

/** Would `p` dropping into `col` win immediately? (Column must be open.) */
function winsAt(pos: Pos, col: number, p: Player): boolean {
  const counts = pos.win[p];
  for (const k of CELL_WINDOWS[pos.top[col] * COLS + col]) if (counts[k] === 3) return true;
  return false;
}

const WINDOW_SCORE = [0, 1, 4, 32];

/** Static evaluation from `p`'s point of view: open windows and the centre column. */
function evaluate(pos: Pos, p: Player): number {
  const mine = pos.win[p];
  const theirs = pos.win[other(p)];
  let score = 0;
  for (let k = 0; k < mine.length; k++) {
    if (theirs[k] === 0) score += WINDOW_SCORE[mine[k]];
    else if (mine[k] === 0) score -= WINDOW_SCORE[theirs[k]];
  }
  for (let r = 0; r < ROWS; r++) {
    const v = pos.cells[r * COLS + 3];
    if (v === p) score += CENTRE_WEIGHT;
    else if (v) score -= CENTRE_WEIGHT;
  }
  return score;
}

/** Negamax with alpha-beta. Scores are from `p`'s point of view; faster wins score higher. */
function negamax(pos: Pos, p: Player, depth: number, alpha: number, beta: number): number {
  const full = ROWS * COLS;
  if (pos.count === full) return 0;
  for (const c of ORDER) if (pos.top[c] >= 0 && winsAt(pos, c, p)) return WIN - pos.count;
  if (depth === 0) return evaluate(pos, p);
  const q = other(p);
  let best = -Infinity;
  for (const c of ORDER) {
    if (pos.top[c] < 0) continue;
    play(pos, c, p);
    const v = -negamax(pos, q, depth - 1, -beta, -alpha);
    unplay(pos, c);
    if (v > best) best = v;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

const openCols = (pos: Pos) => ORDER.filter((c) => pos.top[c] >= 0);

/** Columns where `p` wins immediately. */
export function winningColumns(g: Game, p: Player = turnOf(g)): number[] {
  if (legalColumns(g).length === 0) return [];
  const pos = toPos(boardOf(g));
  return openCols(pos).filter((c) => winsAt(pos, c, p)).sort((a, b) => a - b);
}

/** Moves for the side to play that don't hand the opponent an immediate win straight on top. */
function nonSuicidal(pos: Pos, p: Player): number[] {
  const q = other(p);
  return openCols(pos).filter((c) => {
    play(pos, c, p);
    const bad = pos.top[c] >= 0 && winsAt(pos, c, q);
    unplay(pos, c);
    return !bad;
  });
}

/**
 * The computer's column for whoever is to play, or null once the game is over.
 * Easy: wins if it can, blocks an immediate loss, otherwise a random column
 * that doesn't set up the opponent's win. Hard: negamax search to HARD_DEPTH.
 */
export function chooseMove(g: Game, level: Level, rng: Rng, depth = HARD_DEPTH): number | null {
  if (legalColumns(g).length === 0) return null;
  const pos = toPos(boardOf(g));
  const p = turnOf(g);
  const q = other(p);
  const cols = openCols(pos);
  const win = cols.filter((c) => winsAt(pos, c, p));
  if (win.length) return rng.pick(win);
  const threats = cols.filter((c) => winsAt(pos, c, q));
  if (threats.length) return rng.pick(threats);
  if (level === 'easy') {
    const safe = nonSuicidal(pos, p);
    return rng.pick(safe.length ? safe : cols);
  }
  let best = -Infinity;
  let picks: number[] = [];
  for (const c of cols) {
    play(pos, c, p);
    // Narrow window: anything below the best so far can't be picked, so it only needs a bound.
    const v = -negamax(pos, q, depth - 1, -Infinity, -(best - 1));
    unplay(pos, c);
    if (v > best) {
      best = v;
      picks = [c];
    } else if (v === best) picks.push(c);
  }
  return rng.pick(picks);
}
