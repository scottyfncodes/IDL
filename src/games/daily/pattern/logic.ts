/**
 * Pattern — sequence generation, rule-family fitters, ambiguity guard and
 * scoring. Pure; no React.
 *
 * Each day has three sequences (Easy, Medium, Hard). One of the first two is
 * drawn as pictures (a turning clock hand or a group of dots).
 *
 * Ambiguity guard: a set of rule-family FITTERS each looks at the shown terms
 * and, if its family is consistent with all of them, predicts the next term.
 * A sequence is published only if every fitting family predicts the same next
 * term (the answer). Low-degree polynomial fitters are deliberately liberal —
 * they fit as soon as they are determined — because "look at the gaps" is the
 * first alternative reading most people try. Other families need at least one
 * shown term beyond what determines them.
 */
import { createRng, type Rng } from '../../../lib/rng';
import type { EditionDate } from '../../../lib/date';

export type Visual = 'clock' | 'dots';
export type Level = 'Easy' | 'Medium' | 'Hard';

export type FamilyId =
  | 'arithmetic'
  | 'geometric'
  | 'squares'
  | 'cubes'
  | 'quadratic'
  | 'interleaved'
  | 'fibonacci'
  | 'alt-add-mul'
  | 'digit-sum'
  | 'mul-add'
  | 'growing-ratio'
  | 'clock-steady'
  | 'clock-speeding'
  | 'dots-steady'
  | 'dots-growing';

export interface Sequence {
  level: Level;
  family: FamilyId;
  /** Numbers, dot counts, or clock-hand angles in degrees (0 = up, clockwise). */
  terms: number[];
  answer: number;
  /** Four distinct options, the answer exactly once. */
  choices: number[];
  explanation: string;
  visual?: Visual;
}

export interface Puzzle {
  date: EditionDate;
  sequences: Sequence[];
}

/* ------------------------------------------------------------------ */
/* Fitters                                                             */
/* ------------------------------------------------------------------ */

export interface Fitter {
  id: string;
  /** Returns every next value this family predicts given the shown terms ([] = does not fit). */
  predict: (t: readonly number[]) => number[];
}

const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
const allEqual = (xs: readonly number[]) => xs.every((x) => x === xs[0]);
const diffs = (t: readonly number[]) => t.slice(1).map((x, i) => x - t[i]);
export const digitSum = (n: number) => String(Math.abs(n)).split('').reduce((s, c) => s + Number(c), 0);
const mod360 = (a: number) => ((a % 360) + 360) % 360;

/** Polynomial of degree `deg` through the terms via finite differences. Liberal: fits once determined. */
function polyPredict(t: readonly number[], deg: number): number[] {
  if (t.length < deg + 1) return [];
  const table: number[][] = [t.slice()];
  for (let k = 1; k <= deg; k++) table.push(diffs(table[k - 1]));
  if (!allEqual(table[deg])) return [];
  let next = 0;
  for (let k = 0; k <= deg; k++) next += table[k][table[k].length - 1];
  return [next];
}

export const FITTERS: Fitter[] = [
  {
    id: 'arithmetic',
    predict: (t) => (t.length >= 3 && allEqual(diffs(t)) ? [t[t.length - 1] + t[1] - t[0]] : []),
  },
  {
    id: 'geometric',
    predict: (t) => {
      if (t.length < 3 || t.some((x) => x === 0)) return [];
      // ratio p/q in lowest terms
      const g = gcd(t[1], t[0]);
      let p = t[1] / g;
      let q = t[0] / g;
      if (q < 0) {
        p = -p;
        q = -q;
      }
      for (let i = 1; i < t.length; i++) if (t[i] * q !== t[i - 1] * p) return [];
      return [(t[t.length - 1] * p) / q];
    },
  },
  { id: 'poly2', predict: (t) => polyPredict(t, 2) },
  { id: 'poly3', predict: (t) => polyPredict(t, 3) },
  {
    // a(n+1) = m·a(n) + c, m rational.
    id: 'mul-add',
    predict: (t) => {
      if (t.length < 4) return [];
      const d0 = t[1] - t[0];
      if (d0 === 0) return allEqual(t) ? [t[0]] : [];
      const g = gcd(t[2] - t[1], d0);
      let p = (t[2] - t[1]) / g;
      let q = d0 / g;
      if (q < 0) {
        p = -p;
        q = -q;
      }
      const cq = t[1] * q - p * t[0]; // c·q
      for (let i = 1; i < t.length; i++) if (t[i] * q !== p * t[i - 1] + cq) return [];
      return [(p * t[t.length - 1] + cq) / q];
    },
  },
  {
    id: 'fibonacci',
    predict: (t) => {
      if (t.length < 3) return [];
      for (let i = 2; i < t.length; i++) if (t[i] !== t[i - 1] + t[i - 2]) return [];
      return [t[t.length - 1] + t[t.length - 2]];
    },
  },
  {
    // Two arithmetic sequences taking turns.
    id: 'interleaved',
    predict: (t) => {
      if (t.length < 5) return [];
      const ev = t.filter((_, i) => i % 2 === 0);
      const od = t.filter((_, i) => i % 2 === 1);
      if (!allEqual(diffs(ev)) || !allEqual(diffs(od))) return [];
      const sub = t.length % 2 === 0 ? ev : od;
      return [sub[sub.length - 1] + sub[1] - sub[0]];
    },
  },
  {
    // Alternately add k and multiply by integer m (either order).
    id: 'alt-add-mul',
    predict: (t) => {
      if (t.length < 4) return [];
      const out: number[] = [];
      for (const phase of [0, 1]) {
        let k: number | null = null;
        let m: number | null = null;
        let ok = true;
        for (let i = 0; i + 1 < t.length && ok; i++) {
          if ((i + phase) % 2 === 0) {
            const kk = t[i + 1] - t[i];
            if (k === null) k = kk;
            else if (k !== kk) ok = false;
          } else {
            if (t[i] === 0 || t[i + 1] % t[i] !== 0) ok = false;
            else {
              const mm = t[i + 1] / t[i];
              if (m === null) m = mm;
              else if (m !== mm) ok = false;
            }
          }
        }
        if (!ok || k === null || m === null) continue;
        const i = t.length - 1;
        out.push((i + phase) % 2 === 0 ? t[i] + k : t[i] * m);
      }
      return out;
    },
  },
  {
    id: 'digit-sum',
    predict: (t) => {
      if (t.length < 3 || t.some((x) => x < 0 || !Number.isInteger(x))) return [];
      for (let i = 1; i < t.length; i++) if (t[i] !== t[i - 1] + digitSum(t[i - 1])) return [];
      return [t[t.length - 1] + digitSum(t[t.length - 1])];
    },
  },
  {
    // Ratios between terms form an arithmetic sequence (×1, ×2, ×3 …).
    id: 'growing-ratio',
    predict: (t) => {
      if (t.length < 4 || t.some((x) => x === 0)) return [];
      const r = t.slice(1).map((x, i) => x / t[i]);
      if (r.some((x) => !Number.isInteger(x))) return [];
      if (!allEqual(diffs(r))) return [];
      return [t[t.length - 1] * (r[r.length - 1] + r[1] - r[0])];
    },
  },
];

/** Fitters for clock-hand angles (mod 360). */
export const CLOCK_FITTERS: Fitter[] = [
  {
    id: 'clock-steady',
    predict: (t) => {
      if (t.length < 2) return [];
      const steps = t.slice(1).map((x, i) => mod360(x - t[i]));
      return allEqual(steps) ? [mod360(t[t.length - 1] + steps[0])] : [];
    },
  },
  {
    id: 'clock-speeding',
    predict: (t) => {
      if (t.length < 3) return [];
      const steps = t.slice(1).map((x, i) => mod360(x - t[i]));
      const acc = steps.slice(1).map((x, i) => mod360(x - steps[i]));
      return allEqual(acc) ? [mod360(t[t.length - 1] + steps[steps.length - 1] + acc[0])] : [];
    },
  },
];

const fittersFor = (visual?: Visual) => (visual === 'clock' ? CLOCK_FITTERS : FITTERS);

/** Every distinct next value predicted by any fitting family. */
export function predictions(terms: readonly number[], visual?: Visual): number[] {
  const out = new Set<number>();
  for (const f of fittersFor(visual)) for (const p of f.predict(terms)) out.add(p);
  return [...out];
}

/** Which fitter ids fit the terms (for tests / debugging). */
export function fittingFamilies(terms: readonly number[], visual?: Visual): string[] {
  return fittersFor(visual)
    .filter((f) => f.predict(terms).length > 0)
    .map((f) => f.id);
}

/** True when the families that fit disagree about what comes next (or none fit). */
export function isAmbiguous(terms: readonly number[], visual?: Visual): boolean {
  return predictions(terms, visual).length !== 1;
}

/* ------------------------------------------------------------------ */
/* Generators                                                          */
/* ------------------------------------------------------------------ */

interface Draft {
  family: FamilyId;
  terms: number[];
  answer: number;
  explanation: string;
  /** Plausible wrong answers (common slips), best first. */
  mistakes: number[];
  visual?: Visual;
}

type Gen = (rng: Rng) => Draft | null;

const seq = (n: number, f: (i: number) => number) => Array.from({ length: n + 1 }, (_, i) => f(i));
const split = (all: number[]) => ({ terms: all.slice(0, -1), answer: all[all.length - 1] });
const sup = (n: number) => String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]);
const signed = (k: number) => (k >= 0 ? `plus ${k}` : `minus ${-k}`);
const TIMES: Record<number, string> = { 2: 'doubles', 3: 'triples', 4: 'quadruples' };

const arithmetic: Gen = (rng) => {
  const down = rng.chance(0.3);
  const step = rng.int(3, 9) * (down ? -1 : 1);
  const start = down ? rng.int(50, 95) : rng.int(2, 25);
  const { terms, answer } = split(seq(5, (i) => start + step * i));
  if (answer < 0) return null;
  return {
    family: 'arithmetic',
    terms,
    answer,
    explanation: down ? `Subtract ${-step} each time.` : `Add ${step} each time.`,
    mistakes: [answer + step, answer + 1, answer - 1, answer + 2, answer - 2],
  };
};

const geometric: Gen = (rng) => {
  const r = rng.pick([2, 2, 3]);
  const start = rng.int(1, r === 2 ? 7 : 3);
  const { terms, answer } = split(seq(5, (i) => start * r ** i));
  const last = terms[terms.length - 1];
  return {
    family: 'geometric',
    terms,
    answer,
    explanation: `Each term ${TIMES[r]} the one before.`,
    mistakes: [last + (last - terms[terms.length - 2]), answer + r, answer - r, last * (r + 1), answer + last],
  };
};

const squares: Gen = (rng) => {
  const s = rng.int(1, 4);
  const k = rng.int(-1, 5);
  const { terms, answer } = split(seq(5, (i) => (s + i) ** 2 + k));
  const last = terms[terms.length - 1];
  const why = k === 0 ? 'The square numbers' : `Square numbers ${signed(k)}`;
  return {
    family: 'squares',
    terms,
    answer,
    explanation: `${why}: ${s}${sup(2)}${k ? (k > 0 ? `+${k}` : `−${-k}`) : ''}, ${s + 1}${sup(2)}${k ? (k > 0 ? `+${k}` : `−${-k}`) : ''}, and so on.`,
    mistakes: [last + (last - terms[terms.length - 2]), answer + 1, answer - 1, (s + 6) ** 2 + k, answer + 2],
  };
};

const cubes: Gen = (rng) => {
  const s = rng.int(1, 3);
  const k = rng.int(-2, 4);
  const { terms, answer } = split(seq(5, (i) => (s + i) ** 3 + k));
  const last = terms[terms.length - 1];
  const d = diffs(terms);
  return {
    family: 'cubes',
    terms,
    answer,
    explanation: `${k === 0 ? 'The cube numbers' : `Cube numbers ${signed(k)}`}: ${s}${sup(3)}, ${s + 1}${sup(3)}, ${s + 2}${sup(3)}…${k ? ` each ${signed(k)}` : ''}.`,
    mistakes: [last + d[d.length - 1], last + 2 * d[d.length - 1] - d[d.length - 2], answer + 1, answer - 1, (s + 5) ** 2 + k],
  };
};

const quadraticGen =
  (hard: boolean): Gen =>
  (rng) => {
    const dd = hard ? rng.int(2, 5) : rng.int(1, 3);
    const d0 = hard ? -rng.int(dd * 2 + 1, dd * 4 + 3) : rng.int(1, 6);
    const a0 = hard ? rng.int(40, 90) : rng.int(1, 15);
    const all = seq(5, (i) => a0 + d0 * i + (dd * i * (i - 1)) / 2);
    const { terms, answer } = split(all);
    if (all.some((x) => x < 0)) return null;
    const last = terms[terms.length - 1];
    const d = diffs(all);
    const gaps = d.slice(0, 3).map((x) => (x >= 0 ? `+${x}` : `−${-x}`));
    return {
      family: 'quadratic',
      terms,
      answer,
      explanation: `The gaps change by ${dd} each time: ${gaps.join(', ')}…`,
      mistakes: [last + d[d.length - 2], last + d[d.length - 1] + dd, answer + 1, answer - 1, answer + dd * 2],
    };
  };

const interleaved: Gen = (rng) => {
  const a = rng.int(1, 15);
  const da = rng.int(2, 6);
  const b = rng.int(10, 40);
  const db = rng.pick([-3, -2, 2, 3, 4, 5, 7, 8].filter((x) => x !== da));
  const all = seq(6, (i) => (i % 2 === 0 ? a + da * (i / 2) : b + db * ((i - 1) / 2)));
  if (all.some((x) => x < 0)) return null;
  const { terms, answer } = split(all);
  const last = terms[terms.length - 1];
  const d = (k: number) => (k >= 0 ? `adds ${k}` : `subtracts ${-k}`);
  return {
    family: 'interleaved',
    terms,
    answer,
    explanation: `Two sequences take turns: one starts at ${a} and ${d(da)}, the other starts at ${b} and ${d(db)}.`,
    mistakes: [last + db, answer + db - da, last + (last - terms[terms.length - 2]), answer + da, answer - 1],
  };
};

const fibonacci =
  (hard: boolean): Gen =>
  (rng) => {
    const a = hard ? rng.int(3, 12) : rng.int(1, 5);
    const b = hard ? rng.int(a + 1, a + 9) : rng.int(a, a + 4);
    const all = [a, b];
    while (all.length < 7) all.push(all[all.length - 1] + all[all.length - 2]);
    const { terms, answer } = split(hard ? all.slice(0, 6) : all);
    const last = terms[terms.length - 1];
    const prev = terms[terms.length - 2];
    return {
      family: 'fibonacci',
      terms,
      answer,
      explanation: 'Each term is the sum of the two before it.',
      mistakes: [last + (last - prev), last * 2, answer + 1, answer - 1, answer + prev],
    };
  };

const altAddMul =
  (hard: boolean): Gen =>
  (rng) => {
    const m = hard ? rng.pick([2, 3]) : 2;
    const k = rng.int(1, hard ? 9 : 5);
    const a0 = rng.int(1, 6);
    const mulFirst = rng.chance(0.5);
    const all = [a0];
    for (let i = 0; i < 6; i++) all.push((i % 2 === 0) === mulFirst ? all[i] * m : all[i] + k);
    if (all[all.length - 1] > 3000) return null;
    const { terms, answer } = split(all);
    const last = terms[terms.length - 1];
    const nextIsMul = (5 % 2 === 0) === mulFirst;
    const ops = mulFirst ? `${m === 2 ? 'double' : 'triple'}, then add ${k}` : `add ${k}, then ${m === 2 ? 'double' : 'triple'}`;
    return {
      family: 'alt-add-mul',
      terms,
      answer,
      explanation: `The steps alternate: ${ops}, and repeat.`,
      mistakes: [nextIsMul ? last + k : last * m, answer + k, nextIsMul ? answer + m : answer * m, answer - 1, answer + 1],
    };
  };

const digitSumGen: Gen = (rng) => {
  const a0 = rng.int(10, 70);
  const all = [a0];
  for (let i = 0; i < 5; i++) all.push(all[i] + digitSum(all[i]));
  const { terms, answer } = split(all);
  const last = terms[terms.length - 1];
  return {
    family: 'digit-sum',
    terms,
    answer,
    explanation: `Add the digits of each term to itself: ${terms[0]} + ${String(terms[0]).split('').join(' + ')} = ${terms[1]}.`,
    mistakes: [last + (last - terms[terms.length - 2]), answer + 1, answer - 1, last + digitSum(terms[terms.length - 2]), answer + 9],
  };
};

const mulAdd: Gen = (rng) => {
  const m = rng.pick([2, 2, 3]);
  const c = rng.pick([-3, -2, -1, 1, 2, 3, 4, 5]);
  const a0 = rng.int(m === 2 ? 2 : 1, m === 2 ? 9 : 5);
  const all = [a0];
  for (let i = 0; i < 5; i++) all.push(all[i] * m + c);
  if (all.some((x, i) => x <= 0 || (i > 0 && x <= all[i - 1])) || all[5] > 5000) return null;
  const { terms, answer } = split(all);
  const last = terms[terms.length - 1];
  const verb = TIMES[m];
  return {
    family: 'mul-add',
    terms,
    answer,
    explanation: `Each term ${verb}, then ${c > 0 ? `adds ${c}` : `subtracts ${-c}`}.`,
    mistakes: [last * m, last * m - c, last * m + c + 1, last * m + 2 * c, answer + m],
  };
};

const growingRatio: Gen = (rng) => {
  const a0 = rng.int(1, 4);
  const r0 = rng.int(1, 2);
  const all = [a0];
  for (let i = 0; i < 5; i++) all.push(all[i] * (r0 + i));
  if (all[5] > 6000) return null;
  const { terms, answer } = split(all);
  const last = terms[terms.length - 1];
  return {
    family: 'growing-ratio',
    terms,
    answer,
    explanation: `Multiply by ${r0}, then ${r0 + 1}, then ${r0 + 2}… one more each time.`,
    mistakes: [last * (r0 + 3), last * (r0 + 5), answer + last, answer - last / (r0 + 3), answer + 1].map(Math.round),
  };
};

/* Visual generators */

const clockSteady: Gen = (rng) => {
  const step = rng.pick([45, 90, 135, -45, -90, -135]);
  const start = rng.int(0, 7) * 45;
  const all = seq(5, (i) => mod360(start + step * i));
  const { terms, answer } = split(all);
  const last = terms[terms.length - 1];
  const turn = step > 0 ? 'clockwise' : 'anticlockwise';
  return {
    family: 'clock-steady',
    visual: 'clock',
    terms,
    answer,
    explanation: `The hand turns ${Math.abs(step)}° ${turn} each step.`,
    mistakes: [last, mod360(answer + 180), mod360(answer + 45), mod360(answer - 45), mod360(last - step)],
  };
};

const clockSpeeding: Gen = (rng) => {
  const d1 = rng.pick([0, 45]);
  const acc = 45;
  const dir = rng.pick([1, -1]);
  const start = rng.int(0, 7) * 45;
  const all = [start];
  for (let i = 0; i < 5; i++) all.push(mod360(all[i] + dir * (d1 + acc * i)));
  const { terms, answer } = split(all);
  const last = terms[terms.length - 1];
  const lastStep = d1 + acc * 3;
  const turn = dir > 0 ? 'clockwise' : 'anticlockwise';
  const firstSteps = [d1, d1 + acc, d1 + 2 * acc].map((x) => `${x}°`).join(', ');
  return {
    family: 'clock-speeding',
    visual: 'clock',
    terms,
    answer,
    explanation: `The hand turns ${turn}, 45° further each time: ${firstSteps}…`,
    mistakes: [mod360(last + dir * lastStep), mod360(answer + 45), mod360(answer - 45), mod360(answer + 180), last],
  };
};

const dotsSteady: Gen = (rng) => {
  const step = rng.int(2, 3);
  const start = rng.int(1, 4);
  const { terms, answer } = split(seq(5, (i) => start + step * i));
  if (answer > 20) return null;
  return {
    family: 'dots-steady',
    visual: 'dots',
    terms,
    answer,
    explanation: `${step} more dots each time.`,
    mistakes: [answer + 1, answer - 1, answer + step, answer - step, answer + 2],
  };
};

const dotsGrowing: Gen = (rng) => {
  const a0 = rng.int(1, 2);
  const d0 = rng.int(0, 2);
  const all = seq(5, (i) => a0 + d0 * i + (i * (i - 1)) / 2);
  const { terms, answer } = split(all);
  if (answer > 20 || terms[0] === terms[1]) return null;
  const d = diffs(all);
  return {
    family: 'dots-growing',
    visual: 'dots',
    terms,
    answer,
    explanation: `Each step adds one more dot than the last: +${d[0]}, +${d[1]}, +${d[2]}…`,
    mistakes: [terms[terms.length - 1] + d[d.length - 2], answer + 1, answer - 1, answer + 2, answer - 2],
  };
};

const POOLS: Record<Level, Gen[]> = {
  Easy: [arithmetic, geometric, squares],
  Medium: [quadraticGen(false), interleaved, fibonacci(false), altAddMul(false), digitSumGen, cubes],
  Hard: [mulAdd, quadraticGen(true), growingRatio, altAddMul(true), fibonacci(true)],
};
const VISUAL_POOLS: Record<'Easy' | 'Medium', Gen[]> = {
  Easy: [clockSteady, dotsSteady],
  Medium: [clockSpeeding, dotsGrowing],
};

/** Range limits for valid options. */
function inRange(v: number, d: Draft): boolean {
  if (!Number.isInteger(v)) return false;
  if (d.visual === 'clock') return v >= 0 && v < 360 && v % 45 === 0;
  if (d.visual === 'dots') return v >= 1 && v <= 20;
  return v >= 0 && v <= 99999;
}

/** Pick three distractors: two common slips plus fillers, never a value any fitting family predicts. */
function chooseDistractors(rng: Rng, d: Draft, banned: Set<number>): number[] | null {
  const ok = (v: number, taken: number[]) => inRange(v, d) && v !== d.answer && !banned.has(v) && !taken.includes(v);
  const out: number[] = [];
  const slips = d.mistakes.filter((v, i) => ok(v, d.mistakes.slice(0, i)));
  for (const v of rng.shuffle(slips.slice(0, 3)).slice(0, 2)) if (ok(v, out)) out.push(v);
  for (const v of slips) if (out.length < 3 && ok(v, out)) out.push(v);
  // Generic near misses as a last resort.
  const unit = d.visual === 'clock' ? 45 : 1;
  for (let k = 1; out.length < 3 && k < 40; k++) {
    for (const v of [d.answer + k * unit, d.answer - k * unit].map((x) => (d.visual === 'clock' ? mod360(x) : x))) {
      if (out.length < 3 && ok(v, out)) out.push(v);
    }
  }
  return out.length === 3 ? out : null;
}

function makeSequence(rng: Rng, level: Level, gens: Gen[], usedFamilies: Set<FamilyId>): Sequence {
  for (let tries = 0; tries < 500; tries++) {
    const gen = rng.pick(gens);
    const d = gen(rng);
    if (!d || usedFamilies.has(d.family)) continue;
    if (!d.terms.every((v) => inRange(v, d)) || !inRange(d.answer, d)) continue;
    const preds = predictions(d.terms, d.visual);
    if (preds.length !== 1 || preds[0] !== d.answer) continue; // ambiguity guard
    const wrong = chooseDistractors(rng, d, new Set(preds.filter((p) => p !== d.answer)));
    if (!wrong) continue;
    usedFamilies.add(d.family);
    return {
      level,
      family: d.family,
      terms: d.terms,
      answer: d.answer,
      choices: rng.shuffle([d.answer, ...wrong]),
      explanation: d.explanation,
      ...(d.visual ? { visual: d.visual } : {}),
    };
  }
  throw new Error(`pattern: could not generate a ${level} sequence`);
}

export function generatePuzzle(date: EditionDate): Puzzle {
  const rng = createRng(`pattern:v1:${date}`);
  const visualSlot = rng.int(0, 1);
  const used = new Set<FamilyId>();
  const levels: Level[] = ['Easy', 'Medium', 'Hard'];
  const sequences = levels.map((level, i) =>
    makeSequence(rng, level, i === visualSlot ? VISUAL_POOLS[level as 'Easy' | 'Medium'] : POOLS[level], used),
  );
  return { date, sequences };
}

/** Exposed for tests: every generator by family. */
export const GENERATORS: Record<string, Gen> = {
  arithmetic,
  geometric,
  squares,
  cubes,
  quadratic: quadraticGen(false),
  'quadratic-hard': quadraticGen(true),
  interleaved,
  fibonacci: fibonacci(false),
  'fibonacci-hard': fibonacci(true),
  'alt-add-mul': altAddMul(false),
  'alt-add-mul-hard': altAddMul(true),
  'digit-sum': digitSumGen,
  'mul-add': mulAdd,
  'growing-ratio': growingRatio,
  'clock-steady': clockSteady,
  'clock-speeding': clockSpeeding,
  'dots-steady': dotsSteady,
  'dots-growing': dotsGrowing,
};

/* ------------------------------------------------------------------ */
/* Play state                                                          */
/* ------------------------------------------------------------------ */

export interface State {
  /** Chosen option index per sequence, null until answered. One attempt each. */
  picks: (number | null)[];
}

export const initialState = (n: number): State => ({ picks: Array.from({ length: n }, () => null) });

export const currentIndex = (s: State) => {
  const i = s.picks.findIndex((p) => p === null);
  return i === -1 ? s.picks.length : i;
};

export const isDone = (s: State) => currentIndex(s) >= s.picks.length;

export function answer(s: State, puzzle: Puzzle, choice: number): State {
  const i = currentIndex(s);
  if (i >= s.picks.length || choice < 0 || choice >= puzzle.sequences[i].choices.length) return s;
  const picks = s.picks.slice();
  picks[i] = choice;
  return { picks };
}

export const isCorrect = (s: State, puzzle: Puzzle, i: number) =>
  s.picks[i] !== null && puzzle.sequences[i].choices[s.picks[i]!] === puzzle.sequences[i].answer;

export const correctCount = (s: State, puzzle: Puzzle) => s.picks.filter((_, i) => isCorrect(s, puzzle, i)).length;

export function resultFor(s: State, puzzle: Puzzle): { score: string; grid: string[] } {
  return {
    score: `${correctCount(s, puzzle)}/${puzzle.sequences.length}`,
    grid: [puzzle.sequences.map((_, i) => (isCorrect(s, puzzle, i) ? '🟩' : '🟥')).join('')],
  };
}

/** A finished day counts as won with at least two of three right. */
export const isWin = (s: State, puzzle: Puzzle) => correctCount(s, puzzle) * 3 >= puzzle.sequences.length * 2;

/** Spoken description of a visual term, for screen readers. */
export function describeTerm(v: number, visual?: Visual): string {
  if (visual === 'clock') {
    const names = ['up', 'up-right', 'right', 'down-right', 'down', 'down-left', 'left', 'up-left'];
    return `hand pointing ${names[mod360(v) / 45]}`;
  }
  if (visual === 'dots') return `${v} ${v === 1 ? 'dot' : 'dots'}`;
  return String(v);
}
