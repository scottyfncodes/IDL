import { addDays, LAUNCH_DATE } from '../../../lib/date';
import { hashString } from '../../../lib/rng';
import { clueText, generatePuzzle, V2_FROM } from './logic';
import mod from './index';

/**
 * Published v1 editions, captured from the generator before v2 existed.
 * If any of these change, past puzzles (and players' saved progress for
 * them) have changed: fix the code, never the pins.
 */
const PINNED: Record<string, { culprit: number; suspects: string[]; clues: string[] }> = {
  "2026-09-01": {
    "culprit": 0,
    "suspects": [
      "Kemi none red basket",
      "Femi bobble green basket",
      "Tomas cap red book",
      "Greta beret blue umbrella",
      "Ada cap yellow basket",
      "Nico cap red umbrella"
    ],
    "clues": [
      "The culprit was not standing next to anyone wearing a beret.",
      "The culprit was not standing next to anyone without a hat.",
      "The culprit stood somewhere to the left of the person in the yellow coat.",
      "The culprit’s coat was either red or green."
    ]
  },
  "2026-10-14": {
    "culprit": 4,
    "suspects": [
      "Kofi cap blue umbrella",
      "Ulla cap red umbrella",
      "Wanda bobble green nothing",
      "Aroha cap green book",
      "Wen bobble yellow nothing",
      "Mateo beret blue umbrella"
    ],
    "clues": [
      "The culprit was not standing next to anyone in a red coat.",
      "The culprit did not stand at either end of the row.",
      "The culprit was holding either an umbrella or nothing at all.",
      "The culprit stood somewhere to the right of the person in the red coat."
    ]
  },
  "2026-11-09": {
    "culprit": 5,
    "suspects": [
      "Chidi none red basket",
      "Nico none red book",
      "Teo bobble green nothing",
      "Quinn none blue book",
      "Jonah none yellow umbrella",
      "Mina cap green basket"
    ],
    "clues": [
      "The culprit’s coat was not red.",
      "The culprit was not standing next to anyone wearing a cap.",
      "The culprit wore either no hat or a cap.",
      "The culprit’s coat was not blue."
    ]
  },
  "2026-11-11": {
    "culprit": 3,
    "suspects": [
      "Jonah bobble green basket",
      "Teo none blue book",
      "Aroha cap green nothing",
      "Priya none yellow book",
      "Pilar bobble yellow nothing",
      "Lars none red umbrella"
    ],
    "clues": [
      "The culprit’s coat was not blue.",
      "The culprit wore either no hat or a bobble hat.",
      "The culprit stood somewhere to the left of the person in the red coat.",
      "The culprit was not holding a basket.",
      "The culprit was not standing next to anyone holding an umbrella."
    ]
  }
};

describe('v1 editions are frozen', () => {
  it('the cutoff is 12 November 2026', () => {
    expect(V2_FROM).toBe('2026-11-12');
    expect(generatePuzzle('2026-11-11').version).toBeUndefined();
    expect(generatePuzzle('2026-11-12').version).toBe(2);
  });

  it('pins culprit, lineup and clue text for sample v1 dates', () => {
    for (const [date, pin] of Object.entries(PINNED)) {
      const p = mod.getPuzzle(date);
      expect({
        culprit: p.culprit,
        suspects: p.suspects.map((s) => `${s.name} ${s.hat} ${s.coat} ${s.holding}`),
        clues: p.clues.map(clueText),
      }).toEqual(pin);
    }
  });

  it('every v1 edition is byte-for-byte what it was', () => {
    const all: unknown[] = [];
    for (let d = LAUNCH_DATE; d < V2_FROM; d = addDays(d, 1)) all.push(mod.getPuzzle(d));
    expect(all.length).toBe(72);
    expect(hashString(JSON.stringify(all))).toBe(2584010606);
  });
});
