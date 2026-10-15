/** Tic-Tac-Toe rules. Pure functions, no React. */
import type { Rng } from '../../../lib/rng';
export type Mark = 'X' | 'O';
export type Cell = Mark | null;
export type Board = Cell[]; // 9 cells, row-major

export const LINES: readonly [number, number, number][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export interface Outcome {
  winner: Mark | null;
  line: [number, number, number] | null;
  draw: boolean;
}

export const emptyBoard = (): Board => Array(9).fill(null);

export function outcome(board: Board): Outcome {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return { winner: board[a], line, draw: false };
  }
  return { winner: null, line: null, draw: board.every(Boolean) };
}

export const isOver = (board: Board) => {
  const o = outcome(board);
  return o.winner !== null || o.draw;
};

/** Whose turn it is, given who started. */
export function turn(board: Board, first: Mark): Mark {
  const placed = board.filter(Boolean).length;
  return placed % 2 === 0 ? first : first === 'X' ? 'O' : 'X';
}

/** Returns a new board, or the same board if the move is illegal. */
export function play(board: Board, index: number, first: Mark): Board {
  if (index < 0 || index > 8 || board[index] || isOver(board)) return board;
  const next = board.slice();
  next[index] = turn(board, first);
  return next;
}

// ---- computer opponent ----------------------------------------------------

export type Level = 'easy' | 'hard';

export const emptyCells = (board: Board): number[] => board.flatMap((c, i) => (c ? [] : [i]));
export const otherMark = (m: Mark): Mark => (m === 'X' ? 'O' : 'X');

const memo = new Map<string, number>();

/**
 * Minimax value of `board` for `me`, with `toMove` to play. Wins score
 * 1 + empty squares left (so faster wins rank higher); draws score 0.
 * Pure in its inputs, so results are memoised across calls.
 */
function minimax(board: Board, toMove: Mark, me: Mark): number {
  const key = `${board.map((c) => c ?? '-').join('')}${toMove}${me}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const o = outcome(board);
  let best: number;
  if (o.winner) {
    const v = 1 + board.filter((c) => !c).length;
    best = o.winner === me ? v : -v;
  } else if (o.draw) best = 0;
  else {
    best = toMove === me ? -Infinity : Infinity;
    for (const i of emptyCells(board)) {
      board[i] = toMove;
      const v = minimax(board, otherMark(toMove), me);
      board[i] = null;
      best = toMove === me ? Math.max(best, v) : Math.min(best, v);
    }
  }
  memo.set(key, best);
  return best;
}

/** Every move with the best minimax value for the side to move. */
export function bestMoves(board: Board, first: Mark): number[] {
  if (isOver(board)) return [];
  const me = turn(board, first);
  const work = board.slice();
  let best = -Infinity;
  let out: number[] = [];
  for (const i of emptyCells(board)) {
    work[i] = me;
    const v = minimax(work, otherMark(me), me);
    work[i] = null;
    if (v > best) {
      best = v;
      out = [i];
    } else if (v === best) out.push(i);
  }
  return out;
}

/** A move that wins on the spot for `mark`, or -1. */
export function winningMove(board: Board, mark: Mark): number {
  for (const i of emptyCells(board)) {
    const b = board.slice();
    b[i] = mark;
    if (outcome(b).winner === mark) return i;
  }
  return -1;
}

/**
 * The computer's move for whoever is to play, or -1 once the game is over.
 * Hard is perfect play (never loses). Easy takes a win when it sees one,
 * otherwise plays a random square 60% of the time.
 */
export function chooseMove(board: Board, first: Mark, level: Level, rng: Rng): number {
  if (isOver(board)) return -1;
  const me = turn(board, first);
  if (level === 'easy') {
    const win = winningMove(board, me);
    if (win >= 0) return win;
    if (rng.chance(0.6)) return rng.pick(emptyCells(board));
  }
  return rng.pick(bestMoves(board, first));
}
