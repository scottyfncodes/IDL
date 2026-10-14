import { fireEvent, render, screen, within } from '@testing-library/react';
import Deduction, { DeductionReveal } from './Deduction';
import mod from './index';
import { refutingClue, type State } from './logic';
import type { DailyRecord } from '../../../daily/types';

const puzzle = mod.getPuzzle('2026-10-14');
const culpritName = puzzle.suspects[puzzle.culprit].name;
const wrongs = puzzle.suspects.map((_, i) => i).filter((i) => i !== puzzle.culprit);

const allAttrText = (el: HTMLElement) =>
  [...el.querySelectorAll('*')].map((n) => [...n.attributes].map((a) => a.value).join(' ')).join(' ') + (el.textContent ?? '');

function accuseByName(name: string) {
  fireEvent.click(screen.getByRole('button', { name: 'Make an accusation' }));
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(name) }));
  fireEvent.click(screen.getByRole('button', { name: `Accuse ${name}` }));
}

describe('Deduction screen', () => {
  it('shows the lineup and clues without marking the culprit', () => {
    const { container } = render(<Deduction date={puzzle.date} puzzle={puzzle} record={undefined} save={() => {}} />);
    expect(screen.getByText(puzzle.scenario.title)).toBeTruthy();
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(puzzle.suspects.length);
    const all = allAttrText(container);
    expect(all).not.toMatch(/culprit\./i);
    expect(container.querySelector('.is-culprit')).toBeNull();
    expect(all).not.toContain('Guilty');
  });

  it('crosses suspects off as free notes', () => {
    const save = vi.fn();
    render(<Deduction date={puzzle.date} puzzle={puzzle} record={undefined} save={save} />);
    const first = screen.getAllByRole('button', { pressed: false })[0];
    fireEvent.click(first);
    expect(first.getAttribute('aria-pressed')).toBe('true');
    expect(save).toHaveBeenLastCalledWith({ status: 'playing', state: { ruledOut: [0], accusations: [] } });
  });

  it('a wrong accusation names the clue that clears that suspect; the right one wins', () => {
    const save = vi.fn();
    render(<Deduction date={puzzle.date} puzzle={puzzle} record={undefined} save={save} />);
    const w = wrongs[0];
    const name = puzzle.suspects[w].name;
    accuseByName(name);
    expect(screen.getByText(new RegExp(`Not ${name}: clue ${refutingClue(puzzle, w) + 1} rules them out`))).toBeTruthy();
    expect(save.mock.calls.at(-1)![0].status).toBe('playing');

    accuseByName(culpritName);
    const last = save.mock.calls.at(-1)![0];
    expect(last.status).toBe('won');
    expect(last.result).toEqual({ score: 'Solved on 2nd accusation', grid: ['🔍✅'] });
    expect(screen.getByText(`Case closed. It was ${culpritName}.`)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Make an accusation' })).toBeNull();
  });

  it('loses after three wrong accusations', () => {
    const save = vi.fn();
    render(<Deduction date={puzzle.date} puzzle={puzzle} record={undefined} save={save} />);
    for (const w of wrongs.slice(0, 3)) accuseByName(puzzle.suspects[w].name);
    const last = save.mock.calls.at(-1)![0];
    expect(last.status).toBe('lost');
    expect(last.result).toEqual({ score: 'Case unsolved', grid: ['🔍🔍🔍'] });
  });

  it('reveal lists every clue with who it rules out', () => {
    const record: DailyRecord<State> = { status: 'won', state: { ruledOut: [], accusations: [puzzle.culprit] }, updatedAt: 0 };
    const { container } = render(<DeductionReveal puzzle={puzzle} record={record} />);
    expect(container.querySelectorAll('.dd-reveal__list li')).toHaveLength(puzzle.clues.length);
    expect(within(container).getByText(culpritName)).toBeTruthy();
    expect(container.textContent).toContain('Rules out');
  });
});
