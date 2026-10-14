/**
 * Wordcraft rules: a hidden five-letter word, six guesses.
 * Pure logic only — no React.
 */
import answersJson from '../../../content/words/answers5.json';
import guessesJson from '../../../content/words/guesses5.json';
import { createRng } from '../../../lib/rng';
import { dayNumber, type EditionDate } from '../../../lib/date';

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

export type Mark = 'correct' | 'present' | 'absent';

/**
 * FROZEN. The answer for each date is perm[dayNumber(date) % perm.length]
 * where perm is a seeded shuffle of this list. Adding, removing or reordering
 * answers changes the mapping for every date (past editions included), so the
 * list in answers5.json must stay frozen once published. The stability test in
 * logic.test.ts pins known dates to catch accidental edits.
 */
export const ANSWERS: readonly string[] = (answersJson as { words: string[] }).words.map((w) => w.toLowerCase());

/** Every accepted guess: the guess list plus all answers. */
export const VALID_GUESSES: ReadonlySet<string> = new Set([
  ...(guessesJson as { words: string[] }).words.map((w) => w.toLowerCase()),
  ...ANSWERS,
]);

let perm: string[] | null = null;
/** Seeded permutation of the answers, computed once. */
export function answerOrder(): readonly string[] {
  if (!perm) perm = createRng('wordcraft:v1:order').shuffle(ANSWERS);
  return perm;
}

export function answerFor(date: EditionDate): string {
  const order = answerOrder();
  const n = dayNumber(date);
  return order[((n % order.length) + order.length) % order.length];
}

export const normalize = (w: string) => w.trim().toLowerCase();

export type GuessError = 'length' | 'unknown';

/** Why a guess is rejected, or null when it is acceptable. */
export function checkGuess(raw: string): GuessError | null {
  const w = normalize(raw);
  if (w.length !== WORD_LENGTH || !/^[a-z]+$/.test(w)) return 'length';
  if (!VALID_GUESSES.has(w)) return 'unknown';
  return null;
}

export const ERROR_TEXT: Record<GuessError, string> = {
  length: 'Five letters, please',
  unknown: 'Not in the word list',
};

/**
 * Two-pass evaluation. Pass 1 marks exact matches and removes them from the
 * pool of answer letters. Pass 2 marks a letter present only while unmatched
 * copies of it remain in the answer, left to right.
 */
export function evaluate(guessRaw: string, answerRaw: string): Mark[] {
  const guess = normalize(guessRaw);
  const answer = normalize(answerRaw);
  if (guess.length !== answer.length) throw new Error('length mismatch');
  const marks: Mark[] = new Array(guess.length).fill('absent');
  const remaining = new Map<string, number>();
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) marks[i] = 'correct';
    else remaining.set(answer[i], (remaining.get(answer[i]) ?? 0) + 1);
  }
  for (let i = 0; i < guess.length; i++) {
    if (marks[i] === 'correct') continue;
    const left = remaining.get(guess[i]) ?? 0;
    if (left > 0) {
      marks[i] = 'present';
      remaining.set(guess[i], left - 1);
    }
  }
  return marks;
}

const RANK: Record<Mark, number> = { absent: 0, present: 1, correct: 2 };

/** Best known state for each letter across all guesses. */
export function keyStates(guesses: readonly string[], answer: string): Record<string, Mark> {
  const out: Record<string, Mark> = {};
  for (const g of guesses) {
    const marks = evaluate(g, answer);
    [...normalize(g)].forEach((l, i) => {
      const prev = out[l];
      if (!prev || RANK[marks[i]] > RANK[prev]) out[l] = marks[i];
    });
  }
  return out;
}

export type Status = 'playing' | 'won' | 'lost';

export function statusOf(guesses: readonly string[], answer: string): Status {
  if (guesses.some((g) => normalize(g) === normalize(answer))) return 'won';
  if (guesses.length >= MAX_GUESSES) return 'lost';
  return 'playing';
}

const GLYPH: Record<Mark, string> = { correct: '🟩', present: '🟨', absent: '⬜' };

export function resultFor(guesses: readonly string[], answer: string) {
  const status = statusOf(guesses, answer);
  return {
    score: status === 'won' ? `${guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`,
    grid: guesses.map((g) => evaluate(g, answer).map((m) => GLYPH[m]).join('')),
  };
}

export const MARK_TEXT: Record<Mark, string> = {
  correct: 'correct spot',
  present: 'in the word, wrong spot',
  absent: 'not in the word',
};
