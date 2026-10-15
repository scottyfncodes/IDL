import { act, fireEvent, render, screen } from '@testing-library/react';
import ConnectFour from './ConnectFour';
import { load, save } from '../../../lib/storage';
import { loadRoomStats } from '../../../room/stats';
import type { Game } from './logic';

const column = (n: number) => screen.getByRole('button', { name: new RegExp(`^Column ${n},`) });
const status = () => document.querySelector('.status-line')!.textContent;
const stored = () => load<{ game: Game; opponent: string } | null>('room:connect-four', null, 2)!;
const tick = (ms = 800) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

afterEach(() => vi.useRealTimers());

describe('Connect Four screen', () => {
  it('records a friend round exactly once, even after a re-render and a remount', () => {
    const { rerender, unmount } = render(<ConnectFour />);
    for (const c of [1, 2, 1, 2, 1, 2, 1]) fireEvent.click(column(c));
    expect(status()).toBe('Player 1 connects four');
    expect(loadRoomStats('connect-four')).toMatchObject({ played: 1, vsFriend: 1 });
    rerender(<ConnectFour />);
    unmount();
    render(<ConnectFour />);
    expect(screen.getByRole('heading', { name: 'Player 1 wins' })).toBeTruthy();
    expect(loadRoomStats('connect-four').played).toBe(1);
  });

  it('carries a version 1 save over', () => {
    save('room:connect-four', { game: { first: 1, moves: [3] }, score: { 1: 2, 2: 5, draws: 1 }, counted: false }, 1);
    render(<ConnectFour />);
    expect(column(4).getAttribute('aria-label')).toMatch(/1 of 6 filled/);
    expect(screen.getByText('Draws so far: 1')).toBeTruthy();
    expect(screen.getByLabelText('5 rounds won')).toBeTruthy();
  });

  it('vs idl: blocks input while thinking, replies by itself, and undo takes back both moves', () => {
    vi.useFakeTimers();
    render(<ConnectFour />);
    fireEvent.click(screen.getByRole('radio', { name: 'idl · easy' }));
    expect(stored().opponent).toBe('easy');
    expect(status()).toMatch(/^Your turn to drop/);
    fireEvent.click(column(4));
    expect(status()).toBe('idl is thinking…');
    expect((column(1) as HTMLButtonElement).disabled).toBe(true);
    tick();
    expect(stored().game.moves).toHaveLength(2);
    expect(status()).toBe('Your turn to drop');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(stored().game.moves).toEqual([]);
  });

  it('vs idl: a finished game records a win/loss once with the level', () => {
    vi.useFakeTimers();
    render(<ConnectFour />);
    fireEvent.click(screen.getByRole('radio', { name: 'idl · hard' }));
    // Keep dropping in the first open column until the round ends.
    for (let guard = 0; guard < 50 && !screen.queryByRole('button', { name: 'Rematch' }); guard++) {
      const open = screen.getAllByRole('button', { name: /Drop your disc/ });
      if (open.length) fireEvent.click(open[0]);
      tick();
    }
    expect(screen.getByRole('button', { name: 'Rematch' })).toBeTruthy();
    const hard = loadRoomStats('connect-four').vsComputer.hard;
    expect(hard.played).toBe(1);
    expect(hard.losses).toBe(1);
    tick(2000);
    expect(loadRoomStats('connect-four').played).toBe(1);
    // idl starts the rematch and moves on its own.
    fireEvent.click(screen.getByRole('button', { name: 'Rematch' }));
    expect(status()).toMatch(/^idl is thinking…/);
    tick();
    expect(stored().game.moves).toHaveLength(1);
    expect(stored().game.first).toBe(2);
  });

  it('asks before switching opponent mid-round', () => {
    render(<ConnectFour />);
    fireEvent.click(column(1));
    fireEvent.click(screen.getByRole('radio', { name: 'idl · hard' }));
    expect(stored().opponent).toBe('friend');
    fireEvent.click(screen.getByRole('button', { name: 'Keep playing' }));
    expect(stored().game.moves).toEqual([0]);
  });
});
