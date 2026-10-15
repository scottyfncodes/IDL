import { createRng } from '../../../lib/rng';
import { bestMoves, chooseMove, emptyBoard, emptyCells, isOver, outcome, play, turn, type Board, type Mark } from './logic';

const b = (s: string): Board => [...s].map((c) => (c === 'X' || c === 'O' ? c : null));

describe('tic-tac-toe', () => {
  it('detects row, column and diagonal wins', () => {
    expect(outcome(b('XXX OO   ')).winner).toBe('X');
    expect(outcome(b('OX OX O X')).winner).toBe('O');
    expect(outcome(b('XO OX   X')).line).toEqual([0, 4, 8]);
    expect(outcome(b('XXOXO O  ')).line).toEqual([2, 4, 6]);
  });

  it('detects a draw only on a full board with no winner', () => {
    expect(outcome(b('XOXXOOOXX')).draw).toBe(true);
    expect(outcome(b('XOXXOOOX ')).draw).toBe(false);
  });

  it('alternates turns from whoever started', () => {
    let board = emptyBoard();
    expect(turn(board, 'O')).toBe('O');
    board = play(board, 4, 'O');
    expect(board[4]).toBe('O');
    expect(turn(board, 'O')).toBe('X');
  });

  it('rejects moves on taken cells and after the game ends', () => {
    const board = play(emptyBoard(), 0, 'X');
    expect(play(board, 0, 'X')).toBe(board);
    const won = b('XXXOO    ');
    expect(play(won, 8, 'X')).toBe(won);
  });
});

describe('tic-tac-toe computer opponent', () => {
  it('hard never loses: every human line against every optimal reply, either side starting', () => {
    let finished = 0;
    // idl plays O; `first` decides who starts.
    const walk = (board: Board, first: Mark) => {
      const o = outcome(board);
      if (o.winner || o.draw) {
        expect(o.winner).not.toBe('X');
        finished++;
        return;
      }
      if (turn(board, first) === 'O') {
        const moves = bestMoves(board, first);
        expect(moves.length).toBeGreaterThan(0);
        for (const m of moves) walk(play(board, m, first), first);
      } else for (const m of emptyCells(board)) walk(play(board, m, first), first);
    };
    walk(emptyBoard(), 'X');
    walk(emptyBoard(), 'O');
    expect(finished).toBeGreaterThan(1000);
  });

  it('hard never loses against a random opponent over many seeded games', () => {
    for (let g = 0; g < 200; g++) {
      const rng = createRng(`ttt-random-${g}`);
      const first: Mark = g % 2 ? 'X' : 'O';
      let board = emptyBoard();
      while (!isOver(board)) {
        const m = turn(board, first) === 'O' ? chooseMove(board, first, 'hard', rng) : rng.pick(emptyCells(board));
        board = play(board, m, first);
      }
      expect(outcome(board).winner).not.toBe('X');
    }
  });

  it('takes an immediate win on both levels, and hard blocks an immediate loss', () => {
    // O to move (X started, 4 placed): O wins on 5.
    const win = b('X  OO   X');
    for (const level of ['easy', 'hard'] as const) {
      for (let s = 0; s < 20; s++) expect(chooseMove(win, 'X', level, createRng(s))).toBe(5);
    }
    // X threatens 0-1-2; O must block at 2.
    const block = b('XX  O    ');
    for (let s = 0; s < 20; s++) expect(chooseMove(block, 'X', 'hard', createRng(s))).toBe(2);
  });

  it('always returns a legal move, and no move once the game is over', () => {
    const rng = createRng('legal');
    for (let g = 0; g < 100; g++) {
      let board = emptyBoard();
      const level = g % 2 ? 'easy' : 'hard';
      while (!isOver(board)) {
        const m = chooseMove(board, 'X', level, rng);
        expect(board[m]).toBeNull();
        board = play(board, m, 'X');
      }
      expect(chooseMove(board, 'X', level, rng)).toBe(-1);
    }
  });

  it('is deterministic for a given seed', () => {
    const board = b('X        ');
    const a = [0, 1, 2, 3, 4].map((s) => chooseMove(board, 'X', 'easy', createRng(s)));
    const c = [0, 1, 2, 3, 4].map((s) => chooseMove(board, 'X', 'easy', createRng(s)));
    expect(a).toEqual(c);
  });

  it('easy is beatable: it sometimes misses a block', () => {
    const block = b('XX  O    ');
    const picks = new Set(Array.from({ length: 40 }, (_, s) => chooseMove(block, 'X', 'easy', createRng(s))));
    expect(picks.size).toBeGreaterThan(1);
  });
});
