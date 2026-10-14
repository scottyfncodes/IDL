/**
 * Wordsteps — a daily word ladder. Pure rules and generation, no React.
 *
 * Change one letter at a time (same position) from START to END. Every rung
 * must be a word and no word may repeat. Par is the shortest ladder that uses
 * only common words; the player has par + EXTRA_MOVES moves to get there.
 */
import common4 from '../../../content/words/common4.json';
import valid4 from '../../../content/words/valid4.json';
import { createRng, type Rng } from '../../../lib/rng';
import type { EditionDate } from '../../../lib/date';

export const WORD_LENGTH = 4;
export const MIN_PAR = 4;
export const MAX_PAR = 6;
/** Moves allowed beyond par before the ladder runs out. */
export const EXTRA_MOVES = 4;

export const COMMON_WORDS: readonly string[] = (common4 as { words: string[] }).words;
const VALID_WORDS: readonly string[] = (valid4 as { words: string[] }).words;

/** Every accepted word: union of the common and the full list. */
export const DICTIONARY: ReadonlySet<string> = new Set([...COMMON_WORDS, ...VALID_WORDS]);
const COMMON_SET: ReadonlySet<string> = new Set(COMMON_WORDS);

/** Common words we'd rather not feature in a published ladder (still accepted as player steps). */
export const EXCLUDED_FROM_PUZZLES: ReadonlySet<string> = new Set([
  'poop', 'damn', 'hell', 'nude', 'sexy', 'dope', 'scum', 'dumb', 'hump', 'lewd', 'smut', 'puke', 'snot', 'jerk',
]);
/** Words a generated puzzle may use for its endpoints and par path. */
export const PUZZLE_WORDS: readonly string[] = COMMON_WORDS.filter((w) => !EXCLUDED_FROM_PUZZLES.has(w));

export interface Puzzle {
  date: EditionDate;
  start: string;
  end: string;
  /** Shortest number of moves using common words only. */
  par: number;
  /** One shortest ladder, start…end inclusive (common words only). */
  solution: string[];
}

export interface State {
  /** Words entered after START, in order. moves = ladder.length. */
  ladder: string[];
}

export type StepError = 'length' | 'one-letter' | 'not-word' | 'used';

export const STEP_MESSAGES: Record<StepError, string> = {
  length: 'Use all four letters',
  'one-letter': 'Change exactly one letter',
  'not-word': 'Not in the word list',
  used: 'Already used',
};

/** Index of the single changed letter, or -1 if the words don't differ by exactly one letter in place. */
export function changedIndex(a: string, b: string): number {
  if (a.length !== b.length) return -1;
  let idx = -1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      if (idx !== -1) return -1;
      idx = i;
    }
  }
  return idx;
}

export const isOneLetterApart = (a: string, b: string) => changedIndex(a, b) !== -1;

export const isWord = (w: string, dict: ReadonlySet<string> = DICTIONARY) => dict.has(w.toLowerCase());

/** Validate a candidate next rung. `used` contains every word already in the ladder (including START). */
export function validateStep(prev: string, next: string, used: readonly string[], dict: ReadonlySet<string> = DICTIONARY): StepError | null {
  const w = next.toLowerCase();
  if (w.length !== WORD_LENGTH || !/^[a-z]+$/.test(w)) return 'length';
  if (used.includes(w)) return 'used';
  if (!isOneLetterApart(prev, w)) return 'one-letter';
  if (!dict.has(w)) return 'not-word';
  return null;
}

// ---------- Graph ----------

export type Graph = Map<string, string[]>;

/** Build a one-letter-change neighbour graph via wildcard buckets (O(n·L)). */
export function buildGraph(words: readonly string[]): Graph {
  const buckets = new Map<string, string[]>();
  for (const w of words) {
    for (let i = 0; i < w.length; i++) {
      const key = `${w.slice(0, i)}_${w.slice(i + 1)}`;
      const b = buckets.get(key);
      if (b) b.push(w);
      else buckets.set(key, [w]);
    }
  }
  const graph: Graph = new Map();
  for (const w of words) {
    const out: string[] = [];
    for (let i = 0; i < w.length; i++) {
      for (const n of buckets.get(`${w.slice(0, i)}_${w.slice(i + 1)}`) ?? []) if (n !== w) out.push(n);
    }
    graph.set(w, out);
  }
  return graph;
}

let commonGraph: Graph | undefined;
/** Lazily built neighbour graph over the puzzle words (common list minus exclusions). */
export function getCommonGraph(): Graph {
  if (!commonGraph) commonGraph = buildGraph(PUZZLE_WORDS);
  return commonGraph;
}

/** BFS from `start`; returns distances and parents for every reachable word. */
export function bfs(graph: Graph, start: string): { dist: Map<string, number>; parent: Map<string, string> } {
  const dist = new Map<string, number>([[start, 0]]);
  const parent = new Map<string, string>();
  const queue = [start];
  for (let qi = 0; qi < queue.length; qi++) {
    const w = queue[qi];
    const d = dist.get(w)!;
    for (const n of graph.get(w) ?? []) {
      if (!dist.has(n)) {
        dist.set(n, d + 1);
        parent.set(n, w);
        queue.push(n);
      }
    }
  }
  return { dist, parent };
}

/** Shortest path start…end inclusive, or null if unreachable. */
export function shortestPath(graph: Graph, start: string, end: string): string[] | null {
  const { parent, dist } = bfs(graph, start);
  if (!dist.has(end)) return null;
  const path = [end];
  while (path[path.length - 1] !== start) path.push(parent.get(path[path.length - 1])!);
  return path.reverse();
}

// ---------- Generation ----------

/** Endpoints should be well-connected (a proxy for familiar) and not look like plurals. */
function isGoodEndpoint(w: string, graph: Graph): boolean {
  return (graph.get(w)?.length ?? 0) >= 3 && !w.endsWith('s');
}

export function generatePuzzle(date: EditionDate, rng: Rng = createRng(`wordsteps:v1:${date}`)): Puzzle {
  const graph = getCommonGraph();
  const endpoints = PUZZLE_WORDS.filter((w) => isGoodEndpoint(w, graph));
  for (let attempt = 0; attempt < 500; attempt++) {
    const start = rng.pick(endpoints);
    const target = rng.int(MIN_PAR, MAX_PAR);
    const { dist, parent } = bfs(graph, start);
    const options = endpoints.filter((w) => dist.get(w) === target);
    if (options.length === 0) continue;
    const end = rng.pick(options);
    const solution = [end];
    while (solution[solution.length - 1] !== start) solution.push(parent.get(solution[solution.length - 1])!);
    solution.reverse();
    return { date, start, end, par: target, solution };
  }
  throw new Error(`wordsteps: no puzzle for ${date}`);
}

// ---------- Play ----------

export const maxMoves = (p: Puzzle) => p.par + EXTRA_MOVES;
export const currentWord = (p: Puzzle, s: State) => (s.ladder.length ? s.ladder[s.ladder.length - 1] : p.start);
export const isSolved = (p: Puzzle, s: State) => currentWord(p, s) === p.end;
export const isOutOfMoves = (p: Puzzle, s: State) => !isSolved(p, s) && s.ladder.length >= maxMoves(p);
export const status = (p: Puzzle, s: State): 'playing' | 'won' | 'lost' => (isSolved(p, s) ? 'won' : isOutOfMoves(p, s) ? 'lost' : 'playing');

/** Apply a step. Returns the new state or an error. No moves after the game ends. */
export function applyStep(p: Puzzle, s: State, word: string): { state: State } | { error: StepError | 'over' } {
  if (status(p, s) !== 'playing') return { error: 'over' };
  const w = word.toLowerCase();
  const err = validateStep(currentWord(p, s), w, [p.start, ...s.ladder]);
  if (err) return { error: err };
  return { state: { ladder: [...s.ladder, w] } };
}

export function undoStep(p: Puzzle, s: State): State {
  if (status(p, s) !== 'playing' || s.ladder.length === 0) return s;
  return { ladder: s.ladder.slice(0, -1) };
}

export function scoreText(p: Puzzle, s: State): string {
  return isSolved(p, s) ? `Solved in ${s.ladder.length} · par ${p.par}` : `Unsolved · par ${p.par}`;
}

export function resultGrid(p: Puzzle, s: State): string {
  const cells = s.ladder.map((_, i) => (i < p.par ? '🟩' : '🟨')).join('');
  return isSolved(p, s) ? cells : `${cells}✖️`;
}

export const isCommon = (w: string) => COMMON_SET.has(w);
