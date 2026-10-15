import { act, fireEvent, render, screen, within } from '@testing-library/react';
import Sudoku from './Sudoku';

function startEasy() {
  vi.useFakeTimers();
  render(<Sudoku />);
  fireEvent.click(screen.getByRole('button', { name: 'Start' }));
  act(() => {
    vi.advanceTimersByTime(100);
  });
  vi.useRealTimers();
}

const board = () => screen.getByRole('group', { name: 'Sudoku board' });
const selectedCell = () => within(board()).getAllByRole('button').find((b) => b.getAttribute('aria-pressed') === 'true');

function stubBoardRect() {
  // 360px board → 40px pitch per cell.
  board().getBoundingClientRect = () => ({ left: 0, top: 0, width: 360, height: 360, right: 360, bottom: 360, x: 0, y: 0, toJSON: () => ({}) });
}

describe('Pocket Sudoku touch and keypad', () => {
  it('lays out nine digit keys plus Undo, Erase and Notes in one keypad', () => {
    startEasy();
    const pad = screen.getByRole('group', { name: 'Place a number' });
    const keys = within(pad).getAllByRole('button');
    expect(keys).toHaveLength(12);
    expect(within(pad).getByRole('button', { name: /^1, (\d left|all placed)$/ })).toBeTruthy();
    expect(within(pad).getByRole('button', { name: 'Undo' })).toBeTruthy();
    expect(within(pad).getByRole('button', { name: 'Erase' })).toBeTruthy();
    const notes = within(pad).getByRole('button', { name: 'Notes off' });
    fireEvent.click(notes);
    expect(screen.getByRole('group', { name: 'Pencil a note' })).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Pencil a note' })).getByRole('button', { name: 'Notes on' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('a touch on a grid line selects the nearest square, and sliding adjusts it', () => {
    startEasy();
    stubBoardRect();
    // On the line between row 2/3 and column 4/5 → row 3, column 5 (0-based 3,4... 1-based labels).
    fireEvent.pointerDown(board(), { pointerId: 7, pointerType: 'touch', clientX: 160, clientY: 120 });
    expect(selectedCell()?.getAttribute('aria-label')).toMatch(/^Row 4, column 5:/);
    fireEvent.pointerMove(board(), { pointerId: 7, pointerType: 'touch', clientX: 205, clientY: 125 });
    expect(selectedCell()?.getAttribute('aria-label')).toMatch(/^Row 4, column 6:/);
    fireEvent.pointerUp(board(), { pointerId: 7, pointerType: 'touch', clientX: 205, clientY: 125 });
    // The click the browser sends after the touch must not move the selection back.
    const first = within(board()).getByRole('button', { name: /^Row 1, column 1:/ });
    fireEvent.click(first);
    expect(selectedCell()?.getAttribute('aria-label')).toMatch(/^Row 4, column 6:/);
  });

  it('mouse and keyboard still select with a normal click, and re-tapping keeps the selection', () => {
    startEasy();
    const cell = within(board()).getByRole('button', { name: /^Row 9, column 9:/ });
    fireEvent.click(cell);
    expect(cell.getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(cell);
    expect(cell.getAttribute('aria-pressed')).toBe('true');
  });

  it('places a digit into the selected empty square', () => {
    startEasy();
    const empty = within(board())
      .getAllByRole('button')
      .find((b) => /: empty$/.test(b.getAttribute('aria-label') ?? ''))!;
    fireEvent.click(empty);
    const label = empty.getAttribute('aria-label')!.split(':')[0];
    fireEvent.click(within(screen.getByRole('group', { name: 'Place a number' })).getAllByRole('button')[4]);
    expect(within(board()).getByRole('button', { name: new RegExp(`^${label}: 5`) })).toBeTruthy();
  });
});
