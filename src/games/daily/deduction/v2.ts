/**
 * Deduction v2 (editions from V2_FROM): the culprit had a lookout.
 *
 * Two people in the row were in on it: the culprit and a lookout (never the
 * same person). Clues describe either of them, or how they stood relative to
 * each other ("The culprit stood directly next to the lookout"). No clue about
 * the culprit alone is enough: the player has to pin down the lookout first
 * and carry that across, which is where the "aha" lives.
 *
 * Generator guarantees (all checked by `isValidV2` and the tests):
 * - exactly one (culprit, lookout) pair fits every clue;
 * - every clue is necessary to name the culprit;
 * - no clue alone rules out more than half the suspects as the culprit, and
 *   none pins the lookout by itself;
 * - interlock: reading each clue on its own as a filter on the culprit
 *   (the naive way) leaves at least half the row;
 * - a short chain of forced steps (`solveV2`) reaches the answer, so the
 *   puzzle never needs guessing, and that chain is the reveal.
 */
import type { Rng } from '../../../lib/rng';
import {
  attr,
  CATEGORIES,
  CATEGORY_VALUES,
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

export type Role = 'culprit' | 'lookout';

export type ClueV2 =
  | { kind: 'is'; who: Role; cat: Category; value: string }
  | { kind: 'not'; who: Role; cat: Category; value: string }
  | { kind: 'oneOf'; who: Role; cat: Category; values: [string, string] }
  | { kind: 'end'; who: Role }
  | { kind: 'notEnd'; who: Role }
  | { kind: 'nextTo'; who: Role; cat: Category; value: string }
  /** Exactly `count` people on one side of `who` have this value. */
  | { kind: 'side'; who: Role; side: 'left' | 'right'; cat: Category; value: string; count: number }
  /** The culprit and the lookout stood side by side. */
  | { kind: 'adjacent' }
  /** Exactly one person stood between them. */
  | { kind: 'gap' }
  /** `first` stood somewhere to the left of the other. */
  | { kind: 'order'; first: Role }
  /** Same coat colour / same kind of hat (both wearing one) / holding the same kind of thing. */
  | { kind: 'same'; cat: Category };

export type ClueV2Kind = ClueV2['kind'];
export const RELATION_KINDS: readonly ClueV2Kind[] = ['adjacent', 'gap', 'order', 'same'];
const ATTRIBUTE_KINDS: readonly ClueV2Kind[] = ['is', 'not', 'oneOf'];

export const isRelation = (c: ClueV2) => RELATION_KINDS.includes(c.kind);
export const roleOf = (c: ClueV2): Role | null => ('who' in c ? c.who : null);

export const V2_SUSPECTS = 6;
export const V2_MIN_CLUES = 4;
export const V2_MAX_CLUES = 5;
/** Reading the clues one at a time as culprit filters must leave at least this many people. */
export const NAIVE_MIN = 3;

// ---------- Evaluation ----------

function unaryHolds(c: Exclude<ClueV2, { kind: 'adjacent' | 'gap' | 'order' | 'same' }>, lineup: readonly Suspect[], i: number): boolean {
  const s = lineup[i];
  switch (c.kind) {
    case 'is':
      return attr(s, c.cat) === c.value;
    case 'not':
      return attr(s, c.cat) !== c.value;
    case 'oneOf':
      return c.values.includes(attr(s, c.cat));
    case 'end':
      return i === 0 || i === lineup.length - 1;
    case 'notEnd':
      return i !== 0 && i !== lineup.length - 1;
    case 'nextTo':
      return neighbours(lineup, i).some((j) => attr(lineup[j], c.cat) === c.value);
    case 'side': {
      const range = c.side === 'left' ? lineup.slice(0, i) : lineup.slice(i + 1);
      return range.filter((x) => attr(x, c.cat) === c.value).length === c.count;
    }
  }
}

const NOTHING: Record<Category, string> = { hat: 'none', coat: '', holding: 'nothing' };

/** Is `clue` true when suspect `c` is the culprit and `l` the lookout? */
export function holdsV2(clue: ClueV2, lineup: readonly Suspect[], c: number, l: number): boolean {
  if (c === l) return false;
  switch (clue.kind) {
    case 'adjacent':
      return Math.abs(c - l) === 1;
    case 'gap':
      return Math.abs(c - l) === 2;
    case 'order':
      return clue.first === 'culprit' ? c < l : l < c;
    case 'same': {
      const a = attr(lineup[c], clue.cat);
      return a === attr(lineup[l], clue.cat) && a !== NOTHING[clue.cat];
    }
    default:
      return unaryHolds(clue, lineup, clue.who === 'culprit' ? c : l);
  }
}

export type Pair = [culprit: number, lookout: number];

/** Every (culprit, lookout) pair consistent with all the clues. */
export function pairsV2(clues: readonly ClueV2[], lineup: readonly Suspect[]): Pair[] {
  const out: Pair[] = [];
  for (let c = 0; c < lineup.length; c++) {
    for (let l = 0; l < lineup.length; l++) {
      if (c !== l && clues.every((k) => holdsV2(k, lineup, c, l))) out.push([c, l]);
    }
  }
  return out;
}

const uniq = (xs: number[]) => [...new Set(xs)].sort((a, b) => a - b);
export const culpritsV2 = (clues: readonly ClueV2[], lineup: readonly Suspect[]) => uniq(pairsV2(clues, lineup).map((p) => p[0]));
export const lookoutsV2 = (clues: readonly ClueV2[], lineup: readonly Suspect[]) => uniq(pairsV2(clues, lineup).map((p) => p[1]));

/** Suspects one clue on its own rules out as culprit / as lookout. */
export function eliminatedByV2(clue: ClueV2, lineup: readonly Suspect[]): { culprits: number[]; lookouts: number[] } {
  const all = lineup.map((_, i) => i);
  const cs = culpritsV2([clue], lineup);
  const ls = lookoutsV2([clue], lineup);
  return { culprits: all.filter((i) => !cs.includes(i)), lookouts: all.filter((i) => !ls.includes(i)) };
}

/**
 * The naive reading: treat every clue on its own as a filter on the culprit
 * and intersect. In a v2 puzzle this always leaves several people.
 */
export function naiveCulprits(clues: readonly ClueV2[], lineup: readonly Suspect[]): number[] {
  return lineup.map((_, i) => i).filter((i) => clues.every((k) => culpritsV2([k], lineup).includes(i)));
}

/** Every clue is necessary: without any one of them, more than one culprit fits. */
export function isMinimalV2(clues: readonly ClueV2[], lineup: readonly Suspect[]): boolean {
  return clues.every((_, k) => culpritsV2(clues.filter((__, j) => j !== k), lineup).length > 1);
}

// ---------- Step-by-step solving ----------

export interface SolveStep {
  /** Clue index, or −1 for "the lookout isn't the culprit". */
  clue: number;
  /** Ruled out as the culprit at this step. */
  culprits: number[];
  /** Ruled out as the lookout at this step. */
  lookouts: number[];
}

/**
 * Solve the way a person would: keep a list of who could still be the culprit
 * and who the lookout, and apply whichever clue forces something new. Clues
 * about one person come first; relations are applied against the current lists.
 */
export function solveV2(clues: readonly ClueV2[], lineup: readonly Suspect[]): { steps: SolveStep[]; culprits: number[]; lookouts: number[] } {
  let C = lineup.map((_, i) => i);
  let L = lineup.map((_, i) => i);
  const steps: SolveStep[] = [];
  const order = clues.map((_, k) => k).sort((a, b) => Number(isRelation(clues[a])) - Number(isRelation(clues[b])) || a - b);
  for (let guard = 0; guard < 100; guard++) {
    if (L.length === 1 && C.includes(L[0])) {
      steps.push({ clue: -1, culprits: [L[0]], lookouts: [] });
      C = C.filter((i) => i !== L[0]);
      continue;
    }
    if (C.length === 1 && L.includes(C[0])) {
      steps.push({ clue: -1, culprits: [], lookouts: [C[0]] });
      L = L.filter((i) => i !== C[0]);
      continue;
    }
    let changed = false;
    for (const k of order) {
      const cl = clues[k];
      const nextC = C.filter((c) => L.some((l) => holdsV2(cl, lineup, c, l)));
      const nextL = L.filter((l) => C.some((c) => holdsV2(cl, lineup, c, l)));
      if (nextC.length < C.length || nextL.length < L.length) {
        steps.push({ clue: k, culprits: C.filter((i) => !nextC.includes(i)), lookouts: L.filter((i) => !nextL.includes(i)) });
        C = nextC;
        L = nextL;
        changed = true;
        break;
      }
    }
    if (!changed) break;
  }
  return { steps, culprits: C, lookouts: L };
}

// ---------- Wording ----------

const SUBJ: Record<Role, string> = { culprit: 'the culprit', lookout: 'the lookout' };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/** "wore a cap" / "wore caps": what a person in a side count did. */
function sidePredicate(cat: Category, value: string, plural: boolean): string {
  if (cat === 'hat') {
    if (value === 'none') return 'had no hat';
    const noun = value === 'bobble' ? 'bobble hat' : value;
    return plural ? `wore ${noun}s` : `wore ${WEAR[value as Hat]}`;
  }
  if (cat === 'coat') return plural ? `wore ${value} coats` : `wore a ${value} coat`;
  if (value === 'nothing') return 'had empty hands';
  return plural ? `held ${value}s` : `held ${HOLD[value as Holding]}`;
}

export function clueTextV2(clue: ClueV2): string {
  if (clue.kind === 'adjacent') return 'The culprit stood directly next to the lookout.';
  if (clue.kind === 'gap') return 'Exactly one person stood between the culprit and the lookout.';
  if (clue.kind === 'order') {
    return clue.first === 'culprit' ? 'The culprit stood somewhere to the left of the lookout.' : 'The lookout stood somewhere to the left of the culprit.';
  }
  if (clue.kind === 'same') {
    if (clue.cat === 'coat') return 'The culprit and the lookout wore coats of the same colour.';
    if (clue.cat === 'hat') return 'The culprit and the lookout wore the same kind of hat.';
    return 'The culprit and the lookout were holding the same kind of thing.';
  }
  const S = cap(SUBJ[clue.who]);
  const s = SUBJ[clue.who];
  switch (clue.kind) {
    case 'is':
      if (clue.cat === 'hat') return `${S} wore ${WEAR[clue.value as Hat]}.`;
      if (clue.cat === 'coat') return `${S} wore a ${clue.value} coat.`;
      return clue.value === 'nothing' ? `${S}’s hands were empty.` : `${S} was holding ${HOLD[clue.value as Holding]}.`;
    case 'not':
      if (clue.cat === 'hat') return clue.value === 'none' ? `${S} was wearing a hat of some kind.` : `${S} was not wearing ${WEAR[clue.value as Hat]}.`;
      if (clue.cat === 'coat') return `${S}’s coat was not ${clue.value}.`;
      return clue.value === 'nothing' ? `${S} was holding something.` : `${S} was not holding ${HOLD[clue.value as Holding]}.`;
    case 'oneOf': {
      const [a, b] = clue.values;
      if (clue.cat === 'hat') return `${S} wore either ${WEAR[a as Hat]} or ${WEAR[b as Hat]}.`;
      if (clue.cat === 'coat') return `${S}’s coat was either ${a} or ${b}.`;
      return `${S} was holding either ${HOLD[a as Holding]} or ${HOLD[b as Holding]}.`;
    }
    case 'end':
      return `${S} stood at one end of the row.`;
    case 'notEnd':
      return `${S} did not stand at either end of the row.`;
    case 'nextTo':
      return `${S} stood directly next to someone ${withPhrase(clue.cat, clue.value)}.`;
    case 'side': {
      // "to the left of the culprit", never "to the culprit's left": the figures face
      // the player, so a possessive left could be read as the suspect's own left.
      const where = `to the ${clue.side} of ${s}`;
      if (clue.count === 0) return `Nobody ${where} ${sidePredicate(clue.cat, clue.value, false)}.`;
      if (clue.count === 1) return `Exactly one person ${where} ${sidePredicate(clue.cat, clue.value, false)}.`;
      return `Exactly ${NUM_WORDS[clue.count]} people ${where} ${sidePredicate(clue.cat, clue.value, true)}.`;
    }
  }
}

// ---------- Generation ----------

/** Every v2 clue that is true when `c` is the culprit and `l` the lookout. */
export function trueCluesV2(lineup: readonly Suspect[], c: number, l: number): ClueV2[] {
  const out: ClueV2[] = [];
  for (const who of ['culprit', 'lookout'] as const) {
    const i = who === 'culprit' ? c : l;
    for (const cat of CATEGORIES) {
      const values = CATEGORY_VALUES[cat] as readonly string[];
      for (const v of values) {
        out.push({ kind: 'is', who, cat, value: v }, { kind: 'not', who, cat, value: v }, { kind: 'nextTo', who, cat, value: v });
        for (const side of ['left', 'right'] as const) {
          const range = side === 'left' ? lineup.slice(0, i) : lineup.slice(i + 1);
          const count = range.filter((x) => attr(x, cat) === v).length;
          if (range.length > 0 && count <= 3) out.push({ kind: 'side', who, side, cat, value: v, count });
        }
      }
      for (let a = 0; a < values.length; a++) {
        for (let b = a + 1; b < values.length; b++) out.push({ kind: 'oneOf', who, cat, values: [values[a], values[b]] });
      }
    }
    out.push({ kind: 'end', who }, { kind: 'notEnd', who });
  }
  out.push({ kind: 'adjacent' }, { kind: 'gap' }, { kind: 'order', first: 'culprit' }, { kind: 'order', first: 'lookout' });
  for (const cat of CATEGORIES) out.push({ kind: 'same', cat });
  return out.filter((k) => holdsV2(k, lineup, c, l));
}

/** Which (culprit, lookout) pairs a clue allows, as a flat n×n table. */
function pairMask(clue: ClueV2, lineup: readonly Suspect[]): Uint8Array {
  const n = lineup.length;
  const m = new Uint8Array(n * n);
  for (let c = 0; c < n; c++) for (let l = 0; l < n; l++) m[c * n + l] = holdsV2(clue, lineup, c, l) ? 1 : 0;
  return m;
}

/** A clue is fair on its own: it rules something out, but never too much. */
function fairMask(m: Uint8Array, n: number): boolean {
  let culprits = 0;
  let lookouts = 0;
  let pairs = 0;
  for (let i = 0; i < n; i++) {
    let asC = false;
    let asL = false;
    for (let j = 0; j < n; j++) {
      if (m[i * n + j]) asC = true;
      if (m[j * n + i]) asL = true;
      pairs += m[i * n + j];
    }
    if (asC) culprits++;
    if (asL) lookouts++;
  }
  return n - culprits <= Math.floor(n / 2) && n - lookouts <= n - 2 && pairs < n * (n - 1);
}

const fairClue = (clue: ClueV2, lineup: readonly Suspect[]) => fairMask(pairMask(clue, lineup), lineup.length);

export interface PuzzleV2Core {
  suspects: Suspect[];
  clues: ClueV2[];
  culprit: number;
  lookout: number;
}

/** Every rule a v2 puzzle must satisfy. */
export function isValidV2(p: PuzzleV2Core): boolean {
  const { suspects: L, clues } = p;
  const pairs = pairsV2(clues, L);
  if (pairs.length !== 1 || pairs[0][0] !== p.culprit || pairs[0][1] !== p.lookout) return false;
  if (clues.length < V2_MIN_CLUES || clues.length > V2_MAX_CLUES) return false;
  if (!isMinimalV2(clues, L)) return false;
  if (!clues.every((k) => fairClue(k, L))) return false;
  if (naiveCulprits(clues, L).length < NAIVE_MIN) return false;
  if (!clues.some(isRelation) || !clues.some((k) => roleOf(k) === 'lookout')) return false;
  // Variety: no kind more than twice, one counting clue at most, and at most two plain "the X wore…" clues.
  if (clues.some((k) => clues.filter((d) => d.kind === k.kind).length > 2)) return false;
  if (clues.filter((k) => k.kind === 'side').length > 1) return false;
  if (clues.filter((k) => ATTRIBUTE_KINDS.includes(k.kind)).length > 2) return false;
  // Two attribute clues on the same person and category ("coat not green" + "coat green or yellow")
  // collapse into one plain fact and read like padding.
  const attrKeys = clues.filter((k) => ATTRIBUTE_KINDS.includes(k.kind)).map((k) => `${roleOf(k)}:${'cat' in k ? k.cat : ''}`);
  if (new Set(attrKeys).size !== attrKeys.length) return false;
  const solved = solveV2(clues, L);
  if (solved.culprits.length !== 1 || solved.lookouts.length !== 1) return false;
  // Every innocent is cleared by a clue, not just by "the lookout isn't the culprit".
  return solved.steps.every((s) => s.clue >= 0 || s.culprits.length === 0);
}

/** Build a v2 puzzle core. Deterministic for a given rng. */
export function generateV2(rng: Rng): PuzzleV2Core {
  const n = V2_SUSPECTS;
  for (let attempt = 0; attempt < 5000; attempt++) {
    const suspects = randomLineup(rng, n);
    const culprit = rng.int(0, n - 1);
    let lookout = rng.int(0, n - 2);
    if (lookout >= culprit) lookout++;
    const pool = trueCluesV2(suspects, culprit, lookout)
      .map((clue) => ({ clue, mask: pairMask(clue, suspects) }))
      .filter((x) => fairMask(x.mask, n));
    const relations = pool.filter((x) => isRelation(x.clue));
    if (relations.length === 0) continue;
    // Start from a relation, then add whatever narrows things down.
    const first = rng.pick(relations);
    const chosen = [first];
    const live = Uint8Array.from(first.mask);
    let left = live.reduce((a, b) => a + b, 0);
    for (const x of rng.shuffle(pool.filter((y) => y !== first))) {
      if (left === 1) break;
      let next = 0;
      for (let q = 0; q < live.length; q++) next += live[q] & x.mask[q];
      if (next < left) {
        for (let q = 0; q < live.length; q++) live[q] &= x.mask[q];
        chosen.push(x);
        left = next;
      }
    }
    if (left !== 1) continue;
    // Minimise: drop clues (in random order) while the pair stays unique.
    let kept = chosen;
    for (const x of rng.shuffle(chosen)) {
      const without = kept.filter((y) => y !== x);
      let count = 0;
      for (let q = 0; q < live.length; q++) if (without.every((y) => y.mask[q])) count++;
      if (count === 1) kept = without;
    }
    if (kept.length < V2_MIN_CLUES || kept.length > V2_MAX_CLUES) continue;
    // Cheap checks on the tables first; isValidV2 below re-checks everything.
    const rowOk = (masks: Uint8Array[], c: number) => {
      for (let l = 0; l < n; l++) if (masks.every((m) => m[c * n + l])) return true;
      return false;
    };
    let naive = 0;
    for (let c = 0; c < n; c++) if (kept.every((x) => rowOk([x.mask], c))) naive++;
    if (naive < NAIVE_MIN) continue;
    const minimal = kept.every((x) => {
      const others = kept.filter((y) => y !== x).map((y) => y.mask);
      let cs = 0;
      for (let c = 0; c < n; c++) if (rowOk(others, c)) cs++;
      return cs > 1;
    });
    if (!minimal) continue;
    const clues = kept.map((x) => x.clue);
    const p: PuzzleV2Core = { suspects, clues: rng.shuffle(clues), culprit, lookout };
    if (isValidV2(p)) return p;
  }
  throw new Error('deduction v2: no puzzle');
}
