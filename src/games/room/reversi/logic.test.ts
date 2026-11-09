import { createRng, type Rng } from '../../../lib/rng';
import {
  applyMove,
  boardOver,
  canMove,
  chooseMove,
  counts,
  flipsFor,
  HARD_DEPTH,
  idx,
  initialBoard,
  isOver,
  legalMoves,
  newGame,
  play,
  squareName,
  stableDiscs,
  undo,
  winnerOf,
  type Board,
  type Game,
  type Player,
} from './logic';

/** Board from 8 strings (row 1 first): '.' empty, 'x' player 1, 'o' player 2. */
const B = (...rows: string[]): Board => {
  expect(rows).toHaveLength(8);
  return rows.flatMap((r) => {
    const cells = r.replace(/\s/g, '');
    expect(cells).toHaveLength(8);
    return [...cells].map((ch) => (ch === 'x' ? 1 : ch === 'o' ? 2 : 0));
  }) as Board;
};
const at = (name: string) => idx(Number(name[1]) - 1, 'abcdefgh'.indexOf(name[0]));
const gameFrom = (board: Board, turn: Player): Game => ({ board, turn, last: null, passed: null, history: [] });

/**
 * The previous hard opponent (negamax depth 4, square weights + mobility),
 * kept here only as a sparring partner for the strength test.
 */
const OLD_WEIGHTS = [
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -50, -2, -2, -2, -2, -50, -20,
  10, -2, 1, 1, 1, 1, -2, 10,
  5, -2, 1, 0, 0, 1, -2, 5,
  5, -2, 1, 0, 0, 1, -2, 5,
  10, -2, 1, 1, 1, 1, -2, 10,
  -20, -50, -2, -2, -2, -2, -50, -20,
  100, -20, 10, 5, 5, 10, -20, 100,
];
const OLD_NEAR: [number, number[]][] = [[0, [1, 8, 9]], [7, [6, 15, 14]], [56, [57, 48, 49]], [63, [62, 55, 54]]];
function oldEvaluate(board: Board, me: Player): number {
  const opp: Player = me === 1 ? 2 : 1;
  let pos = 0;
  for (let i = 0; i < 64; i++) {
    if (board[i] === me) pos += OLD_WEIGHTS[i];
    else if (board[i] === opp) pos -= OLD_WEIGHTS[i];
  }
  for (const [corner, near] of OLD_NEAR) {
    if (board[corner] === 0) continue;
    for (const n of near) {
      if (board[n] === me) pos -= OLD_WEIGHTS[n];
      else if (board[n] === opp) pos += OLD_WEIGHTS[n];
    }
  }
  const a = legalMoves(board, me).length;
  const b = legalMoves(board, opp).length;
  return pos + (a + b === 0 ? 0 : (100 * (a - b)) / (a + b + 2));
}
function oldSearch(board: Board, me: Player, depth: number, alpha: number, beta: number, passedLast: boolean): number {
  const opp: Player = me === 1 ? 2 : 1;
  const moves = legalMoves(board, me);
  if (moves.length === 0) {
    if (passedLast) {
      const n = counts(board);
      const d = n[me] - n[opp];
      return d > 0 ? 100000 + d : d < 0 ? -100000 + d : 0;
    }
    return -oldSearch(board, opp, depth, -beta, -alpha, true);
  }
  if (depth <= 0) return oldEvaluate(board, me);
  moves.sort((x, y) => OLD_WEIGHTS[y] - OLD_WEIGHTS[x]);
  let best = -Infinity;
  for (const m of moves) {
    const v = -oldSearch(applyMove(board, m, me)!, opp, depth - 1, -beta, -alpha, false);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}
function oldHardMove(board: Board, player: Player, rng: Rng): number | null {
  const moves = legalMoves(board, player);
  if (moves.length === 0) return null;
  const empties = counts(board).empty;
  const depth = empties <= 10 ? empties : 4;
  const opp: Player = player === 1 ? 2 : 1;
  const ordered = rng.shuffle(moves).sort((x, y) => OLD_WEIGHTS[y] - OLD_WEIGHTS[x]);
  let best = ordered[0];
  let alpha = -Infinity;
  for (const m of ordered) {
    const v = -oldSearch(applyMove(board, m, player)!, opp, depth - 1, -Infinity, -alpha, false);
    if (v > alpha) {
      alpha = v;
      best = m;
    }
  }
  return best;
}

describe('setup', () => {
  test('standard four-disc start, player 1 to move', () => {
    const b = initialBoard();
    expect(counts(b)).toEqual({ 1: 2, 2: 2, empty: 60 });
    expect(b[at('d4')]).toBe(2);
    expect(b[at('e4')]).toBe(1);
    expect(b[at('d5')]).toBe(1);
    expect(b[at('e5')]).toBe(2);
    expect(newGame().turn).toBe(1);
  });

  test('opening legal moves are the four classic squares', () => {
    expect(legalMoves(initialBoard(), 1).map(squareName).sort()).toEqual(['c4', 'd3', 'e6', 'f5']);
    expect(legalMoves(initialBoard(), 2).map(squareName).sort()).toEqual(['c5', 'd6', 'e3', 'f4']);
  });
});

describe('flipping', () => {
  test('flips in all eight directions at once', () => {
    const b = B(
      '........',
      '.x.x.x..',
      '..ooo...',
      '.xo.ox..',
      '..ooo...',
      '.x.x.x..',
      '........',
      '........',
    );
    const centre = idx(3, 3);
    expect(flipsFor(b, centre, 1).sort((a, c) => a - c)).toEqual([18, 19, 20, 26, 28, 34, 35, 36]);
    const next = applyMove(b, centre, 1)!;
    expect(counts(next)[2]).toBe(0);
    expect(next[centre]).toBe(1);
  });

  test('multi-disc lines flip fully; lines open at the end do not flip', () => {
    const b = B(
      'x.......',
      '.o......',
      '..o.....',
      '...ooooo',
      '..o.o...',
      '.x..o...',
      '....o...',
      '....o...',
    );
    // f6 → the long a1 diagonal (b2, c3, d4, e5) is flanked by a1.
    // The e-file below runs to the edge and the e6/d6 row ends empty: no flips there.
    expect(flipsFor(b, at('f6'), 1).sort((a, c) => a - c)).toEqual([at('b2'), at('c3'), at('d4'), at('e5')]);
    expect(flipsFor(b, at('f6'), 1)).not.toContain(at('e6'));
    expect(flipsFor(b, at('f6'), 1)).not.toContain(at('e7'));
  });

  test('one move can flip two lines of different lengths', () => {
    const b = B(
      '........',
      '........',
      '...x....',
      '...o....',
      '...o....',
      '.xoo....',
      '........',
      '........',
    );
    expect(flipsFor(b, at('d7'), 1).sort((a, c) => a - c)).toEqual([at('d4'), at('d5'), at('d6')]);
    expect(flipsFor(b, at('e6'), 1).sort((a, c) => a - c)).toEqual([at('c6'), at('d6')]);
    expect(flipsFor(b, at('e5'), 1)).toEqual([]);
    const two = B(
      '........',
      '...x....',
      '...o....',
      '...o....',
      'xoo.....',
      '........',
      '........',
      '........',
    );
    expect(flipsFor(two, at('d5'), 1).sort((a, c) => a - c)).toEqual([at('d3'), at('d4'), at('b5'), at('c5')].sort((a, c) => a - c));
  });

  test('illegal moves are rejected', () => {
    const g = newGame();
    expect(play(g, at('d4'))).toBeNull(); // occupied
    expect(play(g, at('a1'))).toBeNull(); // flips nothing
    expect(play(g, at('c3'))).toBeNull(); // adjacent diagonal but not flanking for player 1
    expect(play(g, -1)).toBeNull();
    expect(play(g, 64)).toBeNull();
    expect(applyMove(g.board, at('a1'), 1)).toBeNull();
  });

  test('a legal move flips, records the last square and passes the turn', () => {
    const g = play(newGame(), at('d3'))!;
    expect(g.board[at('d3')]).toBe(1);
    expect(g.board[at('d4')]).toBe(1);
    expect(counts(g.board)).toEqual({ 1: 4, 2: 1, empty: 59 });
    expect(g.turn).toBe(2);
    expect(g.last).toBe(at('d3'));
    expect(g.passed).toBeNull();
    expect(g.history).toHaveLength(1);
  });
});

describe('passing and the end', () => {
  test('a player with no move passes and the other moves again', () => {
    const b = B(
      'xoo.....',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '.....oox',
    );
    const g = play(gameFrom(b, 1), at('d1'))!;
    expect(canMove(g.board, 2)).toBe(false);
    expect(canMove(g.board, 1)).toBe(true);
    expect(g.turn).toBe(1);
    expect(g.passed).toBe(2);
    expect(isOver(g)).toBe(false);
    const g2 = play(g, at('e8'))!;
    expect(isOver(g2)).toBe(true);
    expect(winnerOf(g2.board)).toBe(1);
  });

  test('game ends when the board is full', () => {
    const rows = Array(8).fill('xxxxxxxx');
    rows[7] = 'xxxxxxo.';
    const b = B(...rows);
    expect(isOver(gameFrom(b, 1))).toBe(false);
    const g = play(gameFrom(b, 1), at('h8'))!;
    expect(counts(g.board).empty).toBe(0);
    expect(isOver(g)).toBe(true);
    expect(play(g, at('a1'))).toBeNull();
  });

  test('game ends early when both players are stuck', () => {
    const b = B(
      'x.......',
      '........',
      '........',
      '........',
      '........',
      '........',
      '........',
      '.......o',
    );
    expect(boardOver(b)).toBe(true);
    expect(winnerOf(b)).toBe(0); // 1–1 draw
  });

  test('winner by most discs, and draws', () => {
    expect(winnerOf(B('xxxxxxxx', ...Array(7).fill('oooooooo')))).toBe(2);
    expect(winnerOf(B(...Array(5).fill('xxxxxxxx'), ...Array(3).fill('oooooooo')))).toBe(1);
    expect(winnerOf(B(...Array(4).fill('xxxxxxxx'), ...Array(4).fill('oooooooo')))).toBe(0);
  });
});

describe('undo', () => {
  test('steps back one move', () => {
    const g1 = play(newGame(), at('d3'))!;
    const g2 = play(g1, at('c3'))!;
    const u = undo(g2)!;
    expect(u.board).toEqual(g1.board);
    expect(u.turn).toBe(2);
    expect(u.history).toHaveLength(1);
    expect(undo(newGame())).toBeNull();
  });

  test('against the computer, takes back your move and its reply', () => {
    const g1 = play(newGame(), at('d3'))!;
    const g2 = play(g1, at('c3'))!;
    const u = undo(g2, 1)!;
    expect(u.board).toEqual(initialBoard());
    expect(u.turn).toBe(1);
    expect(u.history).toHaveLength(0);
  });

  test('undo across a pass rewinds every computer reply', () => {
    // Computer (2) moves twice in a row after the human (1) is stuck.
    let g = gameFrom(
      B(
        'oxx.....',
        '........',
        '........',
        '........',
        '........',
        '........',
        '........',
        '.....xxo',
      ),
      1,
    );
    g = { ...g, turn: 2 };
    // Human sets up first: pretend the human just played, so history has a human move.
    g = { ...g, history: [{ board: g.board, turn: 1, last: null, passed: null, mover: 1 }] };
    const a = play(g, at('d1'))!; // 2 flips b1,c1 → 1 has no move → 2 again
    expect(a.passed).toBe(1);
    const b = play(a, at('e8'))!;
    expect(isOver(b)).toBe(true);
    const u = undo(b, 1)!;
    expect(u.history).toHaveLength(0);
    expect(u.turn).toBe(1);
  });
});

describe('computer opponent', () => {
  function randomGames(n: number, cb: (g: Game) => void) {
    for (let s = 0; s < n; s++) {
      const rng = createRng(`walk-${s}`);
      let g = newGame();
      while (!isOver(g)) {
        cb(g);
        g = play(g, rng.pick(legalMoves(g.board, g.turn)))!;
      }
      cb(g);
    }
  }

  test('always returns a legal move, on both levels', () => {
    let checked = 0;
    randomGames(6, (g) => {
      if (isOver(g)) return;
      for (const level of ['easy', 'hard'] as const) {
        const m = chooseMove(g.board, g.turn, level, createRng(checked++), { depth: 3 });
        expect(m).not.toBeNull();
        expect(legalMoves(g.board, g.turn)).toContain(m);
      }
    });
    expect(checked).toBeGreaterThan(300);
  });

  test('never moves when the game is over or it has no move', () => {
    const full = B(...Array(8).fill('xxxxxxxx'));
    expect(chooseMove(full, 2, 'hard', createRng(1))).toBeNull();
    expect(chooseMove(full, 1, 'easy', createRng(1))).toBeNull();
    const stuck = B('x.......', ...Array(6).fill('........'), '.......o');
    expect(chooseMove(stuck, 1, 'hard', createRng(1))).toBeNull();
  });

  test('hard values corners and shuns X-squares beside an empty corner', () => {
    // Over many real positions, not one hand-picked board: a deeper search
    // will sometimes rightly leave a corner that cannot run away.
    const X: Record<number, number> = { 9: 0, 14: 7, 49: 56, 54: 63 };
    const isCorner = (m: number) => m === 0 || m === 7 || m === 56 || m === 63;
    let offered = 0, taken = 0, xOffered = 0, xPlayed = 0;
    for (let s = 0; s < 12; s++) {
      const rng = createRng(`walk-${s}`);
      let g = newGame();
      while (!isOver(g)) {
        const ms = legalMoves(g.board, g.turn);
        const xRisk = (m: number) => X[m] !== undefined && g.board[X[m]] === 0;
        const corner = ms.some(isCorner);
        const xChoice = ms.some(xRisk) && ms.some((m) => !xRisk(m));
        if (corner || xChoice) {
          const m = chooseMove(g.board, g.turn, 'hard', createRng(s), { depth: 4 })!;
          if (corner) {
            offered++;
            if (isCorner(m)) taken++;
          }
          if (xChoice) {
            xOffered++;
            if (xRisk(m)) xPlayed++;
          }
        }
        g = play(g, rng.pick(ms))!;
      }
    }
    expect(offered).toBeGreaterThan(100);
    expect(taken / offered).toBeGreaterThan(0.6);
    expect(xPlayed / xOffered).toBeLessThan(0.05);
  }, 60_000);

  test('hard plays perfectly in the endgame', () => {
    // Exhaustive solver: best final disc difference for `p` to move.
    const solve = (board: Board, p: Player, passed = false): number => {
      const moves = legalMoves(board, p);
      const q: Player = p === 1 ? 2 : 1;
      if (moves.length === 0) {
        if (passed) return counts(board)[p] - counts(board)[q];
        return -solve(board, q, true);
      }
      return Math.max(...moves.map((m) => -solve(applyMove(board, m, p)!, q)));
    };
    let tested = 0;
    for (let s = 0; s < 40 && tested < 12; s++) {
      const rng = createRng(`end-${s}`);
      let g = newGame();
      while (!isOver(g) && counts(g.board).empty > 6) g = play(g, rng.pick(legalMoves(g.board, g.turn)))!;
      if (isOver(g)) continue;
      const best = solve(g.board, g.turn);
      const m = chooseMove(g.board, g.turn, 'hard', createRng(s))!;
      const q: Player = g.turn === 1 ? 2 : 1;
      const after = applyMove(g.board, m, g.turn)!;
      const got = canMove(after, q) ? -solve(after, q) : solve(after, g.turn, true);
      // A win stays a win, a draw stays at least a draw.
      expect(Math.sign(got)).toBe(Math.sign(best));
      tested++;
    }
    expect(tested).toBeGreaterThanOrEqual(10);
  });

  test('deterministic for a given seed', () => {
    for (const level of ['easy', 'hard'] as const) {
      const run = (seed: number) => {
        const rng = createRng(seed);
        const moves: number[] = [];
        let g = newGame();
        while (!isOver(g)) {
          const m = chooseMove(g.board, g.turn, level, rng, { depth: 4 })!;
          moves.push(m);
          g = play(g, m)!;
        }
        return moves;
      };
      expect(run(42)).toEqual(run(42));
    }
  }, 60_000);

  test('hard comfortably beats easy', () => {
    let hardWins = 0;
    for (let s = 0; s < 8; s++) {
      const rng = createRng(`match-${s}`);
      const hardSide: Player = s % 2 === 0 ? 1 : 2;
      let g = newGame();
      while (!isOver(g)) g = play(g, chooseMove(g.board, g.turn, g.turn === hardSide ? 'hard' : 'easy', rng, { depth: 3 })!)!;
      if (winnerOf(g.board) === hardSide) hardWins++;
    }
    expect(hardWins).toBeGreaterThanOrEqual(7);
  });

  test('hard keeps to its thinking budget', () => {
    const budgetMs = 40;
    const times: number[] = [];
    const rng = createRng('speed');
    let g = newGame();
    while (!isOver(g)) {
      const t = performance.now();
      const m = chooseMove(g.board, g.turn, 'hard', rng, { budgetMs })!;
      times.push(performance.now() - t);
      expect(legalMoves(g.board, g.turn)).toContain(m);
      g = play(g, m)!;
    }
    times.sort((a, b) => a - b);
    expect(times[times.length >> 1]).toBeLessThan(budgetMs * 1.5);
    // Generous slack for slow CI: the search checks the clock every 1024 nodes.
    expect(times[times.length - 1]).toBeLessThan(budgetMs * 6);
  }, 60_000);

  test('with a time budget, stops deepening when the (injected) clock runs out', () => {
    for (let s = 0; s < 6; s++) {
      const rng = createRng(`clock-${s}`);
      let g = newGame();
      for (let k = 0; k < 12; k++) g = play(g, rng.pick(legalMoves(g.board, g.turn)))!;
      let t = 0;
      const now = () => (t += 10); // every look at the clock costs 10 ms
      const timed = chooseMove(g.board, g.turn, 'hard', createRng(s), { budgetMs: 30, now });
      // Depths 1 and 2 always finish; by then over half the budget is gone, so it stops.
      expect(timed).toBe(chooseMove(g.board, g.turn, 'hard', createRng(s), { depth: 2 }));
    }
  });

  test('stable discs grow from an owned corner along a full edge', () => {
    const b = B(
      'xxxo....',
      'x.......',
      '........',
      '...ox...',
      '...xo...',
      '........',
      '........',
      '........',
    );
    const st = stableDiscs(b);
    expect([at('a1'), at('b1'), at('c1'), at('a2')].every((i) => st[i] === 1)).toBe(true);
    expect(st[at('d1')]).toBe(0); // can still be outflanked along the row
    expect(st[at('d4')]).toBe(0);
    expect(stableDiscs(initialBoard()).every((v) => v === 0)).toBe(true);
  });

  test(`hard (depth ${HARD_DEPTH}) beats the old depth-4 opponent in most games, on both sides`, () => {
    let newWins = 0;
    const games = 8;
    for (let s = 0; s < games; s++) {
      const newSide: Player = s % 2 === 0 ? 1 : 2;
      const rng = createRng(`h2h-${s >> 1}`);
      let g = newGame();
      // Two random opening moves so each pair of games starts somewhere new.
      for (let k = 0; k < 2; k++) g = play(g, rng.pick(legalMoves(g.board, g.turn)))!;
      while (!isOver(g)) {
        const m = g.turn === newSide ? chooseMove(g.board, g.turn, 'hard', rng) : oldHardMove(g.board, g.turn, rng);
        g = play(g, m!)!;
      }
      if (winnerOf(g.board) === newSide) newWins++;
    }
    // Measured: 7 of 8 at depth 6 (average margin about +32 discs).
    expect(newWins).toBeGreaterThanOrEqual(6);
  }, 120_000);
});
