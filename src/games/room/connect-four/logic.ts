/** Connect Four rules. Pure functions, no React. */
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
