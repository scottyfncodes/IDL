import { fireEvent, render, screen } from '@testing-library/react';
import PictureLogic from './PictureLogic';
import { load } from '../../../lib/storage';
import { loadRoomStats } from '../../../room/stats';
import { PUZZLES_5 } from './puzzles';

const KEY = 'room:picture-logic';
const stored = () => load<{ solved: Record<string, unknown>; progress: Record<string, { marks: string; done: boolean }> } | null>(KEY, null, 1)!;

beforeEach(() => localStorage.clear());

describe('Picture Logic screen', () => {
  it('shows unsolved tiles without titles, then solves the first picture with non-pointer activation (keyboard / assistive tech)', () => {
    render(<PictureLogic />);
    const p = PUZZLES_5[0];
    expect(screen.queryByText(p.title)).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Picture \d+, 5 × 5/ })).toHaveLength(PUZZLES_5.length);
    fireEvent.click(screen.getByRole('button', { name: 'Next unsolved' }));
    const cells = screen.getAllByRole('button', { name: /^Row \d+ \(clue/ });
    expect(cells).toHaveLength(25);
    // No answer in the DOM before solving.
    expect(screen.queryByText(p.title)).toBeNull();
    p.bitmap.forEach((b, i) => b && fireEvent.click(cells[i]));
    expect(stored().progress[p.id].done).toBe(true);
    expect(screen.getByRole('heading', { name: p.title })).toBeTruthy();
    expect(screen.getByText('New best')).toBeTruthy();
    // Further clicks change nothing and record nothing.
    fireEvent.click(cells[p.bitmap.indexOf(false)]);
    expect(loadRoomStats('picture-logic').played).toBe(1);
    fireEvent.click(screen.getAllByRole('button', { name: 'All pictures' })[0]);
    expect(screen.getByRole('button', { name: new RegExp(`^${p.title}, solved`) })).toBeTruthy();
  });

  it('check counts mistakes; hint fills a forced square; progress persists', () => {
    render(<PictureLogic />);
    fireEvent.click(screen.getByRole('button', { name: 'Next unsolved' }));
    const p = PUZZLES_5[0];
    const cells = screen.getAllByRole('button', { name: /^Row \d+ \(clue/ });
    fireEvent.click(cells[p.bitmap.indexOf(false)]);
    fireEvent.click(screen.getByRole('button', { name: /Check/ }));
    expect(screen.getByText('1 square is wrong.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Hint/ }));
    const marks = stored().progress[p.id].marks;
    expect(marks.split('').filter((c) => c === '1')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(stored().progress[p.id].marks.split('').filter((c) => c === '1')).toHaveLength(1);
  });
});
