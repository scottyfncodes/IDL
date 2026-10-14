/**
 * Sumwise — pure rules, exact arithmetic, expression parsing and puzzle
 * generation. No React here.
 *
 * Rules (implemented exactly):
 * - Operators + − × ÷ and brackets. Standard precedence: × and ÷ bind tighter
 *   than + and −; equal precedence evaluates left to right.
 * - Each number tile may be used at most once. You don't need all of them.
 * - Arithmetic is exact over fractions: intermediate fractions are allowed,
 *   the final value must equal the target exactly. Dividing by zero is invalid.
 * - No unary minus and no joining tiles into longer numbers.
 */
import { createRng, type Rng } from '../../../lib/rng';
import type { EditionDate } from '../../../lib/date';

/* ------------------------------------------------------------------ */
/* Exact fractions (bigint)                                            */
/* ------------------------------------------------------------------ */

export interface Frac {
  n: bigint;
  d: bigint; // always > 0, gcd(n, d) = 1
}

const babs = (x: bigint) => (x < 0n ? -x : x);
function bgcd(a: bigint, b: bigint): bigint {
  a = babs(a);
  b = babs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

export function frac(n: bigint | number, d: bigint | number = 1n): Frac {
  let nn = BigInt(n);
  let dd = BigInt(d);
  if (dd === 0n) throw new Error('zero denominator');
  if (dd < 0n) {
    nn = -nn;
    dd = -dd;
  }
  const g = bgcd(nn, dd) || 1n;
  return { n: nn / g, d: dd / g };
}

export const fAdd = (a: Frac, b: Frac) => frac(a.n * b.d + b.n * a.d, a.d * b.d);
export const fSub = (a: Frac, b: Frac) => frac(a.n * b.d - b.n * a.d, a.d * b.d);
export const fMul = (a: Frac, b: Frac) => frac(a.n * b.n, a.d * b.d);
/** Returns null on division by zero. */
export const fDiv = (a: Frac, b: Frac): Frac | null => (b.n === 0n ? null : frac(a.n * b.d, a.d * b.n));
export const fEq = (a: Frac, b: Frac) => a.n === b.n && a.d === b.d;
export const fIsInt = (a: Frac) => a.d === 1n;
export function fToString(a: Frac): string {
  return a.d === 1n ? `${a.n}` : `${a.n}/${a.d}`;
}

/* ------------------------------------------------------------------ */
/* Tokens and parsing                                                  */
/* ------------------------------------------------------------------ */

export type Op = '+' | '-' | '*' | '/';
export type Token = { t: 'num'; tile: number } | { t: 'op'; op: Op } | { t: 'lp' } | { t: 'rp' };

export const OP_GLYPH: Record<Op, string> = { '+': '+', '-': '−', '*': '×', '/': '÷' };

export type ExprError =
  | 'empty'
  | 'incomplete' // ends where a number is still expected
  | 'unclosed' // a bracket is still open
  | 'extra-close' // a closing bracket with nothing to close
  | 'missing-op' // two operands side by side
  | 'missing-number' // operator or bracket where a number belongs
  | 'reused' // a tile used twice
  | 'bad-tile' // tile index out of range
  | 'divzero';

export const ERROR_TEXT: Record<ExprError, string> = {
  empty: 'Tap numbers and signs to build a sum',
  incomplete: 'Keep going…',
  unclosed: 'Close the bracket',
  'extra-close': 'That bracket has nothing to close',
  'missing-op': 'Put a sign between numbers',
  'missing-number': 'Each sign needs a number on both sides',
  reused: 'Each number can be used once',
  'bad-tile': 'Unknown number',
  divzero: "Can't divide by zero",
};

export type EvalResult = { ok: true; value: Frac } | { ok: false; error: ExprError };

type Node = { k: 'num'; tile: number } | { k: 'bin'; op: Op; l: Node; r: Node };

class ParseFail {
  constructor(public error: ExprError) {}
}

/** Recursive-descent parser: expr := term (('+'|'-') term)*, term := factor (('*'|'/') factor)*, factor := num | '(' expr ')'. */
function parse(tokens: readonly Token[]): Node {
  let i = 0;
  const peek = () => tokens[i];

  const factor = (): Node => {
    const tok = peek();
    if (!tok) throw new ParseFail('incomplete');
    if (tok.t === 'num') {
      i++;
      return { k: 'num', tile: tok.tile };
    }
    if (tok.t === 'lp') {
      i++;
      const inner = expr();
      const close = peek();
      if (!close) throw new ParseFail('unclosed');
      if (close.t !== 'rp') throw new ParseFail('missing-op');
      i++;
      return inner;
    }
    throw new ParseFail('missing-number');
  };

  const term = (): Node => {
    let node = factor();
    for (let tok = peek(); tok && tok.t === 'op' && (tok.op === '*' || tok.op === '/'); tok = peek()) {
      i++;
      node = { k: 'bin', op: tok.op, l: node, r: factor() };
    }
    return node;
  };

  const expr = (): Node => {
    let node = term();
    for (let tok = peek(); tok && tok.t === 'op' && (tok.op === '+' || tok.op === '-'); tok = peek()) {
      i++;
      node = { k: 'bin', op: tok.op, l: node, r: term() };
    }
    return node;
  };

  const root = expr();
  const rest = peek();
  if (rest) throw new ParseFail(rest.t === 'rp' ? 'extra-close' : 'missing-op');
  return root;
}

function evalNode(node: Node, values: readonly number[]): Frac | null {
  if (node.k === 'num') return frac(values[node.tile]);
  const l = evalNode(node.l, values);
  if (!l) return null;
  const r = evalNode(node.r, values);
  if (!r) return null;
  switch (node.op) {
    case '+':
      return fAdd(l, r);
    case '-':
      return fSub(l, r);
    case '*':
      return fMul(l, r);
    case '/':
      return fDiv(l, r);
  }
}

/** Parse and evaluate a token list against the tile values. */
export function evaluate(tokens: readonly Token[], values: readonly number[]): EvalResult {
  if (tokens.length === 0) return { ok: false, error: 'empty' };
  const seen = new Set<number>();
  for (const tok of tokens) {
    if (tok.t !== 'num') continue;
    if (!Number.isInteger(tok.tile) || tok.tile < 0 || tok.tile >= values.length) return { ok: false, error: 'bad-tile' };
    if (seen.has(tok.tile)) return { ok: false, error: 'reused' };
    seen.add(tok.tile);
  }
  let tree: Node;
  try {
    tree = parse(tokens);
  } catch (e) {
    if (e instanceof ParseFail) return { ok: false, error: e.error };
    throw e;
  }
  const value = evalNode(tree, values);
  return value ? { ok: true, value } : { ok: false, error: 'divzero' };
}

/** Tile indices currently used by an expression. */
export function usedTiles(tokens: readonly Token[]): Set<number> {
  const s = new Set<number>();
  for (const tok of tokens) if (tok.t === 'num') s.add(tok.tile);
  return s;
}

/** Append a token if allowed by the one hard rule (a tile can't be used twice). */
export function pushToken(tokens: readonly Token[], tok: Token, tileCount: number): Token[] {
  if (tok.t === 'num') {
    if (tok.tile < 0 || tok.tile >= tileCount || usedTiles(tokens).has(tok.tile)) return tokens as Token[];
  }
  return [...tokens, tok];
}

export const popToken = (tokens: readonly Token[]): Token[] => tokens.slice(0, -1);

export function tokensToString(tokens: readonly Token[], values: readonly number[]): string {
  return tokens
    .map((tok) => (tok.t === 'num' ? String(values[tok.tile]) : tok.t === 'op' ? OP_GLYPH[tok.op] : tok.t === 'lp' ? '(' : ')'))
    .join(' ')
    .replace(/\( /g, '(')
    .replace(/ \)/g, ')');
}

/** Is this expression a valid hit on the target? */
export function hitsTarget(tokens: readonly Token[], values: readonly number[], target: number): boolean {
  const r = evaluate(tokens, values);
  return r.ok && fEq(r.value, frac(target));
}

/* ------------------------------------------------------------------ */
/* Solver (rational, exhaustive pairwise combination)                  */
/* ------------------------------------------------------------------ */

/** Small number rational used by the solver: plain doubles kept exact by bounding magnitude. */
interface Q {
  n: number;
  d: number;
}
const gcd = (a: number, b: number): number => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};
/** Bound that keeps every product of two stored parts below 2^53. */
const Q_LIMIT = 1e7;
function q(n: number, d: number): Q | null {
  if (d === 0) return null;
  if (d < 0) {
    n = -n;
    d = -d;
  }
  const g = gcd(n, d) || 1;
  n /= g;
  d /= g;
  if (Math.abs(n) > Q_LIMIT || d > Q_LIMIT) return null;
  return { n, d };
}

interface Item {
  v: Q;
  /** Token list producing v. */
  toks: Token[];
  /** Precedence of the top-level operator: 3 atom, 2 × ÷, 1 + −. */
  prec: number;
}

function wrap(it: Item): Token[] {
  return [{ t: 'lp' }, ...it.toks, { t: 'rp' }];
}

/** Combine two items with an op, adding only the brackets precedence requires. */
function combine(a: Item, b: Item, op: Op): Item | null {
  let v: Q | null;
  switch (op) {
    case '+':
      v = q(a.v.n * b.v.d + b.v.n * a.v.d, a.v.d * b.v.d);
      break;
    case '-':
      v = q(a.v.n * b.v.d - b.v.n * a.v.d, a.v.d * b.v.d);
      break;
    case '*':
      v = q(a.v.n * b.v.n, a.v.d * b.v.d);
      break;
    case '/':
      v = b.v.n === 0 ? null : q(a.v.n * b.v.d, a.v.d * b.v.n);
      break;
  }
  if (!v) return null;
  const prec = op === '+' || op === '-' ? 1 : 2;
  const left = a.prec < prec ? wrap(a) : a.toks;
  // Right side needs brackets if lower precedence, or equal precedence under − or ÷.
  const right = b.prec < prec || (b.prec === prec && (op === '-' || op === '/')) ? wrap(b) : b.toks;
  return { v, toks: [...left, { t: 'op', op }, ...right], prec };
}

interface Entry {
  v: Q;
  /** Backpointer: the two sub-results and operator that produced this value (absent for a single tile). */
  from?: { a: number; ak: string; b: number; bk: string; op: Op };
}

const popcount = (m: number) => {
  let c = 0;
  for (; m; m &= m - 1) c++;
  return c;
};

/**
 * Exhaustive dynamic programme over tile subsets: for every subset (smallest
 * first, up to `maxSize` tiles) the set of exact rational values an expression
 * using EXACTLY those tiles can take. Every binary expression splits its tiles
 * into two disjoint non-empty halves, so combining each split with + − × ÷
 * (both orders for − and ÷) enumerates all of them. Stops early once
 * `stopAt` (an integer target) is found.
 */
function subsetValues(values: readonly number[], maxSize: number, stopAt?: number): { byMask: Map<number, Map<string, Entry>>; hit?: { mask: number; key: string } } {
  const n = values.length;
  const byMask = new Map<number, Map<string, Entry>>();
  const masks: number[] = [];
  for (let m = 1; m < 1 << n; m++) if (popcount(m) <= maxSize) masks.push(m);
  masks.sort((a, b) => popcount(a) - popcount(b) || a - b);
  const goal = stopAt === undefined ? undefined : `${stopAt}/1`;
  for (const m of masks) {
    const out = new Map<string, Entry>();
    if (popcount(m) === 1) {
      const v = values[31 - Math.clz32(m)];
      out.set(`${v}/1`, { v: { n: v, d: 1 } });
    } else {
      for (let s = (m - 1) & m; s > 0; s = (s - 1) & m) {
        const t = m ^ s;
        if (s < t) continue; // each unordered split once; ops below cover both orders
        const A = byMask.get(s)!;
        const B = byMask.get(t)!;
        for (const [ak, ea] of A) {
          const a = ea.v;
          for (const [bk, eb] of B) {
            const b = eb.v;
            const add = (c: Q | null, op: Op, swap: boolean) => {
              if (!c) return;
              const k = `${c.n}/${c.d}`;
              if (out.has(k)) return;
              out.set(k, { v: c, from: swap ? { a: t, ak: bk, b: s, bk: ak, op } : { a: s, ak, b: t, bk, op } });
            };
            add(q(a.n * b.d + b.n * a.d, a.d * b.d), '+', false);
            add(q(a.n * b.n, a.d * b.d), '*', false);
            add(q(a.n * b.d - b.n * a.d, a.d * b.d), '-', false);
            add(q(b.n * a.d - a.n * b.d, a.d * b.d), '-', true);
            if (b.n !== 0) add(q(a.n * b.d, a.d * b.n), '/', false);
            if (a.n !== 0) add(q(b.n * a.d, b.d * a.n), '/', true);
          }
        }
      }
    }
    byMask.set(m, out);
    if (goal && out.has(goal)) return { byMask, hit: { mask: m, key: goal } };
  }
  return { byMask };
}

function rebuild(byMask: Map<number, Map<string, Entry>>, mask: number, key: string): Item {
  const e = byMask.get(mask)!.get(key)!;
  if (!e.from) return { v: e.v, toks: [{ t: 'num', tile: 31 - Math.clz32(mask) }], prec: 3 };
  const { a, ak, b, bk, op } = e.from;
  return combine(rebuild(byMask, a, ak), rebuild(byMask, b, bk), op)!;
}

/**
 * Exhaustive search for an expression over the given tiles equal to `target`,
 * using as few tiles as possible. Returns a token list (indices into `values`)
 * or null if unreachable. Exact rational arithmetic; parts are bounded at 1e7
 * (far beyond anything these tiles need) so doubles stay exact.
 */
export function solve(values: readonly number[], target: number): Token[] | null {
  const { byMask, hit } = subsetValues(values, values.length, target);
  return hit ? rebuild(byMask, hit.mask, hit.key).toks : null;
}

/** Every value (as "n/d" keys) reachable using at most `maxSize` tiles. */
export function reachableWithAtMost(values: readonly number[], maxSize: number): Set<string> {
  const all = new Set<string>();
  for (const out of subsetValues(values, maxSize).byMask.values()) for (const k of out.keys()) all.add(k);
  return all;
}

/** Fewest tiles needed to hit the target (searching up to `cap`); cap + 1 if none found within cap. */
export function minTilesNeeded(values: readonly number[], target: number, cap: number): number {
  for (let size = 1; size <= cap; size++) {
    if (reachableWithAtMost(values, size).has(`${target}/1`)) return size;
  }
  return cap + 1;
}

/* ------------------------------------------------------------------ */
/* Daily puzzle                                                        */
/* ------------------------------------------------------------------ */

export interface Round {
  label: string;
  tiles: number[];
  target: number;
  /** One verified solution, shown only after the day is finished. */
  solution: Token[];
}

export interface Puzzle {
  date: EditionDate;
  rounds: Round[];
}

interface RoundSpec {
  label: string;
  small: number; // how many 1–10 tiles
  mid: number; // 11–20 tiles
  big: number; // 25/50/75/100 tiles
  min: number;
  max: number;
  /** Target must NOT be reachable with fewer than this many tiles. */
  minTiles: number;
  /** Solution expression size range (tiles used). */
  useMin: number;
  useMax: number;
}

export const ROUND_SPECS: RoundSpec[] = [
  { label: 'Warm-up', small: 4, mid: 1, big: 0, min: 20, max: 99, minTiles: 3, useMin: 3, useMax: 3 },
  { label: 'Steady', small: 5, mid: 0, big: 1, min: 100, max: 299, minTiles: 3, useMin: 3, useMax: 4 },
  { label: 'Stretch', small: 4, mid: 0, big: 2, min: 300, max: 999, minTiles: 4, useMin: 4, useMax: 5 },
];

const BIGS = [25, 50, 75, 100];

function drawTiles(rng: Rng, spec: RoundSpec): number[] {
  const tiles: number[] = [];
  // Small numbers: at most two of any value, like a real deck.
  const counts = new Map<number, number>();
  while (tiles.length < spec.small) {
    const v = rng.int(1, 10);
    if ((counts.get(v) ?? 0) >= 2) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
    tiles.push(v);
  }
  const mids = rng.shuffle([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]).slice(0, spec.mid);
  const bigs = rng.shuffle(BIGS).slice(0, spec.big);
  return [...tiles.sort((a, b) => a - b), ...mids, ...bigs.sort((a, b) => a - b)];
}

/** Build a random integer-only expression over a random subset; returns its value and tokens. */
function randomExpression(rng: Rng, values: readonly number[], size: number): Item | null {
  const picks = rng.shuffle(values.map((_, i) => i)).slice(0, size);
  let pool: Item[] = picks.map((tile) => ({ v: { n: values[tile], d: 1 }, toks: [{ t: 'num', tile }], prec: 3 }));
  while (pool.length > 1) {
    pool = rng.shuffle(pool);
    const a = pool.pop()!;
    const b = pool.pop()!;
    const [hi, lo] = a.v.n >= b.v.n ? [a, b] : [b, a];
    const options: Op[] = ['+', '*', '*'];
    if (hi.v.n - lo.v.n > 0) options.push('-', '-');
    if (lo.v.n > 1 && hi.v.n % lo.v.n === 0) options.push('/', '/');
    const op = rng.pick(options);
    // Avoid trivial ×1 steps, which make tiles pointless.
    if (op === '*' && (lo.v.n === 1 || hi.v.n === 1)) return null;
    const c = op === '-' || op === '/' ? combine(hi, lo, op) : combine(a, b, op);
    if (!c) return null;
    pool.push(c);
  }
  return pool[0];
}

function makeRound(rng: Rng, spec: RoundSpec): Round {
  for (;;) {
    const tiles = drawTiles(rng, spec);
    for (let attempt = 0; attempt < 60; attempt++) {
      const size = rng.int(spec.useMin, spec.useMax);
      const e = randomExpression(rng, tiles, size);
      if (!e || e.v.d !== 1) continue;
      const target = e.v.n;
      if (target < spec.min || target > spec.max) continue;
      if (minTilesNeeded(tiles, target, spec.minTiles - 1) < spec.minTiles) continue;
      return { label: spec.label, tiles, target, solution: e.toks };
    }
  }
}

export function generatePuzzle(date: EditionDate): Puzzle {
  const rng = createRng(`sumwise:v1:${date}`);
  return { date, rounds: ROUND_SPECS.map((spec) => makeRound(rng, spec)) };
}

/* ------------------------------------------------------------------ */
/* Play state                                                          */
/* ------------------------------------------------------------------ */

export type Outcome = 'hit' | 'skipped';

export interface State {
  /** Index of the round being played; equals rounds.length when the day is done. */
  round: number;
  /** Draft expression per round (the winning expression once hit). */
  exprs: Token[][];
  outcomes: (Outcome | null)[];
}

export const initialState = (rounds: number): State => ({
  round: 0,
  exprs: Array.from({ length: rounds }, () => []),
  outcomes: Array.from({ length: rounds }, () => null),
});

export const isDone = (s: State) => s.round >= s.outcomes.length;

export function finishRound(s: State, outcome: Outcome): State {
  if (isDone(s)) return s;
  const outcomes = s.outcomes.slice();
  outcomes[s.round] = outcome;
  return { ...s, outcomes, round: s.round + 1 };
}

export function setExpr(s: State, tokens: Token[]): State {
  if (isDone(s)) return s;
  const exprs = s.exprs.slice();
  exprs[s.round] = tokens;
  return { ...s, exprs };
}

export const hits = (s: State) => s.outcomes.filter((o) => o === 'hit').length;

export function resultFor(s: State): { score: string; grid: string[] } {
  return {
    score: `${hits(s)}/${s.outcomes.length} targets`,
    grid: [s.outcomes.map((o) => (o === 'hit' ? '🎯' : '⬜')).join('')],
  };
}

/** A finished day counts as won with at least two of three targets hit. */
export const isWin = (s: State) => hits(s) * 3 >= s.outcomes.length * 2;
