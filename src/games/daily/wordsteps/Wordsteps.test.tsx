import { fireEvent, render, screen } from '@testing-library/react';
import Wordsteps from './Wordsteps';
import mod from './index';
import type { DailyRecord } from '../../../daily/types';
import type { State } from './logic';

const puzzle = mod.getPuzzle('2026-10-14');
const typeWord = (w: string) => {
  for (const ch of w) fireEvent.keyDown(window, { key: ch });
  fireEvent.keyDown(window, { key: 'Enter' });
};

describe('Wordsteps screen', () => {
  it('does not render the solution path while playing', () => {
    const { container } = render(<Wordsteps date={puzzle.date} puzzle={puzzle} record={undefined} save={() => {}} />);
    const text = (container.textContent ?? '').toLowerCase();
    for (const w of puzzle.solution.slice(1, -1)) {
      // intermediate words never appear as a run of tiles
      expect(text.includes(w) && !puzzle.start.includes(w) && !puzzle.end.includes(w)).toBe(false);
    }
  });

  it('plays the par ladder with the physical keyboard and saves a win', () => {
    const save = vi.fn();
    render(<Wordsteps date={puzzle.date} puzzle={puzzle} record={undefined} save={save} />);
    for (const w of puzzle.solution.slice(1)) typeWord(w);
    const last = save.mock.calls[save.mock.calls.length - 1][0];
    expect(last.status).toBe('won');
    expect(last.result.score).toBe(`Solved in ${puzzle.par} · par ${puzzle.par}`);
    expect(last.result.grid).toEqual(['🟩'.repeat(puzzle.par)]);
    expect(screen.queryByRole('group', { name: 'Keyboard' })).toBeNull();
  });

  it('explains invalid steps and supports undo', () => {
    const save = vi.fn();
    render(<Wordsteps date={puzzle.date} puzzle={puzzle} record={undefined} save={save} />);
    typeWord('zzzz');
    expect(screen.getByText('Change exactly one letter')).toBeTruthy();
    for (let i = 0; i < 4; i++) fireEvent.keyDown(window, { key: 'Backspace' });
    typeWord(puzzle.start);
    expect(screen.getByText('Already used')).toBeTruthy();
    for (let i = 0; i < 4; i++) fireEvent.keyDown(window, { key: 'Backspace' });
    typeWord(puzzle.start.slice(0, 3) + (puzzle.start[3] === 'q' ? 'x' : 'q'));
    expect(screen.getByText(/Not in the word list|Change exactly one letter/)).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    for (let i = 0; i < 4; i++) fireEvent.keyDown(window, { key: 'Backspace' });
    typeWord(puzzle.solution[1]);
    expect(save).toHaveBeenLastCalledWith({ status: 'playing', state: { ladder: [puzzle.solution[1]] } });
    fireEvent.click(screen.getByRole('button', { name: 'Undo last step' }));
    expect(save).toHaveBeenLastCalledWith({ status: 'playing', state: { ladder: [] } });
  });

  it('restores a finished record read-only', () => {
    const record: DailyRecord<State> = { status: 'won', state: { ladder: puzzle.solution.slice(1) }, updatedAt: 0 };
    const save = vi.fn();
    render(<Wordsteps date={puzzle.date} puzzle={puzzle} record={record} save={save} />);
    expect(screen.queryByRole('group', { name: 'Keyboard' })).toBeNull();
    typeWord('abcd');
    expect(save).not.toHaveBeenCalled();
  });
});
