/**
 * Linkup rules: sixteen words, four hidden groups of four.
 * Pure logic only — no React.
 */
import { createRng } from '../../../lib/rng';
import { dayNumber, type EditionDate } from '../../../lib/date';

export type Level = 0 | 1 | 2 | 3;

export interface LinkupGroup {
  /** The connection, shown once the group is found. */
  label: string;
  words: string[];
  /** 0 = straightforward … 3 = trickiest (wordplay). */
  level: Level;
}

export interface LinkupPuzzle {
  id: string;
  groups: LinkupGroup[];
}

export interface LinkupState {
  /** Display order of every word (solved words are filtered out when drawn). */
  order: string[];
  /** Group indexes in the order they were solved. */
  solved: number[];
  /** Every distinct submitted guess, normalised and sorted. */
  guesses: string[][];
  mistakes: number;
}

export const GROUP_SIZE = 4;
export const GROUP_COUNT = 4;
export const MAX_MISTAKES = 4;
export const MAX_WORD_LENGTH = 12;

export const LEVEL_NAMES = ['Straightforward', 'Moderate', 'Tricky', 'Devious'] as const;
export const LEVEL_EMOJI = ['🟨', '🟩', '🟦', '🟪'] as const;

/** Canonical form for comparing words. */
export const wordKey = (w: string) => w.trim().toUpperCase();

export function allWords(puzzle: LinkupPuzzle): string[] {
  return puzzle.groups.flatMap((g) => g.words);
}

/** Pick the puzzle for a date from an append-only pool. */
export function puzzleFor(pool: readonly LinkupPuzzle[], date: EditionDate): LinkupPuzzle {
  const n = dayNumber(date);
  return pool[((n % pool.length) + pool.length) % pool.length];
}

/** Deterministic starting tile order for a date. */
export function initialOrder(puzzle: LinkupPuzzle, date: EditionDate): string[] {
  return createRng(`linkup:v1:${date}`).shuffle(allWords(puzzle));
}

export function initialState(puzzle: LinkupPuzzle, date: EditionDate): LinkupState {
  return { order: initialOrder(puzzle, date), solved: [], guesses: [], mistakes: 0 };
}

/** Reorder the unsolved tiles with a given seed. */
export function shuffleOrder(order: readonly string[], seed: number | string): string[] {
  return createRng(seed).shuffle(order);
}

/** Index of the group containing `word`, or -1. */
export function groupOf(puzzle: LinkupPuzzle, word: string): number {
  const k = wordKey(word);
  return puzzle.groups.findIndex((g) => g.words.some((w) => wordKey(w) === k));
}

export function remainingWords(puzzle: LinkupPuzzle, state: LinkupState): string[] {
  const solved = new Set(state.solved);
  return state.order.filter((w) => !solved.has(groupOf(puzzle, w)));
}

export type Status = 'playing' | 'won' | 'lost';

export function statusOf(state: LinkupState): Status {
  if (state.solved.length >= GROUP_COUNT) return 'won';
  if (state.mistakes >= MAX_MISTAKES) return 'lost';
  return 'playing';
}

export type Outcome =
  | { kind: 'correct'; group: number }
  | { kind: 'one-away' }
  | { kind: 'wrong' }
  | { kind: 'duplicate' }
  | { kind: 'invalid' };

const guessKey = (words: readonly string[]) => words.map(wordKey).sort();
const sameGuess = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((w, i) => w === b[i]);

/** Judge a selection without changing anything. */
export function evaluateGuess(puzzle: LinkupPuzzle, state: LinkupState, selection: readonly string[]): Outcome {
  if (statusOf(state) !== 'playing') return { kind: 'invalid' };
  const keys = guessKey(selection);
  if (keys.length !== GROUP_SIZE || new Set(keys).size !== GROUP_SIZE) return { kind: 'invalid' };
  const groups = keys.map((k) => groupOf(puzzle, k));
  if (groups.some((g) => g < 0 || state.solved.includes(g))) return { kind: 'invalid' };
  if (state.guesses.some((g) => sameGuess(g, keys))) return { kind: 'duplicate' };
  const counts = new Map<number, number>();
  for (const g of groups) counts.set(g, (counts.get(g) ?? 0) + 1);
  const best = Math.max(...counts.values());
  if (best === GROUP_SIZE) return { kind: 'correct', group: groups[0] };
  if (best === GROUP_SIZE - 1) return { kind: 'one-away' };
  return { kind: 'wrong' };
}

/** Apply a selection. Duplicate and invalid guesses leave state untouched. */
export function applyGuess(
  puzzle: LinkupPuzzle,
  state: LinkupState,
  selection: readonly string[],
): { state: LinkupState; outcome: Outcome } {
  const outcome = evaluateGuess(puzzle, state, selection);
  if (outcome.kind === 'invalid' || outcome.kind === 'duplicate') return { state, outcome };
  const guesses = [...state.guesses, guessKey(selection)];
  if (outcome.kind === 'correct') return { state: { ...state, guesses, solved: [...state.solved, outcome.group] }, outcome };
  return { state: { ...state, guesses, mistakes: state.mistakes + 1 }, outcome };
}

/** Groups to draw as bands: solved ones first, then (after a loss) the rest. */
export function bandOrder(puzzle: LinkupPuzzle, state: LinkupState): { group: number; found: boolean }[] {
  const out = state.solved.map((group) => ({ group, found: true }));
  if (statusOf(state) === 'lost') {
    puzzle.groups
      .map((_, i) => i)
      .filter((i) => !state.solved.includes(i))
      .sort((a, b) => puzzle.groups[a].level - puzzle.groups[b].level)
      .forEach((group) => out.push({ group, found: false }));
  }
  return out;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Spoiler-free result: one row of level colours per guess. */
export function resultFor(puzzle: LinkupPuzzle, state: LinkupState) {
  const status = statusOf(state);
  const score =
    status === 'won'
      ? `Solved · ${state.mistakes === 0 ? 'no mistakes' : plural(state.mistakes, 'mistake', 'mistakes')}`
      : `${state.solved.length} of ${GROUP_COUNT} groups`;
  const grid = state.guesses.map((g) => g.map((w) => LEVEL_EMOJI[puzzle.groups[groupOf(puzzle, w)].level]).join(''));
  return { score, grid };
}

// ---- validation (used by content tests) ----------------------------------

const LABEL_STOP = new Set(['THE', 'AND', 'WITH', 'THAT', 'THINGS', 'WORDS', 'BEFORE', 'AFTER', 'HIDDEN', 'KINDS', 'TYPES', 'SHADES', 'PARTS', 'SOUND', 'LIKE']);

/** Problems with one puzzle (empty when valid). */
export function validatePuzzle(p: LinkupPuzzle): string[] {
  const errs: string[] = [];
  if (!/^L\d{3,}$/.test(p.id)) errs.push(`bad id ${p.id}`);
  if (p.groups.length !== GROUP_COUNT) errs.push(`${p.id}: needs ${GROUP_COUNT} groups`);
  const levels = p.groups.map((g) => g.level).sort();
  if (levels.join() !== '0,1,2,3') errs.push(`${p.id}: levels must be 0..3 once each`);
  const seen = new Set<string>();
  for (const g of p.groups) {
    if (!g.label.trim()) errs.push(`${p.id}: empty label`);
    if (g.words.length !== GROUP_SIZE) errs.push(`${p.id}: "${g.label}" needs ${GROUP_SIZE} words`);
    const labelWords = g.label
      .toUpperCase()
      .split(/[^A-Z]+/)
      .filter((w) => w.length >= 3 && !LABEL_STOP.has(w));
    for (const w of g.words) {
      const k = wordKey(w);
      if (!k) errs.push(`${p.id}: empty word`);
      if (k !== w) errs.push(`${p.id}: "${w}" should be trimmed upper case`);
      if (k.length > MAX_WORD_LENGTH) errs.push(`${p.id}: "${w}" too long`);
      if (!/^[A-Z][A-Z -]*[A-Z]$/.test(k)) errs.push(`${p.id}: "${w}" has odd characters`);
      if (seen.has(k)) errs.push(`${p.id}: duplicate "${w}"`);
      seen.add(k);
      if (k === wordKey(g.label)) errs.push(`${p.id}: "${w}" equals its label`);
      for (const lw of labelWords) if (k.includes(lw)) errs.push(`${p.id}: "${w}" gives away label "${g.label}"`);
    }
  }
  return errs;
}
