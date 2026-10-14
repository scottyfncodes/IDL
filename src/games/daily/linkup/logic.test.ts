import { addDays, LAUNCH_DATE } from '../../../lib/date';
import {
  MAX_MISTAKES,
  applyGuess,
  bandOrder,
  evaluateGuess,
  groupOf,
  initialOrder,
  initialState,
  remainingWords,
  resultFor,
  shuffleOrder,
  statusOf,
  validatePuzzle,
  type LinkupPuzzle,
  type LinkupState,
} from './logic';

const puzzle: LinkupPuzzle = {
  id: 'L999',
  groups: [
    { label: 'Fruits', words: ['APPLE', 'MANGO', 'PEAR', 'PLUM'], level: 0 },
    { label: 'Shades of blue', words: ['NAVY', 'TEAL', 'COBALT', 'AZURE'], level: 1 },
    { label: 'Card games', words: ['SNAP', 'POKER', 'BRIDGE', 'RUMMY'], level: 2 },
    { label: '___ cake', words: ['CUP', 'PAN', 'CHEESE', 'SPONGE'], level: 3 },
  ],
};
const DATE = '2026-10-14';
const fresh = () => initialState(puzzle, DATE);
const G = puzzle.groups.map((g) => g.words);

function play(state: LinkupState, ...guesses: string[][]) {
  let s = state;
  for (const g of guesses) s = applyGuess(puzzle, s, g).state;
  return s;
}

describe('linkup ordering', () => {
  it('initial order is a deterministic permutation per date', () => {
    const a = initialOrder(puzzle, DATE);
    expect(a).toEqual(initialOrder(puzzle, DATE));
    expect([...a].sort()).toEqual(G.flat().sort());
    expect(a).not.toEqual(G.flat());
    expect(initialOrder(puzzle, addDays(DATE, 1))).not.toEqual(a);
  });

  it('shuffle keeps the same words', () => {
    const a = initialOrder(puzzle, DATE);
    const b = shuffleOrder(a, 12345);
    expect([...b].sort()).toEqual([...a].sort());
    expect(shuffleOrder(a, 12345)).toEqual(b);
  });

  it('starts fresh', () => {
    const s = fresh();
    expect(s.solved).toEqual([]);
    expect(s.mistakes).toBe(0);
    expect(statusOf(s)).toBe('playing');
    expect(remainingWords(puzzle, s)).toHaveLength(16);
  });

  it('finds groups case-insensitively', () => {
    expect(groupOf(puzzle, ' navy ')).toBe(1);
    expect(groupOf(puzzle, 'nope')).toBe(-1);
  });
});

describe('linkup guesses', () => {
  it('accepts a correct group in any order', () => {
    const r = applyGuess(puzzle, fresh(), ['PLUM', 'apple', 'Pear', 'MANGO']);
    expect(r.outcome).toEqual({ kind: 'correct', group: 0 });
    expect(r.state.solved).toEqual([0]);
    expect(r.state.mistakes).toBe(0);
    expect(remainingWords(puzzle, r.state)).toHaveLength(12);
    expect(remainingWords(puzzle, r.state)).not.toContain('APPLE');
  });

  it('reports one away for three of a group', () => {
    const r = applyGuess(puzzle, fresh(), ['APPLE', 'MANGO', 'PEAR', 'NAVY']);
    expect(r.outcome.kind).toBe('one-away');
    expect(r.state.mistakes).toBe(1);
  });

  it('reports wrong for a 2+2 or scattered guess', () => {
    expect(evaluateGuess(puzzle, fresh(), ['APPLE', 'MANGO', 'NAVY', 'TEAL']).kind).toBe('wrong');
    expect(evaluateGuess(puzzle, fresh(), ['APPLE', 'NAVY', 'SNAP', 'CUP']).kind).toBe('wrong');
  });

  it('does not charge a mistake for a repeated guess', () => {
    const s1 = play(fresh(), ['APPLE', 'MANGO', 'NAVY', 'TEAL']);
    expect(s1.mistakes).toBe(1);
    const r = applyGuess(puzzle, s1, ['teal', 'NAVY', 'MANGO', 'APPLE']);
    expect(r.outcome.kind).toBe('duplicate');
    expect(r.state).toBe(s1);
    expect(r.state.guesses).toHaveLength(1);
  });

  it('rejects malformed selections', () => {
    expect(evaluateGuess(puzzle, fresh(), ['APPLE', 'MANGO', 'PEAR']).kind).toBe('invalid');
    expect(evaluateGuess(puzzle, fresh(), ['APPLE', 'APPLE', 'PEAR', 'PLUM']).kind).toBe('invalid');
    expect(evaluateGuess(puzzle, fresh(), ['APPLE', 'MANGO', 'PEAR', 'KIWI']).kind).toBe('invalid');
    const s = play(fresh(), G[0]);
    expect(evaluateGuess(puzzle, s, ['APPLE', 'NAVY', 'TEAL', 'COBALT']).kind).toBe('invalid');
  });

  it('wins after four groups and records the score', () => {
    const s = play(fresh(), ['APPLE', 'MANGO', 'PEAR', 'NAVY'], G[3], G[0], G[1], G[2]);
    expect(statusOf(s)).toBe('won');
    expect(s.solved).toEqual([3, 0, 1, 2]);
    const res = resultFor(puzzle, s);
    expect(res.score).toBe('Solved · 1 mistake');
    expect(res.grid).toEqual(['🟨🟨🟨🟩', '🟪🟪🟪🟪', '🟨🟨🟨🟨', '🟩🟩🟩🟩', '🟦🟦🟦🟦']);
    expect(applyGuess(puzzle, s, G[0]).outcome.kind).toBe('invalid');
  });

  it('pluralises the score', () => {
    expect(resultFor(puzzle, play(fresh(), ...G)).score).toBe('Solved · no mistakes');
    const s = play(fresh(), ['APPLE', 'MANGO', 'NAVY', 'TEAL'], ['APPLE', 'MANGO', 'NAVY', 'COBALT'], ...G);
    expect(resultFor(puzzle, s).score).toBe('Solved · 2 mistakes');
  });

  it('loses after four mistakes and reveals the rest', () => {
    const wrong = [
      ['APPLE', 'MANGO', 'NAVY', 'TEAL'],
      ['APPLE', 'MANGO', 'NAVY', 'COBALT'],
      ['APPLE', 'MANGO', 'NAVY', 'AZURE'],
    ];
    let s = play(fresh(), G[2], ...wrong);
    expect(s.mistakes).toBe(3);
    expect(statusOf(s)).toBe('playing');
    s = play(s, ['PEAR', 'PLUM', 'CUP', 'PAN']);
    expect(s.mistakes).toBe(MAX_MISTAKES);
    expect(statusOf(s)).toBe('lost');
    expect(applyGuess(puzzle, s, G[0]).outcome.kind).toBe('invalid');
    expect(bandOrder(puzzle, s)).toEqual([
      { group: 2, found: true },
      { group: 0, found: false },
      { group: 1, found: false },
      { group: 3, found: false },
    ]);
    const res = resultFor(puzzle, s);
    expect(res.score).toBe('1 of 4 groups');
    expect(res.grid).toHaveLength(5);
  });

  it('result grid never contains words', () => {
    const s = play(fresh(), ['APPLE', 'MANGO', 'NAVY', 'TEAL'], ...G);
    for (const line of resultFor(puzzle, s).grid) expect(line).not.toMatch(/[A-Z]/i);
  });

  it('band order only lists solved groups while playing', () => {
    expect(bandOrder(puzzle, play(fresh(), G[1]))).toEqual([{ group: 1, found: true }]);
  });
});

describe('linkup validation', () => {
  it('accepts the sample puzzle', () => {
    expect(validatePuzzle(puzzle)).toEqual([]);
  });

  it('flags structural problems', () => {
    const bad: LinkupPuzzle = {
      id: 'X1',
      groups: [
        { label: 'Fruits', words: ['APPLE', 'MANGO', 'PEAR'], level: 0 },
        { label: 'Blue', words: ['BLUE', 'TEAL', 'COBALT', 'AZURE'], level: 0 },
        { label: '', words: ['SNAP', 'POKER', 'BRIDGE', 'APPLE'], level: 2 },
        { label: 'Cakes', words: ['CUP', 'pan', 'CHEESECAKES', 'A VERY LONG WORD'], level: 3 },
      ],
    };
    const errs = validatePuzzle(bad).join('\n');
    expect(errs).toMatch(/bad id/);
    expect(errs).toMatch(/needs 4 words/);
    expect(errs).toMatch(/levels/);
    expect(errs).toMatch(/empty label/);
    expect(errs).toMatch(/duplicate "APPLE"/);
    expect(errs).toMatch(/equals its label/);
    expect(errs).toMatch(/gives away/);
    expect(errs).toMatch(/too long/);
    expect(errs).toMatch(/upper case/);
  });
});
