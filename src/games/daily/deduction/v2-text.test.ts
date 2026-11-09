/**
 * An independent check of the v2 (lookout) editions, written from the player's
 * side: it reads only the clue TEXT a player sees and the lineup, evaluates it
 * with its own rules (it does not call holdsV2 or the generator's clue objects),
 * and brute-forces every (culprit, lookout) pair. If the wording and the logic
 * ever drift apart, or an edition stops having exactly one answer, this fails.
 */
import { describe, expect, it } from 'vitest';
import { addDays, type EditionDate } from '../../../lib/date';
import { clueText, generatePuzzle, isV2, refutingClues, V2_FROM, type PuzzleV2, type Suspect } from './logic';
import { culpritsV2 } from './v2';

type Check = (row: readonly Suspect[], c: number, l: number) => boolean;
type Field = 'hat' | 'coat' | 'holding';

const HAT: Record<string, string> = { 'no hat': 'none', 'a cap': 'cap', 'a beret': 'beret', 'a bobble hat': 'bobble' };
const HATS: Record<string, string> = { caps: 'cap', berets: 'beret', 'bobble hats': 'bobble' };
const HOLD: Record<string, string> = { 'an umbrella': 'umbrella', 'a book': 'book', 'a basket': 'basket', 'nothing at all': 'nothing' };
const NUM: Record<string, number> = { Nobody: 0, 'Exactly one person': 1, 'Exactly two people': 2, 'Exactly three people': 3 };

/** "wearing a cap", "without a hat", "in a red coat", "holding a book", "with empty hands" */
function withPhrase(p: string): [Field, string] {
  if (p === 'without a hat') return ['hat', 'none'];
  if (p === 'with empty hands') return ['holding', 'nothing'];
  let m = /^wearing (.+)$/.exec(p);
  if (m && HAT[m[1]]) return ['hat', HAT[m[1]]];
  m = /^in a (\w+) coat$/.exec(p);
  if (m) return ['coat', m[1]];
  m = /^holding (.+)$/.exec(p);
  if (m && HOLD[m[1]]) return ['holding', HOLD[m[1]]];
  throw new Error(`unparsed phrase: ${p}`);
}

/** What the people counted in a "to the left of …" clue did. */
function countedPhrase(p: string): [Field, string] {
  if (p === 'had no hat') return ['hat', 'none'];
  if (p === 'had empty hands') return ['holding', 'nothing'];
  let m = /^wore (a cap|a beret|a bobble hat)$/.exec(p);
  if (m) return ['hat', HAT[m[1]]];
  m = /^wore (caps|berets|bobble hats)$/.exec(p);
  if (m) return ['hat', HATS[m[1]]];
  m = /^wore (?:a )?(\w+) coats?$/.exec(p);
  if (m) return ['coat', m[1]];
  m = /^held (an umbrella|a book|a basket)$/.exec(p);
  if (m) return ['holding', HOLD[m[1]]];
  m = /^held (umbrella|book|basket)s$/.exec(p);
  if (m) return ['holding', m[1]];
  throw new Error(`unparsed phrase: ${p}`);
}

const pick = (role: string) => (c: number, l: number) => (role === 'culprit' ? c : l);

/** Turn one clue sentence into a check, from its words alone. */
export function readClue(text: string): Check {
  const t = text.replace(/’/g, "'").replace(/\.$/, '');
  const fixed: Record<string, Check> = {
    'The culprit stood directly next to the lookout': (_, c, l) => Math.abs(c - l) === 1,
    'Exactly one person stood between the culprit and the lookout': (_, c, l) => Math.abs(c - l) === 2,
    'The culprit stood somewhere to the left of the lookout': (_, c, l) => c < l,
    'The lookout stood somewhere to the left of the culprit': (_, c, l) => l < c,
    'The culprit and the lookout wore coats of the same colour': (r, c, l) => r[c].coat === r[l].coat,
    'The culprit and the lookout wore the same kind of hat': (r, c, l) => r[c].hat === r[l].hat && r[c].hat !== 'none',
    'The culprit and the lookout were holding the same kind of thing': (r, c, l) => r[c].holding === r[l].holding && r[c].holding !== 'nothing',
  };
  if (fixed[t]) return fixed[t];
  const R = '(culprit|lookout)';
  const rules: [RegExp, (m: RegExpExecArray) => Check][] = [
    [new RegExp(`^The ${R} wore (no hat|a cap|a beret|a bobble hat)$`), (m) => (r, c, l) => r[pick(m[1])(c, l)].hat === HAT[m[2]]],
    [new RegExp(`^The ${R} wore a (\\w+) coat$`), (m) => (r, c, l) => r[pick(m[1])(c, l)].coat === m[2]],
    [new RegExp(`^The ${R}'s hands were empty$`), (m) => (r, c, l) => r[pick(m[1])(c, l)].holding === 'nothing'],
    [new RegExp(`^The ${R} was holding (an umbrella|a book|a basket)$`), (m) => (r, c, l) => r[pick(m[1])(c, l)].holding === HOLD[m[2]]],
    [new RegExp(`^The ${R} was wearing a hat of some kind$`), (m) => (r, c, l) => r[pick(m[1])(c, l)].hat !== 'none'],
    [new RegExp(`^The ${R} was not wearing (a cap|a beret|a bobble hat)$`), (m) => (r, c, l) => r[pick(m[1])(c, l)].hat !== HAT[m[2]]],
    [new RegExp(`^The ${R}'s coat was not (\\w+)$`), (m) => (r, c, l) => r[pick(m[1])(c, l)].coat !== m[2]],
    [new RegExp(`^The ${R} was holding something$`), (m) => (r, c, l) => r[pick(m[1])(c, l)].holding !== 'nothing'],
    [new RegExp(`^The ${R} was not holding (an umbrella|a book|a basket)$`), (m) => (r, c, l) => r[pick(m[1])(c, l)].holding !== HOLD[m[2]]],
    [
      new RegExp(`^The ${R} wore either (no hat|a cap|a beret|a bobble hat) or (no hat|a cap|a beret|a bobble hat)$`),
      (m) => (r, c, l) => [HAT[m[2]], HAT[m[3]]].includes(r[pick(m[1])(c, l)].hat),
    ],
    [new RegExp(`^The ${R}'s coat was either (\\w+) or (\\w+)$`), (m) => (r, c, l) => [m[2], m[3]].includes(r[pick(m[1])(c, l)].coat)],
    [
      new RegExp(`^The ${R} was holding either (an umbrella|a book|a basket|nothing at all) or (an umbrella|a book|a basket|nothing at all)$`),
      (m) => (r, c, l) => [HOLD[m[2]], HOLD[m[3]]].includes(r[pick(m[1])(c, l)].holding),
    ],
    [new RegExp(`^The ${R} stood at one end of the row$`), (m) => (r, c, l) => [0, r.length - 1].includes(pick(m[1])(c, l))],
    [new RegExp(`^The ${R} did not stand at either end of the row$`), (m) => (r, c, l) => ![0, r.length - 1].includes(pick(m[1])(c, l))],
    [
      new RegExp(`^The ${R} stood directly next to someone (.+)$`),
      (m) => {
        const [f, v] = withPhrase(m[2]);
        return (r, c, l) => {
          const i = pick(m[1])(c, l);
          return [i - 1, i + 1].some((j) => j >= 0 && j < r.length && r[j][f] === v);
        };
      },
    ],
    [
      new RegExp(`^(Nobody|Exactly one person|Exactly two people|Exactly three people) to the (left|right) of the ${R} (.+)$`),
      (m) => {
        const [f, v] = countedPhrase(m[4]);
        return (r, c, l) => {
          const i = pick(m[3])(c, l);
          const side = m[2] === 'left' ? r.slice(0, i) : r.slice(i + 1);
          return side.filter((s) => s[f] === v).length === NUM[m[1]];
        };
      },
    ],
  ];
  for (const [re, make] of rules) {
    const m = re.exec(t);
    if (m) return make(m);
  }
  throw new Error(`unparsed clue: ${text}`);
}

function answersFromText(p: PuzzleV2): [number, number][] {
  const checks = p.clues.map((c) => readClue(clueText(c)));
  const out: [number, number][] = [];
  for (let c = 0; c < p.suspects.length; c++) {
    for (let l = 0; l < p.suspects.length; l++) if (c !== l && checks.every((f) => f(p.suspects, c, l))) out.push([c, l]);
  }
  return out;
}

describe('Deduction v2 editions, read from the clue text', () => {
  const year: PuzzleV2[] = Array.from({ length: 365 }, (_, k) => {
    const p = generatePuzzle(addDays(V2_FROM as EditionDate, k));
    if (!isV2(p)) throw new Error('expected v2');
    return p;
  });

  it('every edition for a year has exactly one culprit and lookout, from the words alone', () => {
    for (const p of year) expect([p.date, answersFromText(p)]).toEqual([p.date, [[p.culprit, p.lookout]]]);
  });

  it('never says "the culprit’s left": left and right are always the player’s', () => {
    for (const p of year) for (const c of p.clues) expect(clueText(c)).not.toMatch(/(culprit|lookout)’s (left|right)/);
  });

  it('never gives two attribute clues about the same person and category', () => {
    for (const p of year) {
      const keys = p.clues.filter((c) => ['is', 'not', 'oneOf'].includes(c.kind)).map((c) => ('who' in c && 'cat' in c ? `${c.who}:${c.cat}` : ''));
      expect([p.date, new Set(keys).size]).toEqual([p.date, keys.length]);
    }
  });

  it('a wrong accusation names clues that, read together, really clear that person, and no fewer would', () => {
    for (const p of year.slice(0, 120)) {
      for (let i = 0; i < p.suspects.length; i++) {
        const ks = refutingClues(p, i);
        if (i === p.culprit) {
          expect(ks).toEqual([]);
          continue;
        }
        expect(ks.length).toBeGreaterThan(0);
        expect(culpritsV2(ks.map((k) => p.clues[k]), p.suspects)).not.toContain(i);
        for (const drop of ks) {
          const fewer = ks.filter((k) => k !== drop).map((k) => p.clues[k]);
          expect(culpritsV2(fewer, p.suspects)).toContain(i);
        }
      }
    }
  });
});
