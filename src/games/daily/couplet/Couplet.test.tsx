import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { save as saveKey } from '../../../lib/storage';
import type { DailyRecord } from '../../../daily/types';
import { STAT_SPECS } from '../../../daily/stats';
import Couplet, { INTRO_KEY, initialState, resultFor, type State } from './Couplet';
import mod from './index';
import { boardFor, TIERS, type Board, type Placement } from './logic';

const DATE = '2026-10-14';
const puzzle = mod.getPuzzle(DATE);

/** Place domino `p` with the keyboard: select it in the tray, turn it, press a cell. */
function placeByKeyboard(board: Board, p: Placement) {
  const tray = screen.getByRole('list', { name: 'Dominoes to place' });
  const [x, y] = board.dominoes[p.d];
  const btn = within(tray).getAllByRole('button', { name: new RegExp(`^Domino ${x} and ${y}`) })[0];
  fireEvent.keyDown(btn, { key: 'Enter' }); // select
  const dir = p.b === p.a + 1 ? 0 : p.b === p.a + board.w ? 1 : p.b === p.a - 1 ? 2 : 3;
  for (let i = 0; i < dir; i++) fireEvent.keyDown(btn, { key: 'Enter' }); // turn
  const r = Math.floor(p.a / board.w) + 1;
  const c = (p.a % board.w) + 1;
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Row ${r}, column ${c},`) }));
}

function Harness({ record, onSave }: { record?: DailyRecord<State>; onSave?: (r: Omit<DailyRecord<State>, 'updatedAt'>) => void }) {
  return <Couplet date={DATE} puzzle={puzzle} record={record} save={onSave ?? (() => {})} />;
}

describe('Couplet screen', () => {
  it('opens on the walkthrough the first time, and skipping it shows the boards', () => {
    render(<Harness />);
    expect(screen.getByText('Lay every domino so each region keeps its rule.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Skip the walkthrough' }));
    expect(screen.getByRole('tablist', { name: 'Boards' })).toBeTruthy();
  });

  it('the walkthrough can be solved, and it leads into Easy', () => {
    render(<Harness />);
    // Tutorial solution: 1|4 upright on column 1, 4|5 across the top right, 0|3 across the bottom right.
    const tray = () => screen.getByRole('list', { name: 'Dominoes to place' });
    const sel = (name: RegExp, turns: number) => {
      const b = within(tray()).getByRole('button', { name });
      fireEvent.keyDown(b, { key: 'Enter' });
      for (let i = 0; i < turns; i++) fireEvent.keyDown(b, { key: 'Enter' });
    };
    sel(/^Domino 1 and 4/, 3); // low value leads upward: 1 below, 4 above
    fireEvent.click(screen.getByRole('button', { name: /^Row 2, column 1,/ }));
    sel(/^Domino 4 and 5/, 0);
    fireEvent.click(screen.getByRole('button', { name: /^Row 1, column 2,/ }));
    sel(/^Domino 0 and 3/, 0);
    fireEvent.click(screen.getByRole('button', { name: /^Row 2, column 2,/ }));
    expect(screen.getByText(/That’s the whole game/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start today’s Easy' }));
    expect(screen.getByRole('tab', { name: /Easy/, selected: true })).toBeTruthy();
  });

  it('solves all three boards, saving progress and a spoiler-free result', () => {
    saveKey(INTRO_KEY, true);
    const saves: Omit<DailyRecord<State>, 'updatedAt'>[] = [];
    render(<Harness onSave={(r) => saves.push(r)} />);
    for (const tier of TIERS) {
      fireEvent.click(screen.getByRole('tab', { name: new RegExp(tier, 'i') }));
      const board = boardFor(DATE, tier);
      for (const p of board.solution) placeByKeyboard(board, p);
      expect(screen.getByText(new RegExp(`${tier} solved`, 'i'))).toBeTruthy();
    }
    const last = saves[saves.length - 1];
    expect(last.status).toBe('won');
    expect(last.result!.score).toBe('All three · no hints');
    expect(last.result!.grid).toHaveLength(3);
    // Nothing in the share text gives away a board.
    expect(last.result!.grid!.join(' ')).toMatch(/^Easy \d+:\d\d Medium \d+:\d\d Hard \d+:\d\d$/);
    expect(STAT_SPECS.couplet.bucketOf(last.result!.score, 'won')).toBe('None');
  });

  it('undo takes back the last move, and hints are counted', () => {
    saveKey(INTRO_KEY, true);
    const saves: Omit<DailyRecord<State>, 'updatedAt'>[] = [];
    render(<Harness onSave={(r) => saves.push(r)} />);
    const board = boardFor(DATE, 'easy');
    placeByKeyboard(board, board.solution[0]);
    expect(screen.getByText(`1 of ${board.dominoes.length} dominoes placed`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByText(`0 of ${board.dominoes.length} dominoes placed`)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Hint' }));
    expect(screen.getByText(`1 of ${board.dominoes.length} dominoes placed`)).toBeTruthy();
    const st = saves[saves.length - 1].state;
    expect(st.tiers.easy.hinted).toHaveLength(1);
  });

  it('restores saved progress, including which board was open', () => {
    saveKey(INTRO_KEY, true);
    const board = boardFor(DATE, 'medium');
    const state: State = { ...initialState(), tier: 'medium' };
    state.tiers.medium = { ...state.tiers.medium, placements: board.solution.slice(0, 3) };
    render(<Harness record={{ status: 'playing', state, updatedAt: 0 }} />);
    expect(screen.getByRole('tab', { name: /Medium/, selected: true })).toBeTruthy();
    expect(screen.getByText(`3 of ${board.dominoes.length} dominoes placed`)).toBeTruthy();
  });

  it('says plainly when the board is full but rules are broken', () => {
    saveKey(INTRO_KEY, true);
    const board = boardFor(DATE, 'easy');
    // Every domino flipped end for end: covers the board, but breaks rules on this board.
    const flipped = board.solution.map((p) => ({ ...p, a: p.b, b: p.a }));
    const state: State = initialState();
    state.tiers.easy.placements = flipped;
    render(<Harness record={{ status: 'playing', state, updatedAt: 0 }} />);
    expect(screen.getByText(/Every square is covered, but \d+ rules? (isn’t|aren’t) met\./)).toBeTruthy();
  });

  it('keeps time only while playing', () => {
    vi.useFakeTimers();
    saveKey(INTRO_KEY, true);
    const saves: Omit<DailyRecord<State>, 'updatedAt'>[] = [];
    render(<Harness onSave={(r) => saves.push(r)} />);
    act(() => void vi.advanceTimersByTime(5000));
    const board = boardFor(DATE, 'easy');
    placeByKeyboard(board, board.solution[0]);
    expect(saves[saves.length - 1].state.tiers.easy.ms).toBeGreaterThanOrEqual(4000);
    vi.useRealTimers();
  });
});

describe('result text', () => {
  it('counts hints across the three boards', () => {
    const s = initialState();
    s.tiers.hard.hinted = [1, 2];
    s.tiers.easy.ms = 65_000;
    const r = resultFor(s);
    expect(r.score).toBe('All three · 2 hints');
    expect(r.grid[0]).toBe('Easy 1:05');
    expect(r.grid[2]).toBe('Hard 0:00 · 2 hints');
    expect(STAT_SPECS.couplet.bucketOf(r.score, 'won')).toBe('2');
    expect(STAT_SPECS.couplet.bucketOf('All three · 1 hint', 'won')).toBe('1');
    expect(STAT_SPECS.couplet.bucketOf('All three · 7 hints', 'won')).toBe('3+');
  });
});
