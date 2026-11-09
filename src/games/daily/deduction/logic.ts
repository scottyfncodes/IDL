/**
 * Deduction — a daily "who did it?" lineup. Pure rules and generation, no React.
 *
 * Suspects stand in a numbered row (left → right). Each wears a hat (or not),
 * a coloured coat and holds something (or nothing).
 *
 * Two generations of puzzle exist, split by date (V2_FROM):
 * - v1: clues are true statements about the culprit; together they leave
 *   exactly one suspect, and every clue is needed. Frozen: past editions.
 * - v2 (./v2.ts): the culprit had a lookout, and clues interlock through them.
 * Play, scoring and the saved State are the same for both.
 */
import { createRng, type Rng } from '../../../lib/rng';
import { dayNumber, type EditionDate } from '../../../lib/date';
import { SCENARIOS, type Scenario } from './content';
import {
  attr,
  CATEGORY_VALUES,
  countWith,
  HOLD,
  neighbours,
  NUM_WORDS,
  randomLineup,
  WEAR,
  withPhrase,
  type Category,
  type Hat,
  type Holding,
  type Suspect,
} from './base';
import { clueTextV2, culpritsV2, generateV2, isValidV2, solveV2, type ClueV2 } from './v2';

export { CATEGORY_VALUES, COATS, HATS, HOLDINGS, type Category, type Coat, type Hat, type Holding, type Suspect } from './base';
export type { ClueV2, Role } from './v2';

/** Editions from this date use the v2 (lookout) generator. Never move it back. */
export const V2_FROM: EditionDate = '2026-11-12';

/** v1 clue: a statement about the culprit alone. */
export type Clue =
  | { kind: 'is'; cat: Category; value: string }
  | { kind: 'not'; cat: Category; value: string }
  | { kind: 'oneOf'; cat: Category; values: [string, string] }
  | { kind: 'count'; cat: Category; value: string; count: number }
  | { kind: 'nextTo'; cat: Category; value: string }
  | { kind: 'notNextTo'; cat: Category; value: string }
  | { kind: 'leftOf'; cat: Category; value: string }
  | { kind: 'rightOf'; cat: Category; value: string }
  | { kind: 'end' }
  | { kind: 'notEnd' };

export type ClueKind = Clue['kind'];
export const POSITIONAL_KINDS: readonly ClueKind[] = ['nextTo', 'notNextTo', 'leftOf', 'rightOf', 'end', 'notEnd'];

export interface PuzzleV1 {
  date: EditionDate;
  scenario: Scenario;
  suspects: Suspect[];
  clues: Clue[];
  /** Index of the culprit in `suspects`. Never render before the game ends. */
  culprit: number;
  version?: undefined;
}

export interface PuzzleV2 {
  version: 2;
  date: EditionDate;
  scenario: Scenario;
  suspects: Suspect[];
  clues: ClueV2[];
  /** Index of the culprit in `suspects`. Never render before the game ends. */
  culprit: number;
  /** Index of the lookout (never the culprit). Never render before the game ends. */
  lookout: number;
}

export type Puzzle = PuzzleV1 | PuzzleV2;
export const isV2 = (p: Pick<Puzzle, 'version'>): p is PuzzleV2 => p.version === 2;

export interface State {
  /** Suspect indices the player has crossed out (pencil notes). */
  ruledOut: number[];
  /** Suspect indices accused, in order. */
  accusations: number[];
}

export const MAX_ACCUSATIONS = 3;
export const MIN_CLUES = 3;
export const MAX_CLUES = 5;

// ---------- Evaluation (v1) ----------

const uniqueIndex = (lineup: readonly Suspect[], cat: Category, value: string) => {
  const idx = lineup.map((s, j) => (attr(s, cat) === value ? j : -1)).filter((j) => j >= 0);
  return idx.length === 1 ? idx[0] : -1;
};

/** Is `clue` true of suspect `i` in this lineup? */
export function holds(clue: Clue, lineup: readonly Suspect[], i: number): boolean {
  const s = lineup[i];
  switch (clue.kind) {
    case 'is':
      return attr(s, clue.cat) === clue.value;
    case 'not':
      return attr(s, clue.cat) !== clue.value;
    case 'oneOf':
      return clue.values.includes(attr(s, clue.cat));
    case 'count':
      return attr(s, clue.cat) === clue.value && countWith(lineup, clue.cat, clue.value) === clue.count;
    case 'nextTo':
      return neighbours(lineup, i).some((j) => attr(lineup[j], clue.cat) === clue.value);
    case 'notNextTo':
      return !neighbours(lineup, i).some((j) => attr(lineup[j], clue.cat) === clue.value);
    case 'leftOf': {
      const j = uniqueIndex(lineup, clue.cat, clue.value);
      return j >= 0 && i < j;
    }
    case 'rightOf': {
      const j = uniqueIndex(lineup, clue.cat, clue.value);
      return j >= 0 && i > j;
    }
    case 'end':
      return i === 0 || i === lineup.length - 1;
    case 'notEnd':
      return i !== 0 && i !== lineup.length - 1;
  }
}

/** Indices of suspects consistent with every clue. */
export function candidates(clues: readonly Clue[], lineup: readonly Suspect[]): number[] {
  return lineup.map((_, i) => i).filter((i) => clues.every((c) => holds(c, lineup, i)));
}

/** Suspects (indices) that a single clue rules out. */
export const eliminatedBy = (clue: Clue, lineup: readonly Suspect[]) => lineup.map((_, i) => i).filter((i) => !holds(clue, lineup, i));

/** Every clue is necessary: dropping any one leaves more than one candidate. */
export function isMinimal(clues: readonly Clue[], lineup: readonly Suspect[]): boolean {
  return clues.every((_, k) => candidates(clues.filter((__, j) => j !== k), lineup).length > 1);
}

/**
 * Index of the clue that rules out suspect `i` (−1 if none — only the culprit).
 * v1: the first clue that is false of them. v2: the clue in the solving chain
 * that clears them, given what the earlier steps established.
 */
export function refutingClue(p: Pick<PuzzleV1, 'clues' | 'suspects' | 'version'> | Pick<PuzzleV2, 'clues' | 'suspects' | 'version'>, i: number): number {
  if (p.version === 2) {
    const step = solveV2(p.clues, p.suspects).steps.find((s) => s.culprits.includes(i));
    return step ? step.clue : -1;
  }
  const clues: readonly Clue[] = p.clues;
  return clues.findIndex((c) => !holds(c, p.suspects, i));
}

/**
 * The clues a wrong accusation should point to: the smallest set of clues that,
 * read together, rule suspect `i` out as the culprit (−1 never appears; [] only
 * for the culprit). v1 clues each stand alone, so that is always one clue. In v2
 * a clue in the solving chain often only works once the lookout is known, so the
 * set names every clue needed, ties broken by the lowest clue numbers.
 */
export function refutingClues(p: Pick<PuzzleV1, 'clues' | 'suspects' | 'version'> | Pick<PuzzleV2, 'clues' | 'suspects' | 'version'>, i: number): number[] {
  if (p.version !== 2) {
    const k = refutingClue(p, i);
    return k < 0 ? [] : [k];
  }
  const n = p.clues.length;
  let best: number[] | null = null;
  for (let mask = 1; mask < 1 << n; mask++) {
    const set = p.clues.map((_, k) => k).filter((k) => mask & (1 << k));
    if (best && set.length > best.length) continue;
    if (culpritsV2(set.map((k) => p.clues[k]), p.suspects).includes(i)) continue;
    if (!best || set.length < best.length || set.join() < best.join()) best = set;
  }
  return best ?? [];
}

/** "clue 3 rules them out" / "clues 1, 2 and 4 together rule them out". */
export function refutationText(clues: readonly number[]): string {
  const nums = clues.map((k) => String(k + 1));
  if (nums.length === 1) return `clue ${nums[0]} rules them out`;
  const list = nums.length === 2 ? nums.join(' and ') : `${nums.slice(0, -1).join(', ')} and ${nums[nums.length - 1]}`;
  return `clues ${list} together rule them out`;
}

// ---------- Wording ----------

/** "the person in the beret" — used only when exactly one person matches. */
function thePerson(cat: Category, value: string): string {
  if (cat === 'hat') return value === 'none' ? 'the person without a hat' : `the person in the ${value === 'bobble' ? 'bobble hat' : value}`;
  if (cat === 'coat') return `the person in the ${value} coat`;
  return value === 'nothing' ? 'the person with empty hands' : `the person holding the ${value}`;
}

function groupPhrase(cat: Category, value: string, n: number): string {
  const num = NUM_WORDS[n] ?? String(n);
  if (cat === 'hat') {
    if (value === 'none') return `${num} people without a hat`;
    return `${num} people wearing ${value === 'bobble' ? 'bobble hats' : `${value}s`}`;
  }
  if (cat === 'coat') return `${num} people in ${value} coats`;
  return value === 'nothing' ? `${num} people with empty hands` : `${num} people holding ${value}s`;
}

function isPhrase(cat: Category, value: string): string {
  if (cat === 'hat') return `The culprit wore ${WEAR[value as Hat]}.`;
  if (cat === 'coat') return `The culprit wore a ${value} coat.`;
  return value === 'nothing' ? 'The culprit’s hands were empty.' : `The culprit was holding ${HOLD[value as Holding]}.`;
}

function notPhrase(cat: Category, value: string): string {
  if (cat === 'hat') return value === 'none' ? 'The culprit was wearing a hat of some kind.' : `The culprit was not wearing ${WEAR[value as Hat]}.`;
  if (cat === 'coat') return `The culprit’s coat was not ${value}.`;
  return value === 'nothing' ? 'The culprit was holding something.' : `The culprit was not holding ${HOLD[value as Holding]}.`;
}

const isClueV2 = (clue: Clue | ClueV2): clue is ClueV2 =>
  'who' in clue || clue.kind === 'adjacent' || clue.kind === 'gap' || clue.kind === 'order' || clue.kind === 'same';

/** Plain-English sentence for a clue (v1 or v2). Never mentions names or positions by number. */
export function clueText(clue: Clue | ClueV2): string {
  if (isClueV2(clue)) return clueTextV2(clue);
  switch (clue.kind) {
    case 'is':
      return isPhrase(clue.cat, clue.value);
    case 'not':
      return notPhrase(clue.cat, clue.value);
    case 'oneOf': {
      const [a, b] = clue.values;
      if (clue.cat === 'hat') return `The culprit wore either ${WEAR[a as Hat]} or ${WEAR[b as Hat]}.`;
      if (clue.cat === 'coat') return `The culprit’s coat was either ${a} or ${b}.`;
      return `The culprit was holding either ${HOLD[a as Holding]} or ${HOLD[b as Holding]}.`;
    }
    case 'count':
      return `The culprit is one of the ${groupPhrase(clue.cat, clue.value, clue.count)}.`;
    case 'nextTo':
      return `The culprit stood directly next to someone ${withPhrase(clue.cat, clue.value)}.`;
    case 'notNextTo':
      return `The culprit was not standing next to anyone ${withPhrase(clue.cat, clue.value)}.`;
    case 'leftOf':
      return `The culprit stood somewhere to the left of ${thePerson(clue.cat, clue.value)}.`;
    case 'rightOf':
      return `The culprit stood somewhere to the right of ${thePerson(clue.cat, clue.value)}.`;
    case 'end':
      return 'The culprit stood at one end of the row.';
    case 'notEnd':
      return 'The culprit did not stand at either end of the row.';
  }
}

/** Short label for an attribute value, as shown on a suspect card. */
export function valueLabel(cat: Category, value: string): string {
  if (cat === 'hat') return value === 'none' ? 'no hat' : value === 'bobble' ? 'bobble' : value;
  if (cat === 'coat') return value;
  return value === 'nothing' ? 'empty' : value;
}

// ---------- Generation ----------

/** Every clue template instance that is true of suspect `c` in this lineup. */
export function trueClues(lineup: readonly Suspect[], c: number): Clue[] {
  const out: Clue[] = [];
  const cats: Category[] = ['hat', 'coat', 'holding'];
  for (const cat of cats) {
    const values = CATEGORY_VALUES[cat] as readonly string[];
    for (const v of values) {
      const n = countWith(lineup, cat, v);
      out.push({ kind: 'is', cat, value: v });
      out.push({ kind: 'not', cat, value: v });
      if (n >= 2) out.push({ kind: 'count', cat, value: v, count: n });
      if (n >= 1) {
        out.push({ kind: 'nextTo', cat, value: v });
        out.push({ kind: 'notNextTo', cat, value: v });
      }
      if (n === 1) {
        out.push({ kind: 'leftOf', cat, value: v });
        out.push({ kind: 'rightOf', cat, value: v });
      }
    }
    for (let a = 0; a < values.length; a++) {
      for (let b = a + 1; b < values.length; b++) out.push({ kind: 'oneOf', cat, values: [values[a], values[b]] });
    }
  }
  out.push({ kind: 'end' }, { kind: 'notEnd' });
  return out.filter((cl) => holds(cl, lineup, c));
}

/** Try to build a minimal clue set for this lineup and culprit, or null. */
export function buildClues(rng: Rng, lineup: readonly Suspect[], culprit: number, maxEliminated = lineup.length - 2): Clue[] | null {
  // Only clues that rule someone out, but never everyone at once (that would be the whole puzzle).
  // A lower `maxEliminated` favours gentler clues, which makes for longer chains.
  const pool = trueClues(lineup, culprit).filter((cl) => {
    const e = eliminatedBy(cl, lineup).length;
    return e >= 1 && e <= maxEliminated;
  });
  const chosen: Clue[] = [];
  let remaining = lineup.map((_, i) => i);
  for (const cl of rng.shuffle(pool)) {
    if (remaining.length === 1) break;
    const next = remaining.filter((i) => holds(cl, lineup, i));
    if (next.length < remaining.length) {
      chosen.push(cl);
      remaining = next;
    }
  }
  if (remaining.length !== 1) return null;
  // Minimise: drop clues (in random order) while uniqueness survives.
  let clues = chosen;
  for (const cl of rng.shuffle(chosen)) {
    const without = clues.filter((x) => x !== cl);
    if (candidates(without, lineup).length === 1) clues = without;
  }
  return clues;
}

export function isValidPuzzle(p: Puzzle): boolean {
  if (isV2(p)) return isValidV2(p);
  const cands = candidates(p.clues, p.suspects);
  return (
    cands.length === 1 &&
    cands[0] === p.culprit &&
    p.clues.length >= MIN_CLUES &&
    p.clues.length <= MAX_CLUES &&
    isMinimal(p.clues, p.suspects) &&
    p.clues.some((c) => POSITIONAL_KINDS.includes(c.kind))
  );
}

/**
 * Scenarios rotate through a seeded shuffle of the list, block by block, so
 * the same story never runs on consecutive days within a block. The v1 cycle
 * uses the first SCENARIO_CYCLE entries; growing it would change past
 * editions, so new scenarios belong in a v2 generator.
 */
export const SCENARIO_CYCLE = 24;
export function scenarioFor(date: EditionDate): Scenario {
  const day = dayNumber(date);
  const block = Math.floor(day / SCENARIO_CYCLE);
  const order = createRng(`deduction:scenes:v1:${block}`).shuffle(Array.from({ length: SCENARIO_CYCLE }, (_, i) => i));
  return SCENARIOS[order[((day % SCENARIO_CYCLE) + SCENARIO_CYCLE) % SCENARIO_CYCLE]];
}

/** The puzzle for a date: v1 before V2_FROM (unchanged, byte for byte), v2 from then on. */
export function generatePuzzle(date: EditionDate, rng?: Rng): Puzzle {
  return date < V2_FROM ? generatePuzzleV1(date, rng) : generatePuzzleV2(date, rng);
}

export function generatePuzzleV2(date: EditionDate, rng: Rng = createRng(`deduction:v2:${date}`)): PuzzleV2 {
  const scenario = scenarioFor(date);
  const core = generateV2(rng);
  return { version: 2, date, scenario, ...core };
}

export function generatePuzzleV1(date: EditionDate, rng: Rng = createRng(`deduction:v1:${date}`)): PuzzleV1 {
  const scenario = scenarioFor(date);
  // Aim for a particular chain length; relax to any valid length if it proves elusive.
  const target = rng.pick([3, 4, 4, 5]);
  for (let attempt = 0; attempt < 3000; attempt++) {
    const n = rng.chance(0.5) ? 5 : 6;
    const suspects = randomLineup(rng, n);
    const culprit = rng.int(0, n - 1);
    // Longer chains come from gentler clues that each rule out only one or two people.
    const clues = buildClues(rng, suspects, culprit, target === 3 ? n - 2 : target === 4 ? 2 : 1);
    if (!clues) continue;
    if (attempt < 1500 && clues.length !== target) continue;
    // Variety: no more than two clues of the same kind.
    if (clues.some((c) => clues.filter((d) => d.kind === c.kind).length > 2)) continue;
    const p: PuzzleV1 = { date, scenario, suspects, clues: rng.shuffle(clues), culprit };
    if (isValidPuzzle(p)) return p;
  }
  throw new Error(`deduction: no puzzle for ${date}`);
}

// ---------- Play ----------

export const wrongAccusations = (p: Puzzle, s: State) => s.accusations.filter((i) => i !== p.culprit).length;
export const isSolved = (p: Puzzle, s: State) => s.accusations.includes(p.culprit);
export function status(p: Puzzle, s: State): 'playing' | 'won' | 'lost' {
  if (isSolved(p, s)) return 'won';
  return wrongAccusations(p, s) >= MAX_ACCUSATIONS ? 'lost' : 'playing';
}

export function toggleRuledOut(p: Puzzle, s: State, i: number): State {
  if (status(p, s) !== 'playing' || i < 0 || i >= p.suspects.length) return s;
  const ruledOut = s.ruledOut.includes(i) ? s.ruledOut.filter((x) => x !== i) : [...s.ruledOut, i].sort((a, b) => a - b);
  return { ...s, ruledOut };
}

export type AccuseOutcome = { state: State; correct: true } | { state: State; correct: false; clue: number };

/** Accuse suspect `i`. Wrong accusations report the first clue that rules them out. */
export function accuse(p: Puzzle, s: State, i: number): AccuseOutcome | null {
  if (status(p, s) !== 'playing' || s.accusations.includes(i) || i < 0 || i >= p.suspects.length) return null;
  const accusations = [...s.accusations, i];
  if (i === p.culprit) return { state: { ...s, accusations }, correct: true };
  const ruledOut = s.ruledOut.includes(i) ? s.ruledOut : [...s.ruledOut, i].sort((a, b) => a - b);
  return { state: { ruledOut, accusations }, correct: false, clue: refutingClue(p, i) };
}

const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

export function scoreText(p: Puzzle, s: State): string {
  return isSolved(p, s) ? `Solved on ${ORDINAL[s.accusations.length - 1]} accusation` : 'Case unsolved';
}

export function resultGrid(p: Puzzle, s: State): string {
  return s.accusations.map((i) => (i === p.culprit ? '✅' : '🔍')).join('');
}

export interface ExplanationStep {
  /** Clue index this step uses (−1: "the lookout isn't the culprit"). */
  clue: number;
  text: string;
  /** Names ruled out as the culprit at this step. */
  eliminated: string[];
  /** v2 only: names ruled out as the lookout at this step. */
  lookoutsEliminated?: string[];
  /** v2 only: set when this step leaves a single possible lookout. */
  lookout?: string;
}

/**
 * The reveal. v1: each clue with the suspects it rules out. v2: the solving
 * chain, step by step, including what each step says about the lookout.
 */
export function explanation(p: Puzzle): ExplanationStep[] {
  const name = (i: number) => p.suspects[i].name;
  if (!isV2(p)) return p.clues.map((c, k) => ({ clue: k, text: clueText(c), eliminated: eliminatedBy(c, p.suspects).map(name) }));
  let lookouts = p.suspects.map((_, i) => i);
  return solveV2(p.clues, p.suspects).steps.map((s) => {
    const before = lookouts.length;
    lookouts = lookouts.filter((i) => !s.lookouts.includes(i));
    return {
      clue: s.clue,
      text: s.clue >= 0 ? clueText(p.clues[s.clue]) : 'The lookout can’t also be the culprit.',
      eliminated: s.culprits.map(name),
      lookoutsEliminated: s.lookouts.map(name),
      ...(lookouts.length === 1 && before > 1 ? { lookout: name(lookouts[0]) } : {}),
    };
  });
}
