import {
  boardOf,
  COLS,
  drop,
  emptyBoard,
  isColumnFull,
  landingRow,
  legalColumns,
  newGame,
  outcome,
  ROWS,
  turnOf,
  undo,
  type Board,
  type Game,
} from './logic';

/** Board from 6 strings (top row first): '.' empty, 'x' player 1, 'o' player 2. */
const B = (...rows: string[]): Board => {
  expect(rows).toHaveLength(ROWS);
  return rows.map((row) => [...row].map((ch) => (ch === 'x' ? 1 : ch === 'o' ? 2 : 0)));
};

function playAll(g: Game, cols: number[]): Game {
  for (const c of cols) {
    const r = drop(g, c);
    if (!r) throw new Error(`illegal column ${c}`);
    g = r.game;
  }
  return g;
}

const sortCells = (cells: [number, number][] | null) => (cells ? [...cells].sort((a, b) => a[0] - b[0] || a[1] - b[1]) : null);

describe('connect four: dropping', () => {
  it('starts empty with 7×6 cells', () => {
    const b = emptyBoard();
    expect(b).toHaveLength(ROWS);
    expect(b.every((r) => r.length === COLS && r.every((x) => x === 0))).toBe(true);
    expect(outcome(b)).toEqual({ winner: null, cells: null, draw: false });
  });

  it('lands discs in the lowest empty slot and stacks', () => {
    let g = newGame();
    const a = drop(g, 3)!;
    expect(a.row).toBe(ROWS - 1);
    g = a.game;
    const b2 = drop(g, 3)!;
    expect(b2.row).toBe(ROWS - 2);
    const board = boardOf(b2.game);
    expect(board[5][3]).toBe(1);
    expect(board[4][3]).toBe(2);
  });

  it('alternates turns from whoever started', () => {
    let g = newGame(2);
    expect(turnOf(g)).toBe(2);
    g = playAll(g, [0]);
    expect(turnOf(g)).toBe(1);
    expect(boardOf(g)[5][0]).toBe(2);
    g = playAll(g, [1]);
    expect(turnOf(g)).toBe(2);
    expect(boardOf(g)[5][1]).toBe(1);
  });

  it('rejects full columns and out-of-range columns', () => {
    // Column 0 alternating fills without a vertical four.
    const g = playAll(newGame(), [0, 0, 0, 0, 0, 0]);
    const b = boardOf(g);
    expect(isColumnFull(b, 0)).toBe(true);
    expect(landingRow(b, 0)).toBe(-1);
    expect(drop(g, 0)).toBeNull();
    expect(legalColumns(g)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(drop(g, -1)).toBeNull();
    expect(drop(g, 7)).toBeNull();
    expect(drop(g, 1.5)).toBeNull();
    expect(turnOf(g)).toBe(1); // rejection doesn't change the turn
  });

  it('does not mutate the previous game', () => {
    const g = newGame();
    drop(g, 2);
    expect(g.moves).toEqual([]);
  });
});

describe('connect four: wins', () => {
  it('detects horizontal wins, including at the edges', () => {
    const left = outcome(B('.......', '.......', '.......', '.......', 'ooo....', 'xxxx...'));
    expect(left.winner).toBe(1);
    expect(sortCells(left.cells)).toEqual([[5, 0], [5, 1], [5, 2], [5, 3]]);
    const right = outcome(B('...oooo', '...xxxo', '...xoxx', '...oxxo', '...xoox', '...xxox'));
    expect(right.winner).toBe(2);
    expect(sortCells(right.cells)).toEqual([[0, 3], [0, 4], [0, 5], [0, 6]]);
  });

  it('detects vertical wins, including at the edges', () => {
    const top = outcome(B('......x', '......x', '......x', '......x', '.....oo', '....ooo'));
    expect(top.winner).toBe(1);
    expect(sortCells(top.cells)).toEqual([[0, 6], [1, 6], [2, 6], [3, 6]]);
    const bottom = outcome(B('.......', '.......', 'o......', 'o.....x', 'o.....x', 'o.....x'));
    expect(bottom.winner).toBe(2);
    expect(sortCells(bottom.cells)).toEqual([[2, 0], [3, 0], [4, 0], [5, 0]]);
  });

  it('detects ↗ diagonal wins, corner to corner', () => {
    const o = outcome(B('.......', '.......', '...x...', '..xo...', '.xoo...', 'xoox...'));
    expect(o.winner).toBe(1);
    expect(sortCells(o.cells)).toEqual([[2, 3], [3, 2], [4, 1], [5, 0]]);
    const corner = outcome(B('......o', '.....ox', '....oxx', '...oxxo', '...xoxx', '...xoox'));
    expect(corner.winner).toBe(2);
    expect(sortCells(corner.cells)).toEqual([[0, 6], [1, 5], [2, 4], [3, 3]]);
  });

  it('detects ↘ diagonal wins, including corners', () => {
    const o = outcome(B('o......', 'xo.....', 'xxo....', 'oxxo...', 'xoxx...', 'oxox...'));
    expect(o.winner).toBe(2);
    expect(sortCells(o.cells)).toEqual([[0, 0], [1, 1], [2, 2], [3, 3]]);
    const br = outcome(B('.......', '.......', '...x...', '...ox..', '...oox.', '...ooxx'));
    expect(br.winner).toBe(1);
    expect(sortCells(br.cells)).toEqual([[2, 3], [3, 4], [4, 5], [5, 6]]);
  });

  it('returns all cells of a run longer than four', () => {
    const o = outcome(B('.......', '.......', '.......', '.......', 'ooo.ooo', 'xxxxxxx'));
    expect(o.winner).toBe(1);
    expect(o.cells).toHaveLength(7);
  });

  it('ignores three-in-a-row', () => {
    expect(outcome(B('.......', '.......', '.......', '.......', 'oo.....', 'xxx....')).winner).toBeNull();
  });

  it('detects a win on the move that makes it, and allows nothing after', () => {
    // x: 0,1,2  o: 0,1,2 stacked; x plays 3 to win.
    let g = playAll(newGame(), [0, 0, 1, 1, 2, 2]);
    expect(outcome(boardOf(g)).winner).toBeNull();
    const res = drop(g, 3)!;
    g = res.game;
    const o = outcome(boardOf(g));
    expect(o.winner).toBe(1);
    expect(sortCells(o.cells)).toEqual([[5, 0], [5, 1], [5, 2], [5, 3]]);
    expect(drop(g, 4)).toBeNull();
    expect(legalColumns(g)).toEqual([]);
    expect(undo(g)).toBeNull();
  });

  it('detects a win that completes on the final (42nd) move', () => {
    // A legal game with no four-in-a-row until the very last disc fills the board.
    const moves = [0, 1, 1, 1, 1, 1, 2, 4, 3, 6, 2, 6, 0, 2, 6, 1, 6, 5, 4, 5, 4, 0, 6, 3, 4, 0, 0, 2, 3, 6, 0, 5, 2, 4, 2, 3, 5, 5, 4, 3, 3, 5];
    expect(moves).toHaveLength(ROWS * COLS);
    let g = newGame();
    for (let i = 0; i < moves.length - 1; i++) {
      g = drop(g, moves[i])!.game;
      expect(outcome(boardOf(g)).winner).toBeNull();
    }
    const mover = turnOf(g);
    const res = drop(g, moves[moves.length - 1])!;
    const o = outcome(boardOf(res.game));
    expect(o.winner).toBe(mover);
    expect(o.draw).toBe(false); // a full board with a line is a win, not a draw
    expect(o.cells!.length).toBeGreaterThanOrEqual(4);
    expect(o.cells).toContainEqual([res.row, moves[moves.length - 1]]);
  });
});

describe('connect four: draw', () => {
  // A legal 42-move game with no four-in-a-row at any point.
  const DRAW_MOVES = [0, 1, 0, 1, 0, 0, 2, 0, 2, 0, 2, 1, 1, 2, 1, 2, 1, 2, 3, 4, 3, 4, 3, 3, 5, 3, 5, 3, 5, 4, 4, 5, 6, 5, 6, 5, 6, 6, 4, 6, 4, 6];

  it('detects a draw on a full board without a win', () => {
    let g = newGame();
    for (let i = 0; i < DRAW_MOVES.length; i++) {
      expect(outcome(boardOf(g)).winner).toBeNull();
      const res = drop(g, DRAW_MOVES[i]);
      expect(res).not.toBeNull();
      g = res!.game;
    }
    const o = outcome(boardOf(g));
    expect(o).toEqual({ winner: null, cells: null, draw: true });
    expect(legalColumns(g)).toEqual([]);
    for (let c = 0; c < COLS; c++) expect(drop(g, c)).toBeNull();
  });

  it('is not a draw while any slot is open', () => {
    const g = playAll(newGame(), DRAW_MOVES.slice(0, 41));
    expect(outcome(boardOf(g)).draw).toBe(false);
    expect(legalColumns(g)).toEqual([6]);
  });
});

describe('connect four: undo', () => {
  it('removes the last disc and gives the turn back', () => {
    const g = playAll(newGame(), [3, 4]);
    const u = undo(g)!;
    expect(u.moves).toEqual([3]);
    expect(turnOf(u)).toBe(2);
    expect(boardOf(u)[5][4]).toBe(0);
    expect(undo(newGame())).toBeNull();
  });
});
