/**
 * Memory Match rules. Pure functions, no React.
 *
 * A move is turning over two cards. A pair stays face up; a mismatch stays
 * visible until `settle` (called by the UI after a short pause, or by the
 * next tap), then turns back over. In two-player mode a pair earns another
 * go; a mismatch passes the turn.
 */
import { createRng } from '../../../lib/rng';
import { MOTIFS, type MotifId } from './content';

export type Mode = 'solo' | 'duo';
export type SizeId = '4x4' | '4x5' | '4x6';
export type Player = 0 | 1;

export interface SizeSpec {
  id: SizeId;
  cols: number;
  rows: number;
  label: string;
}

export const SIZES: Record<SizeId, SizeSpec> = {
  '4x4': { id: '4x4', cols: 4, rows: 4, label: '4 × 4' },
  '4x5': { id: '4x5', cols: 4, rows: 5, label: '4 × 5' },
  '4x6': { id: '4x6', cols: 4, rows: 6, label: '4 × 6' },
};

export const pairsFor = (size: SizeId) => (SIZES[size].cols * SIZES[size].rows) / 2;

export interface MatchState {
  mode: Mode;
  size: SizeId;
  seed: number;
  deck: MotifId[];
  /** Who matched each card (0 in solo), or null while still in play. */
  matchedBy: (Player | null)[];
  /** Cards currently face up and not yet matched (0, 1 or 2 — two means a mismatch on show). */
  open: number[];
  turn: Player;
  scores: [number, number];
  moves: number;
}

/** Deterministic deck for a seed: exactly two of each of the first N motifs, shuffled. */
export function deal(size: SizeId, seed: number): MotifId[] {
  const rng = createRng(`memory-match:v1:${size}:${seed}`);
  const chosen = rng.shuffle(MOTIFS.map((m) => m.id)).slice(0, pairsFor(size));
  return rng.shuffle([...chosen, ...chosen]);
}

export function newMatch(mode: Mode, size: SizeId, seed: number): MatchState {
  const deck = deal(size, seed);
  return { mode, size, seed, deck, matchedBy: deck.map(() => null), open: [], turn: 0, scores: [0, 0], moves: 0 };
}

export const isOver = (s: MatchState) => s.matchedBy.every((m) => m !== null);

/** Turn a showing mismatch back over (and pass the turn in two-player mode). No-op otherwise. */
export function settle(s: MatchState): MatchState {
  if (s.open.length < 2) return s;
  return { ...s, open: [], turn: s.mode === 'duo' ? (s.turn === 0 ? 1 : 0) : s.turn };
}

/** Is a mismatch on show, waiting to be turned back? */
export const isPending = (s: MatchState) => s.open.length === 2;

export function canFlip(s: MatchState, i: number): boolean {
  if (isOver(s) || i < 0 || i >= s.deck.length || !Number.isInteger(i)) return false;
  if (s.matchedBy[i] !== null) return false;
  if (s.open.includes(i)) return false;
  return true;
}

/**
 * Turn card `i` face up. Tapping during a showing mismatch settles it first.
 * Illegal flips return the same state object.
 */
export function flip(state: MatchState, i: number): MatchState {
  if (!canFlip(state, i)) return state;
  const s = isPending(state) ? settle(state) : state;
  if (s.open.length === 0) return { ...s, open: [i] };

  const [a] = s.open;
  const moves = s.moves + 1;
  if (s.deck[a] === s.deck[i]) {
    const matchedBy = s.matchedBy.slice();
    matchedBy[a] = s.turn;
    matchedBy[i] = s.turn;
    const scores: [number, number] = [s.scores[0], s.scores[1]];
    scores[s.turn] += 1;
    return { ...s, matchedBy, scores, open: [], moves };
  }
  return { ...s, open: [a, i], moves };
}

export const isFaceUp = (s: MatchState, i: number) => s.matchedBy[i] !== null || s.open.includes(i);

export const pairsFound = (s: MatchState) => s.scores[0] + s.scores[1];

/** Two-player result: winner, or null for a tie. Undefined while still playing. */
export function winner(s: MatchState): Player | null | undefined {
  if (!isOver(s)) return undefined;
  if (s.scores[0] === s.scores[1]) return null;
  return s.scores[0] > s.scores[1] ? 0 : 1;
}

export interface Best {
  moves: number;
  ms: number;
}

/** Fewer moves wins; time breaks ties. */
export function isBetter(next: Best, prev: Best | null | undefined): boolean {
  if (!prev) return true;
  return next.moves < prev.moves || (next.moves === prev.moves && next.ms < prev.ms);
}

export function formatTime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
