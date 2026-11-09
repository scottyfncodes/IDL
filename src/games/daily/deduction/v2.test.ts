import { addDays } from '../../../lib/date';
import { createRng } from '../../../lib/rng';
import {
  accuse,
  clueText,
  explanation,
  generatePuzzle,
  generatePuzzleV2,
  isValidPuzzle,
  refutingClue,
  V2_FROM,
  type PuzzleV2,
  type State,
  type Suspect,
} from './logic';
import {
  culpritsV2,
  eliminatedByV2,
  generateV2,
  holdsV2,
  isMinimalV2,
  isRelation,
  lookoutsV2,
  NAIVE_MIN,
  naiveCulprits,
  pairsV2,
  roleOf,
  solveV2,
  trueCluesV2,
  V2_MAX_CLUES,
  V2_MIN_CLUES,
  type ClueV2,
} from './v2';
import mod from './index';

const S = (name: string, hat: Suspect['hat'], coat: Suspect['coat'], holding: Suspect['holding']): Suspect => ({ name, hat, coat, holding });

// 0 Ada  cap    red    book
// 1 Bram beret  green  umbrella
// 2 Cleo none   red    nothing
// 3 Dev  cap    blue   book
// 4 Eli  bobble yellow basket
// 5 Fay  beret  red    book
const L: Suspect[] = [
  S('Ada', 'cap', 'red', 'book'),
  S('Bram', 'beret', 'green', 'umbrella'),
  S('Cleo', 'none', 'red', 'nothing'),
  S('Dev', 'cap', 'blue', 'book'),
  S('Eli', 'bobble', 'yellow', 'basket'),
  S('Fay', 'beret', 'red', 'book'),
];
const asCulprit = (c: ClueV2) => culpritsV2([c], L);
const asLookout = (c: ClueV2) => lookoutsV2([c], L);

describe('v2 clue evaluation', () => {
  it('unary clues apply to the role they name', () => {
    expect(asCulprit({ kind: 'is', who: 'culprit', cat: 'hat', value: 'cap' })).toEqual([0, 3]);
    expect(asLookout({ kind: 'is', who: 'culprit', cat: 'hat', value: 'cap' })).toEqual([0, 1, 2, 3, 4, 5]);
    expect(asLookout({ kind: 'not', who: 'lookout', cat: 'coat', value: 'red' })).toEqual([1, 3, 4]);
    expect(asLookout({ kind: 'oneOf', who: 'lookout', cat: 'holding', values: ['umbrella', 'nothing'] })).toEqual([1, 2]);
    expect(asCulprit({ kind: 'end', who: 'culprit' })).toEqual([0, 5]);
    expect(asCulprit({ kind: 'notEnd', who: 'culprit' })).toEqual([1, 2, 3, 4]);
    expect(asCulprit({ kind: 'nextTo', who: 'culprit', cat: 'hat', value: 'none' })).toEqual([1, 3]);
  });
  it('side counts people strictly to one side', () => {
    // book holders: Ada 0, Dev 3, Fay 5
    expect(asCulprit({ kind: 'side', who: 'culprit', side: 'left', cat: 'holding', value: 'book', count: 1 })).toEqual([1, 2, 3]);
    expect(asCulprit({ kind: 'side', who: 'culprit', side: 'right', cat: 'holding', value: 'book', count: 2 })).toEqual([0, 1, 2]);
    expect(asCulprit({ kind: 'side', who: 'culprit', side: 'left', cat: 'coat', value: 'red', count: 0 })).toEqual([0]);
  });
  it('relations tie the two together', () => {
    expect(holdsV2({ kind: 'adjacent' }, L, 2, 3)).toBe(true);
    expect(holdsV2({ kind: 'adjacent' }, L, 2, 4)).toBe(false);
    expect(holdsV2({ kind: 'gap' }, L, 2, 4)).toBe(true);
    expect(holdsV2({ kind: 'gap' }, L, 0, 1)).toBe(false);
    expect(holdsV2({ kind: 'order', first: 'lookout' }, L, 4, 1)).toBe(true);
    expect(holdsV2({ kind: 'order', first: 'culprit' }, L, 4, 1)).toBe(false);
    expect(holdsV2({ kind: 'same', cat: 'coat' }, L, 0, 5)).toBe(true);
    expect(holdsV2({ kind: 'same', cat: 'hat' }, L, 1, 5)).toBe(true);
    // "the same kind of hat" / "thing" needs both to have one
    const bare = [S('A', 'none', 'red', 'nothing'), S('B', 'none', 'blue', 'nothing')];
    expect(holdsV2({ kind: 'same', cat: 'hat' }, bare, 0, 1)).toBe(false);
    expect(holdsV2({ kind: 'same', cat: 'holding' }, bare, 0, 1)).toBe(false);
  });
  it('the culprit is never the lookout', () => {
    for (const c of trueCluesV2(L, 0, 1)) expect(holdsV2(c, L, 2, 2)).toBe(false);
    expect(pairsV2([], L)).toHaveLength(30);
  });
  it('trueCluesV2 only returns clues true of the pair', () => {
    for (let c = 0; c < L.length; c++) {
      for (let l = 0; l < L.length; l++) if (c !== l) for (const k of trueCluesV2(L, c, l)) expect(holdsV2(k, L, c, l)).toBe(true);
    }
  });
});

describe('v2 solving', () => {
  // Lookout: the cap not at an end → Dev. Culprit next to Dev, not in red → Eli.
  const clues: ClueV2[] = [
    { kind: 'is', who: 'lookout', cat: 'hat', value: 'cap' },
    { kind: 'notEnd', who: 'lookout' },
    { kind: 'adjacent' },
    { kind: 'not', who: 'culprit', cat: 'coat', value: 'red' },
  ];
  it('finds the pair step by step, unary clues first', () => {
    expect(pairsV2(clues, L)).toEqual([[4, 3]]);
    const s = solveV2(clues, L);
    expect(s.culprits).toEqual([4]);
    expect(s.lookouts).toEqual([3]);
    expect(s.steps.map((x) => x.clue)).toEqual([0, 1, 3, 2]);
    expect(s.steps[3].culprits).toEqual([1]); // Bram is not next to Dev
  });
  it('interlock: the clues read one at a time as culprit filters leave several people', () => {
    expect(naiveCulprits(clues, L)).toEqual([1, 3, 4]);
    expect(isMinimalV2(clues, L)).toBe(true);
    expect(eliminatedByV2(clues[2], L).culprits).toEqual([]);
  });
});

describe('v2 wording', () => {
  const all: ClueV2[] = [
    { kind: 'is', who: 'lookout', cat: 'hat', value: 'beret' },
    { kind: 'not', who: 'culprit', cat: 'holding', value: 'nothing' },
    { kind: 'oneOf', who: 'lookout', cat: 'coat', values: ['red', 'blue'] },
    { kind: 'end', who: 'lookout' },
    { kind: 'notEnd', who: 'culprit' },
    { kind: 'nextTo', who: 'lookout', cat: 'holding', value: 'book' },
    { kind: 'side', who: 'culprit', side: 'left', cat: 'hat', value: 'cap', count: 2 },
    { kind: 'side', who: 'lookout', side: 'right', cat: 'coat', value: 'red', count: 1 },
    { kind: 'side', who: 'lookout', side: 'right', cat: 'holding', value: 'nothing', count: 0 },
    { kind: 'adjacent' },
    { kind: 'gap' },
    { kind: 'order', first: 'lookout' },
    { kind: 'same', cat: 'coat' },
    { kind: 'same', cat: 'hat' },
  ];
  it('reads as plain English', () => {
    expect(all.map(clueText)).toEqual([
      'The lookout wore a beret.',
      'The culprit was holding something.',
      'The lookout’s coat was either red or blue.',
      'The lookout stood at one end of the row.',
      'The culprit did not stand at either end of the row.',
      'The lookout stood directly next to someone holding a book.',
      'Exactly two people to the left of the culprit wore caps.',
      'Exactly one person to the right of the lookout wore a red coat.',
      'Nobody to the right of the lookout had empty hands.',
      'The culprit stood directly next to the lookout.',
      'Exactly one person stood between the culprit and the lookout.',
      'The lookout stood somewhere to the left of the culprit.',
      'The culprit and the lookout wore coats of the same colour.',
      'The culprit and the lookout wore the same kind of hat.',
    ]);
  });
});

describe('v2 daily generation', () => {
  const dates = Array.from({ length: 365 }, (_, i) => addDays(V2_FROM, i));
  const times: number[] = [];
  const puzzles = dates.map((d) => {
    const t = performance.now();
    const p = mod.getPuzzle(d) as PuzzleV2;
    times.push(performance.now() - t);
    return p;
  });

  it('a year of v2 editions are all valid', () => {
    for (const p of puzzles) {
      const { suspects: Ls, clues } = p;
      expect(p.version).toBe(2);
      expect(isValidPuzzle(p)).toBe(true);
      expect(Ls).toHaveLength(6);
      expect(p.lookout).not.toBe(p.culprit);
      // a unique answer: exactly one (culprit, lookout) pair
      expect(pairsV2(clues, Ls)).toEqual([[p.culprit, p.lookout]]);
      expect(clues.length).toBeGreaterThanOrEqual(V2_MIN_CLUES);
      expect(clues.length).toBeLessThanOrEqual(V2_MAX_CLUES);
      // every clue needed to name the culprit
      for (let k = 0; k < clues.length; k++) expect(culpritsV2(clues.filter((_, j) => j !== k), Ls).length).toBeGreaterThan(1);
      // no clue alone rules out more than half the row as the culprit, or pins the lookout
      for (const c of clues) {
        const e = eliminatedByV2(c, Ls);
        expect(e.culprits.length).toBeLessThanOrEqual(3);
        expect(e.lookouts.length).toBeLessThanOrEqual(4);
      }
      // interlock: independent culprit filters leave at least half the row …
      expect(naiveCulprits(clues, Ls).length).toBeGreaterThanOrEqual(NAIVE_MIN);
      // … the culprit's own clues can't do it, and a relation is always needed
      expect(culpritsV2(clues.filter((c) => roleOf(c) === 'culprit'), Ls).length).toBeGreaterThan(1);
      expect(culpritsV2(clues.filter((c) => !isRelation(c)), Ls).length).toBeGreaterThan(1);
      expect(clues.some((c) => roleOf(c) === 'lookout')).toBe(true);
      // solvable by forced steps alone, no guessing
      const s = solveV2(clues, Ls);
      expect(s.culprits).toEqual([p.culprit]);
      expect(s.lookouts).toEqual([p.lookout]);
      // names distinct, nobody dressed identically, clue text names nobody
      expect(new Set(Ls.map((x) => x.name)).size).toBe(6);
      expect(new Set(Ls.map((x) => `${x.hat}${x.coat}${x.holding}`)).size).toBe(6);
      for (const c of clues) {
        const t = clueText(c);
        expect(t).toMatch(/^[A-Z].+\.$/);
        expect(t).not.toMatch(/undefined|\d/);
        for (const x of Ls) expect(t).not.toContain(x.name);
      }
    }
  });

  it('has variety', () => {
    expect(new Set(puzzles.map((p) => p.culprit)).size).toBe(6);
    expect(new Set(puzzles.map((p) => p.lookout)).size).toBe(6);
    const kinds = new Set(puzzles.flatMap((p) => p.clues.map((c) => c.kind)));
    for (const k of ['is', 'not', 'oneOf', 'end', 'notEnd', 'nextTo', 'side', 'adjacent', 'gap', 'order', 'same']) expect(kinds.has(k as ClueV2['kind'])).toBe(true);
    expect(new Set(puzzles.map((p) => p.clues.length))).toEqual(new Set([4, 5]));
  });

  it('is fast enough for a phone', () => {
    const sorted = [...times].sort((a, b) => a - b);
    expect(sorted[Math.floor(sorted.length / 2)]).toBeLessThan(15);
    expect(sorted[Math.floor(sorted.length * 0.9)]).toBeLessThan(50);
  });

  it('uses its own seed and is deterministic', () => {
    expect(generatePuzzle('2027-03-01')).toEqual(generatePuzzleV2('2027-03-01'));
    expect(generatePuzzleV2('2027-03-01')).toEqual(generatePuzzleV2('2027-03-01', createRng('deduction:v2:2027-03-01')));
    expect(generateV2(createRng('x'))).toEqual(generateV2(createRng('x')));
  });

  it('wrong accusations name the clue in the chain that clears them', () => {
    const fresh: State = { ruledOut: [], accusations: [] };
    for (const p of puzzles.slice(0, 60)) {
      const steps = solveV2(p.clues, p.suspects).steps;
      for (let i = 0; i < 6; i++) {
        if (i === p.culprit) {
          expect(refutingClue(p, i)).toBe(-1);
          continue;
        }
        const r = accuse(p, fresh, i)!;
        expect(r.correct).toBe(false);
        if (r.correct) continue;
        expect(r.clue).toBeGreaterThanOrEqual(0);
        expect(steps.find((s) => s.culprits.includes(i))!.clue).toBe(r.clue);
      }
    }
  });

  it('explains the chain: every innocent cleared, the lookout found', () => {
    for (const p of puzzles.slice(0, 60)) {
      const ex = explanation(p);
      const cleared = ex.flatMap((e) => e.eliminated);
      expect(new Set(cleared).size).toBe(5);
      expect(cleared).not.toContain(p.suspects[p.culprit].name);
      expect(ex.filter((e) => e.lookout)).toHaveLength(1);
      expect(ex.find((e) => e.lookout)!.lookout).toBe(p.suspects[p.lookout].name);
      for (const e of ex) expect(e.eliminated.length + (e.lookoutsEliminated?.length ?? 0)).toBeGreaterThan(0);
    }
  });

  it('pins the first v2 editions', () => {
    const pin = (d: string) => {
      const p = mod.getPuzzle(d) as PuzzleV2;
      return { culprit: p.culprit, lookout: p.lookout, names: p.suspects.map((s) => s.name), clues: p.clues.map(clueText) };
    };
    // Once published these must never change, exactly like the v1 pins.
    expect(pin(V2_FROM)).toEqual({
      culprit: 2,
      lookout: 3,
      names: ['Farid', 'Pilar', 'Xavi', 'Lena', 'Mina', 'Bram'],
      clues: [
        'The lookout’s coat was not blue.',
        'The culprit stood somewhere to the left of the lookout.',
        'Exactly one person to the left of the culprit wore a blue coat.',
        'The lookout was wearing a hat of some kind.',
      ],
    });
    expect(pin('2026-11-13')).toEqual({
      culprit: 3,
      lookout: 1,
      names: ['Tomas', 'Kemi', 'Dev', 'Farid', 'Mina', 'Uma'],
      clues: [
        'Exactly one person to the right of the culprit wore a blue coat.',
        'The lookout stood directly next to someone without a hat.',
        'The lookout stood somewhere to the left of the culprit.',
        'Exactly one person stood between the culprit and the lookout.',
      ],
    });
  });
});
