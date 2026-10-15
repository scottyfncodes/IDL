import { act, fireEvent, render, screen } from '@testing-library/react';
import TicTacToe from './TicTacToe';
import { load, save } from '../../../lib/storage';
import { loadRoomStats } from '../../../room/stats';

const cell = (r: number, c: number) => screen.getByRole('gridcell', { name: new RegExp(`^Row ${r}, column ${c}:`) });
const status = () => document.querySelector('.status-line')!.textContent;
const stored = () => load<{ board: unknown[]; opponent: string; first: string; scores: Record<string, { X: number; O: number; draws: number }> } | null>('room:tic-tac-toe', null, 2)!;

afterEach(() => vi.useRealTimers());

describe('Tic-Tac-Toe screen', () => {
  it('records a friend round exactly once, even after a re-render and a remount', () => {
    const { unmount, rerender } = render(<TicTacToe />);
    for (const [r, c] of [[1, 1], [2, 1], [1, 2], [2, 2], [1, 3]] as const) fireEvent.click(cell(r, c));
    expect(status()).toBe('Player 1 wins the round');
    expect(loadRoomStats('tic-tac-toe')).toMatchObject({ played: 1, vsFriend: 1 });
    rerender(<TicTacToe />);
    unmount();
    render(<TicTacToe />);
    expect(status()).toBe('Player 1 wins the round');
    expect(loadRoomStats('tic-tac-toe').played).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: 'Rematch' }));
    expect(status()).toBe('Player 2 to move');
  });

  it('carries a version 1 save over', () => {
    save('room:tic-tac-toe', { board: ['X', null, null, null, null, null, null, null, null], first: 'X', score: { X: 3, O: 1, draws: 2 }, counted: false }, 1);
    render(<TicTacToe />);
    expect(cell(1, 1).getAttribute('aria-label')).toMatch(/Player 1$/);
    expect(screen.getByText('Draws so far: 2')).toBeTruthy();
  });

  it('plays idl: blocks input while it thinks, replies on its own, and records the result once', () => {
    vi.useFakeTimers();
    render(<TicTacToe />);
    fireEvent.click(screen.getByRole('radio', { name: 'idl · hard' }));
    expect(stored().opponent).toBe('hard');
    expect(status()).toMatch(/^Your move/);
    fireEvent.click(cell(2, 2));
    expect(status()).toBe('idl is thinking…');
    expect((cell(1, 1) as HTMLButtonElement).disabled).toBe(true);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(stored().board.filter(Boolean)).toHaveLength(2);
    expect(status()).toBe('Your move');

    // Play on until the round ends: always take the first empty square.
    for (let guard = 0; guard < 10 && !screen.queryByRole('button', { name: 'Rematch' }); guard++) {
      const open = screen.getAllByRole('gridcell').find((b) => !(b as HTMLButtonElement).disabled);
      if (open) fireEvent.click(open);
      act(() => {
        vi.advanceTimersByTime(800);
      });
    }
    expect(screen.getByRole('button', { name: 'Rematch' })).toBeTruthy();
    // Hard never loses.
    expect(status()).not.toBe('You win the round');
    const stats = loadRoomStats('tic-tac-toe');
    expect(stats.played).toBe(1);
    expect(stats.vsComputer.hard.played).toBe(1);
    expect(stats.vsComputer.hard.wins).toBe(0);

    // Rematch: idl starts this time and moves by itself.
    fireEvent.click(screen.getByRole('button', { name: 'Rematch' }));
    expect(status()).toMatch(/^idl is thinking…/);
    expect(screen.getByText(/idl starts this round/)).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(stored().board.filter(Boolean)).toHaveLength(1);
    expect(loadRoomStats('tic-tac-toe').played).toBe(1);
  });

  it('asks before switching opponent mid-round', () => {
    render(<TicTacToe />);
    fireEvent.click(cell(1, 1));
    fireEvent.click(screen.getByRole('radio', { name: 'idl · easy' }));
    expect(stored().opponent).toBe('friend');
    fireEvent.click(screen.getByRole('button', { name: 'Switch' }));
    expect(stored().opponent).toBe('easy');
    expect(stored().board.every((c) => !c)).toBe(true);
  });
});
