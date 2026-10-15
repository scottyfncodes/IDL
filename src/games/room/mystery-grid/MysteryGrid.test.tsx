import { fireEvent, render, screen } from '@testing-library/react';
import MysteryGrid from './MysteryGrid';
import { load, save } from '../../../lib/storage';
import { loadRoomStats } from '../../../room/stats';
import { emptyMarks, generate, truth, type Mark } from './logic';

const KEY = 'room:mystery-grid';

function seedSolved(hints: number, checks = 0) {
  const puzzle = generate(4242, 'gentle');
  const marks: Mark[] = emptyMarks().map((_, i) => truth(puzzle.solution, i));
  save(KEY, { difficulty: 'gentle', autoCross: true, tab: 0, game: { puzzle, marks, struck: [], history: [], hints, checks, won: false } }, 1);
}

describe('Mystery Grid screen', () => {
  it('records a solve exactly once with a hints score, and marks a new best', () => {
    seedSolved(2);
    const { rerender, unmount } = render(<MysteryGrid />);
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('Case closed')).toBeTruthy();
    expect(screen.getByText('New best')).toBeTruthy();
    const stats = loadRoomStats('mystery-grid');
    expect(stats).toMatchObject({ played: 1, completed: 1 });
    expect(stats.best.gentle).toMatchObject({ value: 2, better: 'lower', label: '2 hints' });
    expect(load<{ game: { recorded: boolean } }>(KEY, null as never, 1).game.recorded).toBe(true);
    rerender(<MysteryGrid />);
    unmount();
    render(<MysteryGrid />);
    expect(screen.getByText('Case closed')).toBeTruthy();
    expect(loadRoomStats('mystery-grid').played).toBe(1);
  });

  it('a worse solve is recorded but is not a new best', () => {
    // First, a clean solve sets the best.
    seedSolved(0);
    const first = render(<MysteryGrid />);
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    first.unmount();
    seedSolved(3, 1);
    render(<MysteryGrid />);
    fireEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(screen.getByText('Case closed')).toBeTruthy();
    expect(screen.queryByText('New best')).toBeNull();
    const stats = loadRoomStats('mystery-grid');
    expect(stats.played).toBe(2);
    expect(stats.best.gentle).toMatchObject({ value: 0, label: 'No hints' });
  });
});
