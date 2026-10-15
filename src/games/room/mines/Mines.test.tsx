import { fireEvent, render, screen } from '@testing-library/react';
import Mines from './Mines';
import { load } from '../../../lib/storage';
import { loadRoomStats } from '../../../room/stats';
import type { Field } from './logic';

const KEY = 'room:mines';
const stored = () => load<{ game: { field: Field; recorded: boolean; generation: string } } | null>(KEY, null, 1)!;
const cell = (r: number, c: number) => screen.getByRole('button', { name: new RegExp(`^Row ${r}, column ${c}:`) });

beforeEach(() => localStorage.clear());

describe('Mines screen', () => {
  it('first tap is safe and opens a region; right click flags', () => {
    render(<Mines />);
    fireEvent.click(cell(4, 4));
    const s = stored();
    expect(s.game.field.status).toBe('playing');
    expect(s.game.generation).toBe('no-guess');
    expect(s.game.field.cells.filter((c) => c === 1).length).toBeGreaterThan(1);
    const m = s.game.field.mines[0];
    const btn = cell(Math.floor(m / 8) + 1, (m % 8) + 1);
    fireEvent.pointerDown(btn, { pointerType: 'mouse', button: 2 });
    fireEvent.contextMenu(btn);
    expect(btn.getAttribute('aria-label')).toMatch(/flagged$/);
    expect(screen.getByLabelText('9 mines left')).toBeTruthy();
  });

  it('flag mode turns taps into flags', () => {
    render(<Mines />);
    fireEvent.click(cell(1, 1));
    fireEvent.click(screen.getByRole('button', { name: /Flag/ }));
    const hidden = stored().game.field.cells.findIndex((c) => c === 0);
    const btn = cell(Math.floor(hidden / 8) + 1, (hidden % 8) + 1);
    fireEvent.click(btn);
    expect(btn.getAttribute('aria-label')).toMatch(/flagged$/);
  });

  it('records a loss exactly once and shows every mine', () => {
    render(<Mines />);
    fireEvent.click(cell(1, 1));
    const m = stored().game.field.mines;
    fireEvent.click(cell(Math.floor(m[0] / 8) + 1, (m[0] % 8) + 1));
    expect(stored().game.field.status).toBe('lost');
    expect(screen.getByText('Mine hit')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /: mine/ })).toHaveLength(10);
    fireEvent.click(cell(Math.floor(m[1] / 8) + 1, (m[1] % 8) + 1));
    expect(loadRoomStats('mines').played).toBe(1);
  });

  it('records a win with a best time', () => {
    render(<Mines />);
    fireEvent.click(cell(1, 1));
    const f = stored().game.field;
    const mines = new Set(f.mines);
    for (let i = 0; i < 64; i++) if (!mines.has(i) && stored().game.field.cells[i] === 0) fireEvent.click(cell(Math.floor(i / 8) + 1, (i % 8) + 1));
    expect(stored().game.field.status).toBe('won');
    expect(screen.getByText('New best')).toBeTruthy();
    const st = loadRoomStats('mines');
    expect(st.played).toBe(1);
    expect(st.best.small).toBeTruthy();
  });
});
