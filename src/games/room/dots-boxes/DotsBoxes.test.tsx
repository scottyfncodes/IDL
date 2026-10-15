import { act, fireEvent, render, screen } from '@testing-library/react';
import DotsBoxes from './DotsBoxes';
import { load, save } from '../../../lib/storage';
import { loadRoomStats } from '../../../room/stats';
import { drawnCount, isOver, newGame, type State } from './logic';

const KEY = 'room:dots-boxes';
const status = () => document.querySelector('.status-line')!.textContent;
const stored = () => load<{ game: State; opponent: string; recorded: boolean } | null>(KEY, null, 2)!;
const openEdges = () => [...document.querySelectorAll<SVGGElement>('.db-edge[tabindex="0"]')];
const tick = (ms = 800) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

/** 3×3 with every line drawn except the top-left one, boxes split 4–4. */
function nearlyDone(): State {
  const s = newGame(3, 1);
  s.h = s.h.map((row) => row.map(() => 1 as const));
  s.v = s.v.map((row) => row.map(() => 1 as const));
  s.h[0][0] = 0;
  s.boxes = s.boxes.map((row, r) => row.map((_, c) => (r === 0 && c === 0 ? 0 : (((r * 3 + c) % 2) + 1) as 1 | 2)));
  return s;
}

afterEach(() => vi.useRealTimers());

describe('Dots & Boxes screen', () => {
  it('records a friend game exactly once, even after a re-render and a remount', () => {
    save(KEY, { game: nearlyDone(), first: 1, opponent: 'friend', recorded: false }, 2);
    const { rerender, unmount } = render(<DotsBoxes />);
    expect(openEdges()).toHaveLength(1);
    fireEvent.click(openEdges()[0]);
    expect(isOver(stored().game)).toBe(true);
    expect(stored().recorded).toBe(true);
    expect(loadRoomStats('dots-boxes')).toMatchObject({ played: 1, vsFriend: 1 });
    rerender(<DotsBoxes />);
    unmount();
    render(<DotsBoxes />);
    expect(screen.getByRole('button', { name: 'Rematch' })).toBeTruthy();
    expect(loadRoomStats('dots-boxes').played).toBe(1);
  });

  it('carries a version 1 game over as a friend game', () => {
    const g = newGame(3, 1);
    g.h[0][0] = 1;
    g.turn = 2;
    save(KEY, { game: g, first: 1 }, 1);
    render(<DotsBoxes />);
    expect(status()).toBe('Player 2 to draw a line');
    expect(screen.getByRole('radio', { name: 'A friend' }).getAttribute('aria-checked')).toBe('true');
  });

  it('vs idl: blocks input while thinking, replies by itself, and records the result with the level', () => {
    vi.useFakeTimers();
    render(<DotsBoxes />);
    fireEvent.click(screen.getByRole('radio', { name: 'idl · hard' }));
    fireEvent.click(screen.getByRole('radio', { name: '3×3' }));
    expect(stored().opponent).toBe('hard');
    expect(status()).toMatch(/^Your turn to draw a line/);
    fireEvent.click(openEdges()[0]);
    expect(status()).toMatch(/^idl is thinking…/);
    expect(openEdges()).toHaveLength(0);
    tick();
    expect(drawnCount(stored().game)).toBeGreaterThanOrEqual(2);

    for (let guard = 0; guard < 80 && !isOver(stored().game); guard++) {
      const open = openEdges();
      if (open.length) fireEvent.click(open[0]);
      tick();
    }
    expect(isOver(stored().game)).toBe(true);
    const hard = loadRoomStats('dots-boxes').vsComputer.hard;
    expect(hard.played).toBe(1);
    expect(hard.wins + hard.losses + hard.draws).toBe(1);
    tick(2000);
    expect(loadRoomStats('dots-boxes').played).toBe(1);
  });

  it('asks before switching opponent mid-game', () => {
    render(<DotsBoxes />);
    fireEvent.click(openEdges()[0]);
    fireEvent.click(screen.getByRole('radio', { name: 'idl · easy' }));
    expect(stored().opponent).toBe('friend');
    fireEvent.click(screen.getByRole('button', { name: 'Switch' }));
    expect(stored().opponent).toBe('easy');
    expect(drawnCount(stored().game)).toBe(0);
  });
});
