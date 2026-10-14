import { createRng } from '../../../lib/rng';
import { addDays, LAUNCH_DATE } from '../../../lib/date';
import {
  answer,
  CLOCK_FITTERS,
  correctCount,
  currentIndex,
  describeTerm,
  digitSum,
  FITTERS,
  fittingFamilies,
  generatePuzzle,
  GENERATORS,
  initialState,
  isAmbiguous,
  isDone,
  isWin,
  predictions,
  resultFor,
  type Puzzle,
} from './logic';

const fit = (id: string, t: number[]) => (FITTERS.find((f) => f.id === id) ?? CLOCK_FITTERS.find((f) => f.id === id))!.predict(t);

describe('pattern fitters', () => {
  it('arithmetic', () => {
    expect(fit('arithmetic', [3, 7, 11, 15])).toEqual([19]);
    expect(fit('arithmetic', [20, 17, 14])).toEqual([11]);
    expect(fit('arithmetic', [1, 2, 4])).toEqual([]);
    expect(fit('arithmetic', [1, 2])).toEqual([]); // needs a confirming term
  });

  it('geometric, including fractional ratios', () => {
    expect(fit('geometric', [3, 6, 12, 24])).toEqual([48]);
    expect(fit('geometric', [16, 24, 36, 54])).toEqual([81]);
    expect(fit('geometric', [1, 2, 3])).toEqual([]);
    expect(fit('geometric', [0, 0, 0])).toEqual([]);
  });

  it('polynomials by differences (liberal: fit once determined)', () => {
    expect(fit('poly2', [1, 4, 9, 16])).toEqual([25]);
    expect(fit('poly2', [1, 2, 4])).toEqual([7]);
    expect(fit('poly2', [1, 2, 4, 8])).toEqual([]);
    expect(fit('poly3', [1, 8, 27, 64, 125])).toEqual([216]);
    expect(fit('poly3', [1, 2, 4, 8])).toEqual([15]);
    expect(fit('poly3', [2, 4, 8, 16, 32])).toEqual([]);
  });

  it('multiply-then-add', () => {
    expect(fit('mul-add', [1, 3, 7, 15, 31])).toEqual([63]); // ×2 +1
    expect(fit('mul-add', [2, 5, 14, 41])).toEqual([122]); // ×3 −1
    expect(fit('mul-add', [5, 5, 5, 5])).toEqual([5]);
    expect(fit('mul-add', [1, 4, 9, 16])).toEqual([]);
  });

  it('fibonacci-like', () => {
    expect(fit('fibonacci', [2, 3, 5, 8, 13])).toEqual([21]);
    expect(fit('fibonacci', [4, 4, 8, 12])).toEqual([20]);
    expect(fit('fibonacci', [1, 2, 4])).toEqual([]);
  });

  it('interleaved arithmetic', () => {
    expect(fit('interleaved', [1, 20, 4, 18, 7, 16])).toEqual([10]);
    expect(fit('interleaved', [1, 20, 4, 18, 7])).toEqual([16]);
    expect(fit('interleaved', [1, 20, 4, 18])).toEqual([]);
    expect(fit('interleaved', [1, 20, 5, 18, 7, 16])).toEqual([]);
  });

  it('alternating add / multiply, in either order', () => {
    expect(fit('alt-add-mul', [1, 2, 5, 10, 13, 26])).toEqual([29]); // ×2, +3
    expect(fit('alt-add-mul', [2, 5, 10, 13, 26])).toEqual([29]); // +3, ×2
    expect(fit('alt-add-mul', [1, 4, 9, 16])).toEqual([]);
  });

  it('digit sums', () => {
    expect(digitSum(407)).toBe(11);
    expect(fit('digit-sum', [12, 15, 21, 24, 30])).toEqual([33]);
    expect(fit('digit-sum', [12, 15, 20])).toEqual([]);
  });

  it('growing ratio', () => {
    expect(fit('growing-ratio', [1, 1, 2, 6, 24])).toEqual([120]);
    expect(fit('growing-ratio', [2, 4, 12, 48])).toEqual([240]);
    expect(fit('growing-ratio', [1, 2, 4, 8])).toEqual([16]); // constant ratio is a degenerate case
    expect(fit('growing-ratio', [1, 3, 4, 7])).toEqual([]);
  });

  it('clock hands, steady and speeding up (mod 360)', () => {
    expect(fit('clock-steady', [270, 0, 90, 180])).toEqual([270]);
    expect(fit('clock-steady', [0, 315, 270])).toEqual([225]);
    expect(fit('clock-speeding', [0, 45, 135, 270])).toEqual([90]);
    expect(fit('clock-speeding', [0, 0, 315, 225])).toEqual([90]);
    expect(fit('clock-speeding', [0, 45, 0, 45])).toEqual([]);
  });

  it('every generator family is recognised by its own fitter', () => {
    const rng = createRng('fitter-self-check');
    for (const [name, gen] of Object.entries(GENERATORS)) {
      let checked = 0;
      for (let k = 0; k < 400 && checked < 30; k++) {
        const d = gen(rng);
        if (!d) continue;
        checked++;
        const preds = predictions(d.terms, d.visual);
        expect(preds, `${name}: ${d.terms.join(',')}`).toContain(d.answer);
      }
      expect(checked, name).toBeGreaterThan(0);
    }
  });
});

describe('pattern ambiguity guard', () => {
  it('rejects classic ambiguous sequences', () => {
    expect(isAmbiguous([1, 2, 4])).toBe(true); // 7 (gaps +1,+2,+3) or 8 (doubling)
    expect(predictions([1, 2, 4]).sort((a, b) => a - b)).toEqual([7, 8]);
    expect(isAmbiguous([1, 2, 4, 8])).toBe(true); // 15 by cubic differences, 16 by doubling
    expect(isAmbiguous([2, 4, 6])).toBe(true); // 8 by steps of 2, but 2 + 4 = 6 reads as Fibonacci → 10
    expect(isAmbiguous([2, 4, 6, 8])).toBe(false); // everything that fits agrees on 10
    expect(isAmbiguous([1, 3, 4, 7])).toBe(true); // Fibonacci 11, cubic says something else
  });

  it('accepts unambiguous sequences', () => {
    expect(isAmbiguous([3, 6, 12, 24, 48])).toBe(false);
    expect(predictions([3, 6, 12, 24, 48])).toEqual([96]);
    expect(isAmbiguous([2, 3, 5, 8, 13, 21])).toBe(false);
    expect(fittingFamilies([2, 3, 5, 8, 13, 21])).toEqual(['fibonacci']);
  });

  it('flags sequences that no family explains', () => {
    expect(isAmbiguous([3, 1, 4, 1, 5, 9])).toBe(true);
  });

  it('judges clock sequences by angle rules only', () => {
    expect(isAmbiguous([0, 90, 180, 270, 0], 'clock')).toBe(false);
    expect(predictions([0, 90, 180, 270, 0], 'clock')).toEqual([90]);
  });
});

describe('pattern daily puzzles', () => {
  it('is deterministic', () => {
    expect(generatePuzzle('2026-10-14')).toEqual(generatePuzzle('2026-10-14'));
    expect(generatePuzzle(LAUNCH_DATE)).toEqual(generatePuzzle(LAUNCH_DATE));
    expect(generatePuzzle('2026-10-14')).not.toEqual(generatePuzzle('2026-10-13'));
  });

  it('is pinned for launch day and 2026-10-14', () => {
    const pin = (d: string) => generatePuzzle(d).sequences.map((s) => `${s.family}: ${s.terms.join(',')} -> ${s.answer} [${s.choices.join(',')}]`);
    expect(pin(LAUNCH_DATE)).toEqual(PINNED_LAUNCH);
    expect(pin('2026-10-14')).toEqual(PINNED_1014);
  });

  it('publishes 400 days of valid, unambiguous sequences', () => {
    const families = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const p = generatePuzzle(addDays(LAUNCH_DATE, i));
      expect(p.sequences.map((s) => s.level)).toEqual(['Easy', 'Medium', 'Hard']);
      expect(p.sequences.filter((s) => s.visual).length).toBe(1);
      expect(p.sequences[2].visual).toBeUndefined();
      expect(new Set(p.sequences.map((s) => s.family)).size).toBe(3);
      for (const s of p.sequences) {
        families.add(s.family);
        expect(s.terms.length).toBeGreaterThanOrEqual(4);
        expect(s.terms.length).toBeLessThanOrEqual(6);
        expect(s.choices).toHaveLength(4);
        expect(new Set(s.choices).size).toBe(4);
        expect(s.choices.filter((c) => c === s.answer)).toHaveLength(1);
        expect(s.choices.every((c) => Number.isInteger(c))).toBe(true);
        // Every family that fits predicts the answer, and nothing else.
        expect(predictions(s.terms, s.visual)).toEqual([s.answer]);
        // No distractor is predicted by any fitter.
        const allFitters = s.visual === 'clock' ? CLOCK_FITTERS : FITTERS;
        for (const c of s.choices) {
          if (c === s.answer) continue;
          for (const f of allFitters) expect(f.predict(s.terms)).not.toContain(c);
        }
        if (s.visual === 'clock') expect([...s.terms, ...s.choices].every((v) => v >= 0 && v < 360 && v % 45 === 0)).toBe(true);
        if (s.visual === 'dots') expect([...s.terms, ...s.choices].every((v) => v >= 1 && v <= 20)).toBe(true);
        if (!s.visual) expect([...s.terms, ...s.choices].every((v) => v >= 0)).toBe(true);
        expect(s.explanation.length).toBeGreaterThan(10);
      }
    }
    expect(families.size).toBeGreaterThanOrEqual(14);
  });
});

describe('pattern play state', () => {
  const puzzle: Puzzle = generatePuzzle('2026-10-14');
  const right = (i: number) => puzzle.sequences[i].choices.indexOf(puzzle.sequences[i].answer);
  const wrong = (i: number) => puzzle.sequences[i].choices.findIndex((c) => c !== puzzle.sequences[i].answer);

  it('allows one answer per sequence, in order', () => {
    let s = initialState(3);
    expect(currentIndex(s)).toBe(0);
    s = answer(s, puzzle, right(0));
    expect(currentIndex(s)).toBe(1);
    expect(answer(s, puzzle, 9)).toBe(s);
    s = answer(s, puzzle, wrong(1));
    s = answer(s, puzzle, right(2));
    expect(isDone(s)).toBe(true);
    expect(answer(s, puzzle, 0)).toBe(s);
    expect(correctCount(s, puzzle)).toBe(2);
    expect(resultFor(s, puzzle)).toEqual({ score: '2/3', grid: ['🟩🟥🟩'] });
    expect(isWin(s, puzzle)).toBe(true);
    expect(isWin({ picks: [wrong(0), wrong(1), right(2)] }, puzzle)).toBe(false);
  });

  it('describes visual terms for screen readers', () => {
    expect(describeTerm(90, 'clock')).toBe('hand pointing right');
    expect(describeTerm(1, 'dots')).toBe('1 dot');
    expect(describeTerm(7)).toBe('7');
  });
});

const PINNED_LAUNCH = [
  'dots-steady: 4,7,10,13,16 -> 19 [20,18,19,16]',
  'interleaved: 13,13,18,17,23,21 -> 28 [28,19,27,25]',
  'quadratic: 47,39,34,32,33 -> 37 [40,37,38,34]',
];
const PINNED_1014 = [
  'arithmetic: 63,57,51,45,39 -> 33 [32,33,27,34]',
  'dots-growing: 1,2,4,7,11 -> 16 [16,15,18,17]',
  'mul-add: 4,13,40,121,364 -> 1093 [1093,1091,1094,1092]',
];
