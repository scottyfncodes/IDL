import { fireEvent, render, screen, within } from '@testing-library/react';
import Deduction, { DeductionReveal } from './Deduction';
import mod from './index';
import { isV2, refutationText, refutingClues, type State } from './logic';
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
    expect(screen.getByText(`Not ${name}: ${refutationText(refutingClues(puzzle, w))}`, { exact: false })).toBeTruthy();
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

describe('Deduction screen (v2, with a lookout)', () => {
  const p2 = mod.getPuzzle('2026-11-12');
  const culprit2 = p2.suspects[p2.culprit].name;
  const wrongs2 = p2.suspects.map((_, i) => i).filter((i) => i !== p2.culprit);

  it('introduces the lookout without giving anything away', () => {
    const { container } = render(<Deduction date={p2.date} puzzle={p2} record={undefined} save={() => {}} />);
    expect(container.querySelector('.dd-case__lookout')?.textContent).toMatch(/lookout/);
    expect(container.querySelectorAll('.dd-clue')).toHaveLength(p2.clues.length);
    expect(container.querySelector('.is-culprit')).toBeNull();
  });

  it('plays exactly like v1: a wrong accusation names a clue, the right one wins', () => {
    const save = vi.fn();
    render(<Deduction date={p2.date} puzzle={p2} record={undefined} save={save} />);
    const w = wrongs2[0];
    const name = p2.suspects[w].name;
    accuseByName(name);
    expect(screen.getByText(`Not ${name}: ${refutationText(refutingClues(p2, w))}`, { exact: false })).toBeTruthy();
    accuseByName(culprit2);
    expect(save.mock.calls.at(-1)![0].result).toEqual({ score: 'Solved on 2nd accusation', grid: ['🔍✅'] });
  });

  it('reveal walks the chain and names the lookout', () => {
    if (!isV2(p2)) throw new Error('expected a v2 puzzle');
    const record: DailyRecord<State> = { status: 'won', state: { ruledOut: [], accusations: [p2.culprit] }, updatedAt: 0 };
    const { container } = render(<DeductionReveal puzzle={p2} record={record} />);
    const lead = container.querySelector('.dd-reveal__lead')!.textContent!;
    expect(lead).toContain(culprit2);
    expect(lead).toContain(`${p2.suspects[p2.lookout].name} kept lookout`);
    expect(container.textContent).toMatch(/So the lookout must be/);
    expect(container.querySelectorAll('.dd-reveal__list li').length).toBeGreaterThanOrEqual(p2.clues.length);
  });
});

describe('saved progress', () => {
  it('a v1 record still loads onto its v1 puzzle', () => {
    const v1 = mod.getPuzzle('2026-11-11');
    expect(v1.version).toBeUndefined();
    const record: DailyRecord<State> = { status: 'playing', state: { ruledOut: [1, 4], accusations: [] }, updatedAt: 0 };
    render(<Deduction date={v1.date} puzzle={v1} record={record} save={() => {}} />);
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(2);
    expect(screen.queryByText(/lookout/)).toBeNull();
  });
});
