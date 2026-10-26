/**
 * Couplet: lay every domino on the board so each region's rule holds.
 *
 * Puzzles are built solution-first: grow a board out of placed dominoes,
 * assign distinct dominoes from a double-six set, carve the cells into regions
 * whose rules are read off that solution, then loosen rules one at a time,
 * keeping a loosening only while an exhaustive solver still proves the board
 * has exactly one solution. Difficulty is measured by how much branching that
 * solver needs, so an easy board can be solved by pure forced moves and a hard
 * one needs real look-ahead.
 *
 * Everything here is pure and deterministic for a given seed.
 */
import { createRng, type Rng } from '../../../lib/rng';
import type { EditionDate } from '../../../lib/date';

export type Tier = 'easy' | 'medium' | 'hard';
export const TIERS: Tier[] = ['easy', 'medium', 'hard'];
export const TIER_LABEL: Record<Tier, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export type Rule =
  | { kind: 'sum'; n: number }
  | { kind: 'lt'; n: number }
  | { kind: 'gt'; n: number }
  | { kind: 'eq' }
  | { kind: 'ne' };

export interface Region {
  /** Cell indices (r * w + c). */
  cells: number[];
  rule: Rule;
}

/** A domino's two pip values. Stored low-high; a double has both equal. */
export type Domino = readonly [number, number];

/** Domino `d` with its first value on cell `a` and its second on cell `b`. */
export interface Placement {
  d: number;
  a: number;
  b: number;
}

export interface Board {
  w: number;
  h: number;
  /** Cells that are part of the board, ascending. */
  cells: number[];
  /** Constrained regions. Board cells in no region are free. */
  regions: Region[];
  /** The tray, in display order. */
  dominoes: Domino[];
  /** The unique solution, one placement per domino (index = domino). */
  solution: Placement[];
}

export interface Puzzle {
  date: EditionDate;
}

export const MAX_PIP = 6;

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export function ruleLabel(rule: Rule): string {
  switch (rule.kind) {
    case 'sum':
      return String(rule.n);
    case 'lt':
      return `<${rule.n}`;
    case 'gt':
      return `>${rule.n}`;
    case 'eq':
      return '=';
    case 'ne':
      return '≠';
  }
}

export function ruleDescription(rule: Rule): string {
  switch (rule.kind) {
    case 'sum':
      return `adds up to ${rule.n}`;
    case 'lt':
      return `adds up to less than ${rule.n}`;
    case 'gt':
      return `adds up to more than ${rule.n}`;
    case 'eq':
      return 'all the same number';
    case 'ne':
      return 'all different numbers';
  }
}

/** Does a fully filled region satisfy its rule? */
export function ruleHolds(rule: Rule, values: number[]): boolean {
  const sum = values.reduce((s, v) => s + v, 0);
  switch (rule.kind) {
    case 'sum':
      return sum === rule.n;
    case 'lt':
      return sum < rule.n;
    case 'gt':
      return sum > rule.n;
    case 'eq':
      return values.every((v) => v === values[0]);
    case 'ne':
      return new Set(values).size === values.length;
  }
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

export function neighbours(w: number, h: number, i: number): number[] {
  const r = Math.floor(i / w);
  const c = i % w;
  const out: number[] = [];
  if (c + 1 < w) out.push(i + 1);
  if (r + 1 < h) out.push(i + w);
  if (c > 0) out.push(i - 1);
  if (r > 0) out.push(i - w);
  return out;
}

export function adjacent(w: number, a: number, b: number): boolean {
  if (a === b) return false;
  const ra = Math.floor(a / w);
  const rb = Math.floor(b / w);
  if (ra === rb) return Math.abs(a - b) === 1;
  return Math.abs(ra - rb) === 1 && a % w === b % w;
}

// ---------------------------------------------------------------------------
// Board state helpers (used by the UI and by validation)
// ---------------------------------------------------------------------------

/** Value on each cell given a set of placements (-1 where uncovered). */
export function cellValues(board: Board, placements: Placement[]): number[] {
  const vals = new Array<number>(board.w * board.h).fill(-1);
  for (const p of placements) {
    const [x, y] = board.dominoes[p.d];
    vals[p.a] = x;
    vals[p.b] = y;
  }
  return vals;
}

export type RegionStatus = 'open' | 'met' | 'broken';

/** Status of each region: 'met' / 'broken' only once every cell is covered. */
export function regionStatuses(board: Board, placements: Placement[]): RegionStatus[] {
  const vals = cellValues(board, placements);
  return board.regions.map((reg) => {
    const vs = reg.cells.map((c) => vals[c]);
    if (vs.some((v) => v < 0)) return 'open';
    return ruleHolds(reg.rule, vs) ? 'met' : 'broken';
  });
}

/**
 * Independent check that `placements` solves `board`. Shares no code with the
 * solver: every domino used exactly once, halves on adjacent board cells, no
 * overlaps, every cell covered, every region's rule met.
 */
export function isSolved(board: Board, placements: Placement[]): boolean {
  return solutionProblems(board, placements).length === 0;
}

export function solutionProblems(board: Board, placements: Placement[]): string[] {
  const problems: string[] = [];
  const onBoard = new Set(board.cells);
  const covered = new Map<number, number>();
  const used = new Set<number>();
  for (const p of placements) {
    if (p.d < 0 || p.d >= board.dominoes.length) problems.push(`unknown domino ${p.d}`);
    if (used.has(p.d)) problems.push(`domino ${p.d} used twice`);
    used.add(p.d);
    if (!onBoard.has(p.a) || !onBoard.has(p.b)) problems.push(`domino ${p.d} off the board`);
    if (!adjacent(board.w, p.a, p.b)) problems.push(`domino ${p.d} halves not adjacent`);
    for (const c of [p.a, p.b]) {
      if (covered.has(c)) problems.push(`cell ${c} covered twice`);
      covered.set(c, p.d);
    }
  }
  if (used.size !== board.dominoes.length) problems.push(`${board.dominoes.length - used.size} dominoes not placed`);
  for (const c of board.cells) if (!covered.has(c)) problems.push(`cell ${c} uncovered`);
  if (problems.length) return problems;
  const vals = cellValues(board, placements);
  board.regions.forEach((reg, i) => {
    if (!ruleHolds(reg.rule, reg.cells.map((c) => vals[c]))) problems.push(`region ${i} (${ruleLabel(reg.rule)}) not met`);
  });
  return problems;
}

/** Structural sanity of a board, independent of the solver. */
export function boardProblems(board: Board): string[] {
  const problems: string[] = [];
  const { w, h, cells } = board;
  if (cells.length === 0 || cells.length % 2) problems.push('cell count must be even and non-zero');
  if (cells.length !== board.dominoes.length * 2) problems.push('cells do not match domino count');
  const onBoard = new Set(cells);
  if (onBoard.size !== cells.length) problems.push('duplicate cells');
  for (const c of cells) if (c < 0 || c >= w * h) problems.push(`cell ${c} outside grid`);
  // Connected board.
  const seen = new Set<number>([cells[0]]);
  const stack = [cells[0]];
  while (stack.length) {
    const c = stack.pop()!;
    for (const n of neighbours(w, h, c)) if (onBoard.has(n) && !seen.has(n)) {
        seen.add(n);
        stack.push(n);
      }
  }
  if (seen.size !== cells.length) problems.push('board is not connected');
  // Dominoes: valid pips, no repeats.
  const keys = new Set<string>();
  for (const [x, y] of board.dominoes) {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x > MAX_PIP || y > MAX_PIP) problems.push(`bad domino ${x}|${y}`);
    const k = `${Math.min(x, y)}|${Math.max(x, y)}`;
    if (keys.has(k)) problems.push(`duplicate domino ${k}`);
    keys.add(k);
  }
  // Regions: disjoint, on the board, non-empty, connected.
  const inRegion = new Set<number>();
  board.regions.forEach((reg, i) => {
    if (reg.cells.length === 0) problems.push(`region ${i} empty`);
    for (const c of reg.cells) {
      if (!onBoard.has(c)) problems.push(`region ${i} has off-board cell ${c}`);
      if (inRegion.has(c)) problems.push(`cell ${c} in two regions`);
      inRegion.add(c);
    }
    const rs = new Set(reg.cells);
    const s = new Set([reg.cells[0]]);
    const st = [reg.cells[0]];
    while (st.length) {
      const c = st.pop()!;
      for (const n of neighbours(w, h, c)) if (rs.has(n) && !s.has(n)) {
        s.add(n);
        st.push(n);
      }
    }
    if (s.size !== rs.size) problems.push(`region ${i} not connected`);
    if ((reg.rule.kind === 'eq' || reg.rule.kind === 'ne') && reg.cells.length < 2) problems.push(`region ${i} ${reg.rule.kind} needs 2+ cells`);
  });
  problems.push(...solutionProblems(board, board.solution));
  return problems;
}

// ---------------------------------------------------------------------------
// Solver
// ---------------------------------------------------------------------------

export interface SolveStats {
  /**
   * Distinct solutions found (by the number on every cell), capped at the
   * limit. Pairings that differ but show the same numbers count once, and the
   * checker accepts either.
   */
  count: number;
  solutions: Placement[][];
  /** Search nodes visited. */
  nodes: number;
  /** Nodes where the most constrained choice still had 2+ options. */
  branches: number;
  /** True if the node budget ran out before the search finished. */
  aborted: boolean;
}

/**
 * Exhaustive search, most-constrained-first: at each node it lists every
 * feasible placement, then branches on whichever cell or domino has the fewest
 * options. A board a person can solve by forced moves alone shows zero
 * branches.
 */
export function solve(board: Board, limit = 2, maxNodes = 60000): SolveStats {
  const { w, h, dominoes, regions } = board;
  const size = w * h;
  const regionOf = new Int16Array(size).fill(-2);
  for (const c of board.cells) regionOf[c] = -1;
  regions.forEach((reg, i) => reg.cells.forEach((c) => (regionOf[c] = i)));
  const nbrs: number[][] = [];
  for (let i = 0; i < size; i++) nbrs.push(neighbours(w, h, i).filter((n) => regionOf[n] !== -2));

  const R = regions.length;
  const rSize = regions.map((r) => r.cells.length);
  const rSum = new Int16Array(R);
  const rCount = new Int16Array(R);
  const rFirst = new Int16Array(R).fill(-1); // first value seen (for eq)
  const rMask = new Int32Array(R); // values seen (for ne)
  const value = new Int8Array(size).fill(-1);
  const used = new Uint8Array(dominoes.length);
  const chosen: Placement[] = [];
  const stats: SolveStats = { count: 0, solutions: [], nodes: 0, branches: 0, aborted: false };
  const seen = new Set<string>();
  let uncovered = board.cells.length;

  // Bounds on the pip values still available, for sum pruning.
  const availRange = () => {
    let lo = MAX_PIP;
    let hi = 0;
    for (let d = 0; d < dominoes.length; d++) {
      if (used[d]) continue;
      const [x, y] = dominoes[d];
      lo = Math.min(lo, x, y);
      hi = Math.max(hi, x, y);
    }
    return [lo, hi] as const;
  };

  // Rules as flat arrays for the hot path: 0 sum, 1 lt, 2 gt, 3 eq, 4 ne.
  const KIND = { sum: 0, lt: 1, gt: 2, eq: 3, ne: 4 } as const;
  const rKind = Int8Array.from(regions, (r) => KIND[r.rule.kind]);
  const rN = Int16Array.from(regions, (r) => ('n' in r.rule ? r.rule.n : 0));

  // Would adding v1 (and v2, if k = 2) to region r keep it satisfiable?
  const feasible = (r: number, k: number, v1: number, v2: number, lo: number, hi: number): boolean => {
    const rem = rSize[r] - rCount[r] - k;
    const sum = rSum[r] + v1 + (k === 2 ? v2 : 0);
    switch (rKind[r]) {
      case 0:
        return sum + rem * lo <= rN[r] && sum + rem * hi >= rN[r];
      case 1:
        return sum + rem * lo < rN[r];
      case 2:
        return sum + rem * hi > rN[r];
      case 3: {
        const first = rFirst[r] >= 0 ? rFirst[r] : v1;
        return v1 === first && (k === 1 || v2 === first);
      }
      default: {
        const m = rMask[r];
        if (m & (1 << v1)) return false;
        return k === 1 || (v1 !== v2 && !(m & (1 << v2)));
      }
    }
  };

  const setCell = (c: number, v: number) => {
    value[c] = v;
    const r = regionOf[c];
    if (r >= 0) {
      rSum[r] += v;
      rCount[r]++;
      if (rFirst[r] < 0) rFirst[r] = v;
      rMask[r] |= 1 << v;
    }
  };
  const clearCell = (c: number) => {
    const v = value[c];
    value[c] = -1;
    const r = regionOf[c];
    if (r >= 0) {
      rSum[r] -= v;
      rCount[r]--;
      if (rCount[r] === 0) rFirst[r] = -1;
      // Only 'ne' relies on the mask, and 'ne' never holds a value twice.
      rMask[r] &= ~(1 << v);
    }
  };

  const search = (): void => {
    if (stats.count >= limit || stats.aborted) return;
    if (++stats.nodes > maxNodes) {
      stats.aborted = true;
      return;
    }
    if (uncovered === 0) {
      // Pairings that put the same number on every cell are the same answer to a player.
      const key = board.cells.map((c) => value[c]).join('');
      if (seen.has(key)) return;
      seen.add(key);
      stats.count++;
      if (stats.solutions.length < limit) stats.solutions.push(chosen.slice());
      return;
    }
    const remaining: number[] = [];
    for (let d = 0; d < dominoes.length; d++) if (!used[d]) remaining.push(d);
    // After this placement the pool shrinks, but bounds from the current pool are still valid (looser).
    const [lo, hi] = availRange();

    // Which values each open cell could take on its own (a cell's region alone).
    const okv = new Uint8Array(size * 7);
    for (const c of board.cells) {
      if (value[c] >= 0) continue;
      const r = regionOf[c];
      for (let v = 0; v <= MAX_PIP; v++) okv[c * 7 + v] = r < 0 || feasible(r, 1, v, 0, lo, hi) ? 1 : 0;
    }
    const pairOk = (a: number, va: number, b: number, vb: number) => {
      const ra = regionOf[a];
      if (ra >= 0 && ra === regionOf[b]) return feasible(ra, 2, va, vb, lo, hi);
      return okv[a * 7 + va] === 1 && okv[b * 7 + vb] === 1;
    };

    // Enumerate all feasible placements as flat (d, a, b) triples.
    const opts: number[] = [];
    const perCell = new Int16Array(size);
    const perDomino = new Int16Array(dominoes.length);
    for (const a of board.cells) {
      if (value[a] >= 0) continue;
      for (const b of nbrs[a]) {
        if (b < a || value[b] >= 0) continue;
        for (const d of remaining) {
          const [x, y] = dominoes[d];
          if (pairOk(a, x, b, y)) opts.push(d, a, b);
          if (x !== y && pairOk(a, y, b, x)) opts.push(d, b, a);
        }
      }
    }
    for (let i = 0; i < opts.length; i += 3) {
      perDomino[opts[i]]++;
      perCell[opts[i + 1]]++;
      perCell[opts[i + 2]]++;
    }
    // Most constrained cell or domino.
    let best = Infinity;
    let pickCell = -1;
    let pickD = -1;
    for (const c of board.cells) {
      if (value[c] >= 0) continue;
      if (perCell[c] < best) {
        best = perCell[c];
        pickCell = c;
        if (best === 0) break;
      }
    }
    if (best > 0) {
      for (const d of remaining) {
        if (perDomino[d] < best) {
          best = perDomino[d];
          pickCell = -1;
          pickD = d;
          if (best === 0) break;
        }
      }
    }
    if (best === 0) return;
    if (best > 1) stats.branches++;
    for (let i = 0; i < opts.length; i += 3) {
      const d = opts[i];
      const a = opts[i + 1];
      const b = opts[i + 2];
      if (pickCell >= 0 ? a !== pickCell && b !== pickCell : d !== pickD) continue;
      const [x, y] = dominoes[d];
      used[d] = 1;
      setCell(a, x);
      setCell(b, y);
      uncovered -= 2;
      chosen.push({ d, a, b });
      search();
      chosen.pop();
      uncovered += 2;
      clearCell(b);
      clearCell(a);
      used[d] = 0;
      if (stats.count >= limit || stats.aborted) return;
    }
  };

  search();
  return stats;
}

/** Two placement sets are the same solution (a double may lie either way round). */
export function samePlacements(board: Board, p: Placement[], q: Placement[]): boolean {
  const key = (x: Placement) => {
    const [v1, v2] = board.dominoes[x.d];
    const [a, b] = v1 === v2 ? [Math.min(x.a, x.b), Math.max(x.a, x.b)] : [x.a, x.b];
    return `${x.d}:${a}:${b}`;
  };
  const s = new Set(p.map(key));
  return p.length === q.length && q.every((x) => s.has(key(x)));
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

interface TierSpec {
  dominoes: [number, number];
  maxW: number;
  maxH: number;
  /** Weights for region sizes 1..5. */
  sizes: number[];
  /** Difficulty band (solver branches) the final board must land in. */
  band: [number, number];
  /** Share of loosening steps to attempt (0..1). */
  loosen: number;
  maxFree: number;
  /** Chance a multi-cell region is designed as "all equal". */
  eqShare: number;
  /** Most one-cell regions allowed: they read as givens, not deductions. */
  maxSingles: number;
  /** Least average cells per region. */
  minAvg: number;
  allow: { ineq: boolean; ne: boolean; free: boolean; merge: boolean };
}

const SPEC: Record<Tier, TierSpec> = {
  easy: { dominoes: [5, 6], maxW: 5, maxH: 5, sizes: [2, 6, 3, 0, 0], band: [0, 0], loosen: 0.35, maxFree: 2, maxSingles: 3, minAvg: 1.5, eqShare: 0.35, allow: { ineq: true, ne: false, free: true, merge: false } },
  medium: { dominoes: [8, 9], maxW: 6, maxH: 6, sizes: [1, 4, 5, 3, 1], band: [1, 6], loosen: 0.8, maxFree: 4, maxSingles: 4, minAvg: 1.7, eqShare: 0.45, allow: { ineq: true, ne: true, free: true, merge: true } },
  hard: { dominoes: [11, 12], maxW: 7, maxH: 6, sizes: [1, 3, 5, 4, 2], band: [12, 80], loosen: 1, maxFree: 6, maxSingles: 6, minAvg: 1.8, eqShare: 0.42, allow: { ineq: true, ne: true, free: true, merge: true } },
};

/** Grow a connected board out of placed dominoes inside a w×h box. */
function growTiling(rng: Rng, n: number, w: number, h: number): [number, number][] | null {
  const taken = new Set<number>();
  const pairs: [number, number][] = [];
  const start = Math.floor(h / 2) * w + Math.floor(w / 2) - 1;
  const second = start + 1;
  taken.add(start).add(second);
  pairs.push([start, second]);
  let guard = 0;
  while (pairs.length < n && guard++ < 400) {
    // Prefer growing into cells with more taken neighbours: compact, with the odd arm.
    const frontier: number[] = [];
    for (const c of taken) for (const x of neighbours(w, h, c)) if (!taken.has(x)) frontier.push(x);
    if (!frontier.length) return null;
    const scored = frontier.map((x) => ({ x, s: neighbours(w, h, x).filter((y) => taken.has(y)).length + rng.next() * 1.6 }));
    scored.sort((p, q) => q.s - p.s);
    const x = scored[Math.min(scored.length - 1, Math.floor(rng.next() * rng.next() * 4))].x;
    const ys = rng.shuffle(neighbours(w, h, x).filter((y) => !taken.has(y)));
    if (!ys.length) continue;
    const y = ys[0];
    taken.add(x).add(y);
    pairs.push(rng.chance(0.5) ? [x, y] : [y, x]);
  }
  return pairs.length === n ? pairs : null;
}

/** Trim the grid to the board's bounding box, remapping cell indices. */
function crop(w: number, h: number, pairs: [number, number][]): { w: number; h: number; map: (c: number) => number } {
  let r0 = h;
  let r1 = 0;
  let c0 = w;
  let c1 = 0;
  for (const p of pairs)
    for (const c of p) {
      const r = Math.floor(c / w);
      const cc = c % w;
      r0 = Math.min(r0, r);
      r1 = Math.max(r1, r);
      c0 = Math.min(c0, cc);
      c1 = Math.max(c1, cc);
    }
  const nw = c1 - c0 + 1;
  return { w: nw, h: r1 - r0 + 1, map: (c) => (Math.floor(c / w) - r0) * nw + (c % w) - c0 };
}

function weighted(rng: Rng, weights: number[]): number {
  const total = weights.reduce((s, x) => s + x, 0);
  let t = rng.next() * total;
  for (let i = 0; i < weights.length; i++) {
    t -= weights[i];
    if (t < 0) return i;
  }
  return weights.length - 1;
}

/**
 * Carve the bare tiling into regions and choose which ones will be "all
 * equal". Regions are designed before any numbers exist.
 */
function shapeRegions(rng: Rng, w: number, h: number, cells: number[], spec: TierSpec): { groups: number[][]; eq: boolean[] } {
  const onBoard = new Set(cells);
  const owner = new Set<number>();
  const groups: number[][] = [];
  const eq: boolean[] = [];
  for (const start of rng.shuffle(cells)) {
    if (owner.has(start)) continue;
    const target = weighted(rng, spec.sizes) + 1;
    const group = [start];
    owner.add(start);
    while (group.length < target) {
      const options: number[] = [];
      for (const c of group) for (const n of neighbours(w, h, c)) if (onBoard.has(n) && !owner.has(n) && !options.includes(n)) options.push(n);
      if (!options.length) break;
      const n = rng.pick(options);
      owner.add(n);
      group.push(n);
    }
    groups.push(group.sort((a, b) => a - b));
    eq.push(group.length > 1 && rng.chance(spec.eqShare));
  }
  return { groups, eq };
}

/**
 * Give every cell a pip value so each "equal" region really is equal and the
 * dominoes that result are all different. Randomised backtracking over the
 * tiling, one domino at a time.
 */
function assignValues(rng: Rng, size: number, pairs: [number, number][], groups: number[][], eq: boolean[], avoidBlanks: boolean): number[] | null {
  const groupOf = new Map<number, number>();
  groups.forEach((g, i) => g.forEach((c) => groupOf.set(c, i)));
  const fixed = new Array<number>(groups.length).fill(-1);
  const fixedBy = new Array<number>(groups.length).fill(-1);
  const vals = new Array<number>(size).fill(-1);
  const used = new Set<string>();
  const order = Array.from({ length: MAX_PIP + 1 }, (_, v) => v);
  let budget = 4000;
  const options = (c: number) => {
    const g = groupOf.get(c)!;
    if (eq[g] && fixed[g] >= 0) return [fixed[g]];
    const vs = rng.shuffle(order);
    return avoidBlanks ? vs.filter((v) => v > 0).concat(vs.includes(0) ? [0] : []) : vs;
  };
  const fix = (c: number, v: number, k: number) => {
    const g = groupOf.get(c)!;
    if (eq[g] && fixed[g] < 0) {
      fixed[g] = v;
      fixedBy[g] = k;
    }
    vals[c] = v;
  };
  const unfix = (c: number, k: number) => {
    const g = groupOf.get(c)!;
    if (fixedBy[g] === k) {
      fixed[g] = -1;
      fixedBy[g] = -1;
    }
    vals[c] = -1;
  };
  const go = (k: number): boolean => {
    if (k === pairs.length) return true;
    if (--budget < 0) return false;
    const [a, b] = pairs[k];
    for (const x of options(a)) {
      fix(a, x, k * 2);
      for (const y of options(b)) {
        // Same equal region on both halves: they must match.
        const ga = groupOf.get(a)!;
        if (eq[ga] && ga === groupOf.get(b) && y !== x) continue;
        const key = `${Math.min(x, y)}|${Math.max(x, y)}`;
        if (used.has(key)) continue;
        used.add(key);
        fix(b, y, k * 2 + 1);
        if (go(k + 1)) return true;
        unfix(b, k * 2 + 1);
        used.delete(key);
      }
      unfix(a, k * 2);
    }
    return false;
  };
  return go(0) ? vals : null;
}

type Loosen = (b: Board, rng: Rng) => Board | null;

const withRegions = (b: Board, regions: Region[]): Board => ({ ...b, regions });

function looseners(spec: TierSpec, vals: number[]): Loosen[] {
  const ops: Loosen[] = [];
  const pickRegion = (b: Board, rng: Rng, ok: (r: Region) => boolean) => {
    const idx = b.regions.map((r, i) => (ok(r) ? i : -1)).filter((i) => i >= 0);
    return idx.length ? rng.pick(idx) : -1;
  };
  if (spec.allow.ineq)
    ops.push((b, rng) => {
      const i = pickRegion(b, rng, (r) => r.rule.kind === 'sum');
      if (i < 0) return null;
      const reg = b.regions[i];
      const sum = (reg.rule as { n: number }).n;
      const max = reg.cells.length * MAX_PIP;
      const slack = rng.int(1, 2);
      let rule: Rule;
      if (sum - slack >= 0 && (sum + slack > max || rng.chance(0.5))) rule = { kind: 'gt', n: sum - slack };
      else if (sum + slack <= max) rule = { kind: 'lt', n: sum + slack };
      else return null;
      // Avoid rules that say nothing ("> -1", "< 13" on two cells).
      if (rule.kind === 'lt' && rule.n > max) return null;
      if (rule.kind === 'gt' && rule.n < 0) return null;
      const regions = b.regions.slice();
      regions[i] = { ...reg, rule };
      return withRegions(b, regions);
    });
  if (spec.allow.ne)
    ops.push((b, rng) => {
      const i = pickRegion(b, rng, (r) => r.rule.kind === 'sum' && r.cells.length >= 2 && new Set(r.cells.map((c) => vals[c])).size === r.cells.length);
      if (i < 0) return null;
      const regions = b.regions.slice();
      regions[i] = { ...regions[i], rule: { kind: 'ne' } };
      return withRegions(b, regions);
    });
  if (spec.allow.free)
    ops.push((b, rng) => {
      const free = b.cells.length - b.regions.reduce((s, r) => s + r.cells.length, 0);
      const i = pickRegion(b, rng, (r) => r.cells.length <= 2 && free + r.cells.length <= spec.maxFree);
      if (i < 0) return null;
      return withRegions(b, b.regions.filter((_, j) => j !== i));
    });
  if (spec.allow.merge)
    ops.push((b, rng) => {
      const i = pickRegion(b, rng, (r) => r.rule.kind === 'sum');
      if (i < 0) return null;
      const a = b.regions[i];
      const cellsA = new Set(a.cells);
      const partners = b.regions
        .map((r, j) => ({ r, j }))
        .filter(({ r, j }) => j !== i && r.rule.kind === 'sum' && a.cells.length + r.cells.length <= 5 && r.cells.some((c) => neighbours(b.w, b.h, c).some((n) => cellsA.has(n))));
      if (!partners.length) return null;
      const { r, j } = rng.pick(partners);
      const merged: Region = { cells: [...a.cells, ...r.cells].sort((x, y) => x - y), rule: { kind: 'sum', n: (a.rule as { n: number }).n + (r.rule as { n: number }).n } };
      return withRegions(b, [...b.regions.filter((_, k) => k !== i && k !== j), merged]);
    });
  return ops;
}

/** Split a region into connected pieces, each with an exact rule from the solution. */
function exactPieces(w: number, h: number, cells: number[], vals: number[]): Region[] {
  const left = new Set(cells);
  const out: Region[] = [];
  while (left.size) {
    const start = left.values().next().value as number;
    left.delete(start);
    const group = [start];
    for (let i = 0; i < group.length; i++)
      for (const n of neighbours(w, h, group[i]))
        if (left.has(n)) {
          left.delete(n);
          group.push(n);
        }
    const vs = group.map((c) => vals[c]);
    const allEq = group.length > 1 && vs.every((v) => v === vs[0]);
    out.push({ cells: group.sort((a, b) => a - b), rule: allEq ? { kind: 'eq' } : { kind: 'sum', n: vs.reduce((s, v) => s + v, 0) } });
  }
  return out;
}

/** Cells of `cells` reachable from `from` without leaving `cells`. */
function reach(w: number, h: number, cells: Set<number>, from: number): Set<number> {
  const seen = new Set([from]);
  const stack = [from];
  while (stack.length) {
    const c = stack.pop()!;
    for (const n of neighbours(w, h, c)) if (cells.has(n) && !seen.has(n)) {
      seen.add(n);
      stack.push(n);
    }
  }
  return seen;
}

/** Split `cells` into a connected piece grown from `from` (about half) and the rest. */
function bisect(w: number, h: number, cells: number[], from: number): [number[], number[]] {
  const all = new Set(cells);
  const half = new Set([from]);
  const target = Math.floor(cells.length / 2);
  for (const x of reach(w, h, all, from)) {
    if (half.size >= target) break;
    if (half.has(x) || ![...half].some((y) => adjacent(w, x, y))) continue;
    const rest = new Set([...all].filter((y) => !half.has(y) && y !== x));
    if (rest.size && reach(w, h, rest, rest.values().next().value as number).size === rest.size) half.add(x);
  }
  return [[...half], cells.filter((x) => !half.has(x))];
}

const singles = (b: Board) => b.regions.filter((r) => r.cells.length === 1).length;

/**
 * Add information until the board has one solution. Where a rival solution
 * disagrees, try each way of cutting an involved region in two (exact rules on
 * both halves) or folding an ambiguous free cell into a neighbour, and keep
 * the candidate that removes the most ambiguity per single-cell region spent.
 */
function tighten(board: Board, vals: number[], maxSingles: number): Board | null {
  const { w, h } = board;
  // Cheap comparisons: a small solution cap and node budget. Final uniqueness
  // is proved separately with the full budget.
  const CAP = 8;
  const NODES = 6000;
  let s = solve(board, CAP, NODES);
  for (let k = 0; k < 14; k++) {
    if (s.aborted) return null;
    if (s.count === 1) return board;
    const rival = s.solutions.find((p) => cellValues(board, p).some((v, c) => v >= 0 && v !== vals[c]));
    if (!rival) return null;
    const rv = cellValues(board, rival);
    const diff = board.cells.filter((c) => rv[c] !== vals[c]);
    const regionIdx = (c: number) => board.regions.findIndex((r) => r.cells.includes(c));
    const candidates: Board[] = [];
    const seenRegion = new Set<number>();
    for (const c of diff) {
      const i = regionIdx(c);
      if (i < 0) {
        for (let j = 0; j < board.regions.length; j++) {
          const r = board.regions[j];
          if (!r.cells.some((x) => adjacent(w, x, c)) || r.cells.length >= 5) continue;
          const regions = board.regions.slice();
          regions.splice(j, 1, ...exactPieces(w, h, [...r.cells, c], vals));
          candidates.push({ ...board, regions });
        }
        candidates.push({ ...board, regions: [...board.regions, { cells: [c], rule: { kind: 'sum', n: vals[c] } }] });
        continue;
      }
      const cells = board.regions[i].cells;
      if (cells.length === 1) continue;
      if (seenRegion.has(i) && cells.length <= 2) continue;
      seenRegion.add(i);
      const [a, b] = cells.length <= 2 ? [[c], cells.filter((x) => x !== c)] : bisect(w, h, cells, c);
      const regions = board.regions.slice();
      regions.splice(i, 1, ...exactPieces(w, h, a, vals), ...exactPieces(w, h, b, vals));
      candidates.push({ ...board, regions });
    }
    let best: { b: Board; s: SolveStats; score: number } | null = null;
    const base = singles(board);
    for (const cand of candidates.slice(0, 8)) {
      const spent = singles(cand) - base;
      if (singles(cand) > maxSingles) continue;
      const cs = solve(cand, CAP, NODES);
      if (cs.aborted) continue;
      const score = Math.log2(cs.count) + spent * 1.25;
      if (!best || score < best.score) best = { b: cand, s: cs, score };
      if (cs.count === 1 && spent <= 0) break;
    }
    if (!best) return null;
    board = best.b;
    s = best.s;
  }
  return s.count === 1 ? board : null;
}

/** Shape rules a finished board must meet: real regions, not a page of givens. */
function wellFormed(board: Board, spec: TierSpec): boolean {
  const singles = board.regions.filter((r) => r.cells.length === 1).length;
  const constrained = board.regions.reduce((s, r) => s + r.cells.length, 0);
  return singles <= spec.maxSingles && constrained / board.regions.length >= spec.minAvg;
}

function rate(board: Board): { unique: boolean; branches: number } {
  // Accepted boards need a few hundred nodes; anything near this budget is far
  // outside every tier's band, so stop early rather than finish the proof.
  const s = solve(board, 2, 3000);
  return { unique: s.count === 1 && !s.aborted, branches: s.branches };
}

/** One attempt at a board for a tier; null if this seed path fails. */
function attempt(rng: Rng, tier: Tier): { board: Board; branches: number } | null {
  const spec = SPEC[tier];
  const n = rng.int(spec.dominoes[0], spec.dominoes[1]);
  const raw = growTiling(rng, n, spec.maxW, spec.maxH);
  if (!raw) return null;
  const { w, h, map } = crop(spec.maxW, spec.maxH, raw);
  const pairs = raw.map(([a, b]) => [map(a), map(b)] as [number, number]);
  const cells = pairs.flat().sort((a, b) => a - b);

  const { groups, eq } = shapeRegions(rng, w, h, cells, spec);
  const vals = assignValues(rng, w * h, pairs, groups, eq, tier === 'easy');
  if (!vals) return null;
  // Tray dominoes stored low-high; each placement puts the low value on `a`.
  const dominoes: Domino[] = pairs.map(([a, b]) => [Math.min(vals[a], vals[b]), Math.max(vals[a], vals[b])]);
  const solution: Placement[] = pairs.map(([a, b], i) => (vals[a] <= vals[b] ? { d: i, a, b } : { d: i, a: b, b: a }));
  const regions: Region[] = groups.map((g, i) => {
    const vs = g.map((c) => vals[c]);
    return { cells: g, rule: eq[i] ? { kind: 'eq' } : { kind: 'sum', n: vs.reduce((t, v) => t + v, 0) } };
  });

  const carved = tighten({ w, h, cells, regions, dominoes, solution }, vals, spec.maxSingles);
  if (!carved) return null;
  let board = carved;
  let r = rate(board);
  if (!r.unique) return null;

  // Loosen while the board stays unique and within the tier's band.
  const ops = looseners(spec, vals);
  const steps = Math.round(board.regions.length * spec.loosen * 1.5);
  for (let k = 0; k < steps && ops.length; k++) {
    const next = rng.pick(ops)(board, rng);
    if (!next) continue;
    const nr = rate(next);
    if (nr.unique && nr.branches <= spec.band[1]) {
      board = next;
      r = nr;
    }
  }
  if (r.branches < spec.band[0] || r.branches > spec.band[1]) return null;
  if (!hasVariety(board, tier) || !wellFormed(board, spec)) return null;
  return { board: finish(board, rng), branches: r.branches };
}

/** Rule mix a tier must show, so boards don't all read the same. */
function hasVariety(board: Board, tier: Tier): boolean {
  const kinds = new Set(board.regions.map((r) => r.rule.kind));
  const ineq = kinds.has('lt') || kinds.has('gt');
  if (tier === 'easy') return kinds.has('sum') && board.regions.length >= 3;
  if (tier === 'medium') return kinds.has('sum') && (ineq || kinds.has('ne') || kinds.has('eq'));
  return kinds.has('sum') && ineq && (kinds.has('eq') || kinds.has('ne'));
}

/** Stable presentation order: regions top-to-bottom, tray shuffled. */
function finish(board: Board, rng: Rng): Board {
  const regions = board.regions.slice().sort((a, b) => a.cells[0] - b.cells[0]);
  const order = rng.shuffle(board.dominoes.map((_, i) => i));
  const dominoes = order.map((i) => board.dominoes[i]);
  const back = new Map(order.map((old, i) => [old, i]));
  const solution = board.solution.map((p) => ({ ...p, d: back.get(p.d)! })).sort((a, b) => a.d - b.d);
  return { ...board, regions, dominoes, solution };
}

export function generateBoard(seed: string, tier: Tier): Board {
  const rng = createRng(seed);
  for (let i = 0; i < 3000; i++) {
    const got = attempt(rng, tier);
    if (got) return got.board;
  }
  throw new Error(`couplet: no ${tier} board for ${seed}`);
}

export const GENERATOR_VERSION = 'v1';

const cache = new Map<string, Board>();

/** The day's board for a tier. Generated on first use, then kept in memory. */
export function boardFor(date: EditionDate, tier: Tier): Board {
  const key = `couplet:${GENERATOR_VERSION}:${date}:${tier}`;
  let b = cache.get(key);
  if (!b) {
    b = generateBoard(key, tier);
    cache.set(key, b);
  }
  return b;
}

/** Seed the memory cache with a board built elsewhere (worker or device cache). */
export function primeBoard(date: EditionDate, tier: Tier, board: Board) {
  cache.set(`couplet:${GENERATOR_VERSION}:${date}:${tier}`, board);
}

/** Boards are built per tier on demand, so the puzzle itself is just its date. */
export function getPuzzle(date: EditionDate): Puzzle {
  return { date };
}
