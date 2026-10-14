/** Tic-Tac-Toe rules. Pure functions, no React. */
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
