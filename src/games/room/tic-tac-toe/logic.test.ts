import { emptyBoard, outcome, play, turn, type Board } from './logic';

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
