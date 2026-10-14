import { addDays, LAUNCH_DATE } from '../../../lib/date';
import { createRng } from '../../../lib/rng';
import { NAMES, SCENARIOS } from './content';
import {
  accuse,
  buildClues,
  candidates,
  clueText,
  eliminatedBy,
  explanation,
  generatePuzzle,
  holds,
  isMinimal,
  isValidPuzzle,
  MAX_ACCUSATIONS,
  MAX_CLUES,
  MIN_CLUES,
  POSITIONAL_KINDS,
  refutingClue,
  resultGrid,
  scenarioFor,
  scoreText,
  status,
  toggleRuledOut,
  trueClues,
  type Clue,
  type State,
  type Suspect,
} from './logic';
import mod from './index';

const S = (name: string, hat: Suspect['hat'], coat: Suspect['coat'], holding: Suspect['holding']): Suspect => ({ name, hat, coat, holding });

// 0 Ada  cap    red    book
// 1 Bram beret  green  umbrella
// 2 Cleo none   red    nothing
// 3 Dev  cap    blue   book
// 4 Eli  bobble yellow basket
const L: Suspect[] = [
  S('Ada', 'cap', 'red', 'book'),
  S('Bram', 'beret', 'green', 'umbrella'),
  S('Cleo', 'none', 'red', 'nothing'),
  S('Dev', 'cap', 'blue', 'book'),
  S('Eli', 'bobble', 'yellow', 'basket'),
];
const who = (c: Clue) => L.map((_, i) => i).filter((i) => holds(c, L, i));

describe('clue evaluation', () => {
  it('is / not', () => {
    expect(who({ kind: 'is', cat: 'hat', value: 'cap' })).toEqual([0, 3]);
    expect(who({ kind: 'is', cat: 'hat', value: 'none' })).toEqual([2]);
    expect(who({ kind: 'not', cat: 'coat', value: 'red' })).toEqual([1, 3, 4]);
    expect(who({ kind: 'not', cat: 'holding', value: 'nothing' })).toEqual([0, 1, 3, 4]);
  });
  it('one of', () => {
    expect(who({ kind: 'oneOf', cat: 'coat', values: ['blue', 'yellow'] })).toEqual([3, 4]);
    expect(who({ kind: 'oneOf', cat: 'holding', values: ['umbrella', 'nothing'] })).toEqual([1, 2]);
  });
  it('count (one of the N people …) requires the exact count', () => {
    expect(who({ kind: 'count', cat: 'coat', value: 'red', count: 2 })).toEqual([0, 2]);
    expect(who({ kind: 'count', cat: 'coat', value: 'red', count: 3 })).toEqual([]);
  });
  it('next to (directly adjacent, never yourself)', () => {
    expect(who({ kind: 'nextTo', cat: 'holding', value: 'book' })).toEqual([1, 2, 4]);
    expect(who({ kind: 'nextTo', cat: 'hat', value: 'bobble' })).toEqual([3]);
    // Ada holds a book herself but is not next to another book-holder
    expect(holds({ kind: 'nextTo', cat: 'holding', value: 'book' }, L, 0)).toBe(false);
  });
  it('not next to', () => {
    expect(who({ kind: 'notNextTo', cat: 'hat', value: 'cap' })).toEqual([0, 3]);
    expect(who({ kind: 'notNextTo', cat: 'coat', value: 'red' })).toEqual([0, 2, 4]);
  });
  it('left of / right of a unique person', () => {
    expect(who({ kind: 'leftOf', cat: 'hat', value: 'beret' })).toEqual([0]);
    expect(who({ kind: 'rightOf', cat: 'hat', value: 'beret' })).toEqual([2, 3, 4]);
    expect(who({ kind: 'leftOf', cat: 'holding', value: 'basket' })).toEqual([0, 1, 2, 3]);
    // ambiguous reference (two caps) is never true
    expect(who({ kind: 'leftOf', cat: 'hat', value: 'cap' })).toEqual([]);
    expect(who({ kind: 'rightOf', cat: 'hat', value: 'cap' })).toEqual([]);
  });
  it('end / not end', () => {
    expect(who({ kind: 'end' })).toEqual([0, 4]);
    expect(who({ kind: 'notEnd' })).toEqual([1, 2, 3]);
  });
  it('candidates, elimination and minimality', () => {
    const clues: Clue[] = [
      { kind: 'not', cat: 'coat', value: 'red' },
      { kind: 'notEnd' },
      { kind: 'notNextTo', cat: 'hat', value: 'none' },
    ];
    expect(candidates(clues.slice(0, 2), L)).toEqual([1, 3]);
    expect(candidates(clues, L)).toEqual([]); // Bram & Dev are both next to Cleo
    const good: Clue[] = [{ kind: 'not', cat: 'coat', value: 'red' }, { kind: 'notEnd' }, { kind: 'is', cat: 'hat', value: 'cap' }];
    expect(candidates(good, L)).toEqual([3]);
    expect(eliminatedBy(good[1], L)).toEqual([0, 4]);
    expect(isMinimal(good, L)).toBe(false); // "cap" + "not end" already suffice
    expect(isMinimal(good.slice(1), L)).toBe(true);
  });
  it('trueClues only returns clues that hold for the suspect', () => {
    for (let c = 0; c < L.length; c++) for (const cl of trueClues(L, c)) expect(holds(cl, L, c)).toBe(true);
  });
});

describe('clue wording', () => {
  const all: Clue[] = [
    { kind: 'is', cat: 'hat', value: 'beret' },
    { kind: 'is', cat: 'holding', value: 'nothing' },
    { kind: 'not', cat: 'hat', value: 'none' },
    { kind: 'oneOf', cat: 'coat', values: ['red', 'blue'] },
    { kind: 'count', cat: 'coat', value: 'red', count: 2 },
    { kind: 'nextTo', cat: 'holding', value: 'book' },
    { kind: 'notNextTo', cat: 'hat', value: 'cap' },
    { kind: 'leftOf', cat: 'hat', value: 'beret' },
    { kind: 'rightOf', cat: 'holding', value: 'umbrella' },
    { kind: 'end' },
    { kind: 'notEnd' },
  ];
  it('reads as plain English sentences', () => {
    expect(clueText(all[4])).toBe('The culprit is one of the two people in red coats.');
    expect(clueText(all[5])).toBe('The culprit stood directly next to someone holding a book.');
    expect(clueText(all[6])).toBe('The culprit was not standing next to anyone wearing a cap.');
    expect(clueText(all[7])).toBe('The culprit stood somewhere to the left of the person in the beret.');
    expect(clueText(all[9])).toBe('The culprit stood at one end of the row.');
    for (const c of all) {
      const t = clueText(c);
      expect(t).toMatch(/^The culprit(’s)? .+\.$/);
      expect(t).not.toMatch(/undefined|\d/);
    }
  });
});

describe('content', () => {
  it('has enough scenarios and names', () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(24);
    expect(new Set(SCENARIOS.map((s) => s.title)).size).toBe(SCENARIOS.length);
    expect(new Set(NAMES).size).toBe(NAMES.length);
    for (const n of NAMES) expect(n.length).toBeLessThanOrEqual(6);
  });
  it('rotates scenarios without back-to-back repeats inside a cycle', () => {
    for (let i = 0; i < 24 * 4; i += 24) {
      const titles = Array.from({ length: 24 }, (_, k) => scenarioFor(addDays(LAUNCH_DATE, i + k)).title);
      expect(new Set(titles).size).toBe(24);
    }
  });
});

describe('daily generation', () => {
  const dates = Array.from({ length: 400 }, (_, i) => addDays(LAUNCH_DATE, i));
  const puzzles = dates.map((d) => mod.getPuzzle(d));

  it('every puzzle for 400 days has a unique culprit with a minimal 3–5 clue set', () => {
    for (const p of puzzles) {
      expect(p.suspects.length === 5 || p.suspects.length === 6).toBe(true);
      expect(p.clues.length).toBeGreaterThanOrEqual(MIN_CLUES);
      expect(p.clues.length).toBeLessThanOrEqual(MAX_CLUES);
      // uniqueness: evaluate every clue against every suspect
      expect(candidates(p.clues, p.suspects)).toEqual([p.culprit]);
      // minimality: removing any clue leaves >1 candidate
      for (let k = 0; k < p.clues.length; k++) {
        expect(candidates(p.clues.filter((_, j) => j !== k), p.suspects).length).toBeGreaterThan(1);
      }
      expect(isValidPuzzle(p)).toBe(true);
      // no single clue gives the game away, and the lineup matters
      for (const c of p.clues) expect(eliminatedBy(c, p.suspects).length).toBeLessThan(p.suspects.length - 1);
      expect(p.clues.some((c) => POSITIONAL_KINDS.includes(c.kind))).toBe(true);
      // names are distinct, no two suspects look identical
      expect(new Set(p.suspects.map((s) => s.name)).size).toBe(p.suspects.length);
      expect(new Set(p.suspects.map((s) => `${s.hat}${s.coat}${s.holding}`)).size).toBe(p.suspects.length);
      // clues never name anyone or a position number
      for (const c of p.clues) {
        const t = clueText(c);
        for (const s of p.suspects) expect(t).not.toContain(s.name);
        expect(t).not.toMatch(/\d/);
      }
    }
  });

  it('has a spread of clue counts and lineup sizes', () => {
    const counts = new Set(puzzles.map((p) => p.clues.length));
    expect(counts).toEqual(new Set([3, 4, 5]));
    expect(new Set(puzzles.map((p) => p.suspects.length))).toEqual(new Set([5, 6]));
    const culpritSpots = new Set(puzzles.map((p) => p.culprit));
    expect(culpritSpots.size).toBe(6);
  });

  it('buildClues returns minimal sets when it succeeds', () => {
    const rng = createRng('deduction-test');
    let ok = 0;
    for (let t = 0; t < 100; t++) {
      const clues = buildClues(rng, L, t % L.length);
      if (!clues) continue;
      ok++;
      expect(candidates(clues, L)).toEqual([t % L.length]);
      expect(isMinimal(clues, L)).toBe(true);
    }
    expect(ok).toBeGreaterThan(0);
  });

  it('is deterministic', () => {
    expect(mod.getPuzzle('2026-10-14')).toEqual(mod.getPuzzle('2026-10-14'));
    expect(generatePuzzle('2027-06-30')).toEqual(generatePuzzle('2027-06-30'));
  });

  it('pins published puzzles', () => {
    const a = mod.getPuzzle(LAUNCH_DATE);
    expect({ title: a.scenario.title, names: a.suspects.map((s) => s.name), culprit: a.culprit, kinds: a.clues.map((c) => c.kind) }).toEqual(PIN_LAUNCH);
    const b = mod.getPuzzle('2026-10-14');
    expect({ title: b.scenario.title, names: b.suspects.map((s) => s.name), culprit: b.culprit, kinds: b.clues.map((c) => c.kind) }).toEqual(PIN_1014);
  });
});

const PIN_LAUNCH = {
  title: 'The last lemon tart',
  names: ['Kemi', 'Femi', 'Tomas', 'Greta', 'Ada', 'Nico'],
  culprit: 0,
  kinds: ['notNextTo', 'notNextTo', 'leftOf', 'oneOf'],
};
const PIN_1014 = {
  title: 'The extra raffle ticket',
  names: ['Kofi', 'Ulla', 'Wanda', 'Aroha', 'Wen', 'Mateo'],
  culprit: 4,
  kinds: ['notNextTo', 'notEnd', 'oneOf', 'rightOf'],
};

describe('play', () => {
  const p = mod.getPuzzle('2026-10-14');
  const wrongs = p.suspects.map((_, i) => i).filter((i) => i !== p.culprit);
  const fresh: State = { ruledOut: [], accusations: [] };

  it('toggles crossed-off notes freely', () => {
    let s = toggleRuledOut(p, fresh, 2);
    expect(s.ruledOut).toEqual([2]);
    s = toggleRuledOut(p, s, 0);
    expect(s.ruledOut).toEqual([0, 2]);
    s = toggleRuledOut(p, s, 2);
    expect(s.ruledOut).toEqual([0]);
    expect(s.accusations).toEqual([]);
    expect(toggleRuledOut(p, s, 99)).toBe(s);
  });

  it('wrong accusation feedback names a clue that really excludes that suspect', () => {
    for (const pz of [p, ...Array.from({ length: 60 }, (_, i) => mod.getPuzzle(addDays(LAUNCH_DATE, i)))]) {
      for (let i = 0; i < pz.suspects.length; i++) {
        if (i === pz.culprit) {
          expect(refutingClue(pz, i)).toBe(-1);
          continue;
        }
        const r = accuse(pz, fresh, i)!;
        expect(r.correct).toBe(false);
        if (r.correct) continue;
        expect(r.clue).toBeGreaterThanOrEqual(0);
        expect(holds(pz.clues[r.clue], pz.suspects, i)).toBe(false);
        expect(r.state.ruledOut).toContain(i);
      }
    }
  });

  it('wins on a correct accusation and scores by attempt', () => {
    const r1 = accuse(p, fresh, p.culprit)!;
    expect(r1.correct).toBe(true);
    expect(status(p, r1.state)).toBe('won');
    expect(scoreText(p, r1.state)).toBe('Solved on 1st accusation');
    expect(resultGrid(p, r1.state)).toBe('✅');

    const s2 = accuse(p, accuse(p, fresh, wrongs[0])!.state, wrongs[1])!.state;
    const r3 = accuse(p, s2, p.culprit)!;
    expect(scoreText(p, r3.state)).toBe('Solved on 3rd accusation');
    expect(resultGrid(p, r3.state)).toBe('🔍🔍✅');
  });

  it('loses after three wrong accusations and blocks further moves', () => {
    let s = fresh;
    for (let k = 0; k < MAX_ACCUSATIONS; k++) {
      expect(status(p, s)).toBe('playing');
      s = accuse(p, s, wrongs[k])!.state;
    }
    expect(status(p, s)).toBe('lost');
    expect(scoreText(p, s)).toBe('Case unsolved');
    expect(resultGrid(p, s)).toBe('🔍🔍🔍');
    expect(accuse(p, s, p.culprit)).toBeNull();
    expect(toggleRuledOut(p, s, p.culprit)).toBe(s);
  });

  it('cannot accuse the same person twice', () => {
    const s = accuse(p, fresh, wrongs[0])!.state;
    expect(accuse(p, s, wrongs[0])).toBeNull();
  });

  it('explains every clue and covers every innocent suspect', () => {
    const ex = explanation(p);
    expect(ex.length).toBe(p.clues.length);
    const cleared = new Set(ex.flatMap((e) => e.eliminated));
    expect(cleared.has(p.suspects[p.culprit].name)).toBe(false);
    expect(cleared.size).toBe(p.suspects.length - 1);
  });

  it('result text never names anyone', () => {
    const s = accuse(p, fresh, p.culprit)!.state;
    const text = `${scoreText(p, s)} ${resultGrid(p, s)}`;
    for (const x of p.suspects) expect(text).not.toContain(x.name);
  });
});

