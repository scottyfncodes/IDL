/**
 * Mancala, Kalah rules (6 pits a side, 4 seeds each). Pure functions, no React.
 *
 * Layout, counter-clockwise:
 *   index 0–5   player 1's pits, left to right along the bottom
 *   index 6     player 1's store (right end)
 *   index 7–12  player 2's pits, right to left along the top
 *   index 13    player 2's store (left end)
 *
 * House rules chosen (stated in the in-game rules):
 * - Capture: if your last seed lands in an EMPTY pit on your own side and the
 *   pit directly opposite holds seeds, both the last seed and the opposite
 *   seeds go to your store. If the opposite pit is empty, nothing is
 *   captured and your seed stays put.
 * - End: as soon as either row is empty after a move, the game ends and each
 *   player banks the seeds still on their own side.
 */
import type { Rng } from '../../../lib/rng';

export type Player = 1 | 2;
export type Level = 'easy' | 'hard';
export type Pits = number[]; // length 14

export const PITS = 6;
export const SEEDS = 4;
export const STORE: Record<Player, number> = { 1: 6, 2: 13 };

export const other = (p: Player): Player => (p === 1 ? 2 : 1);
/** First pit index of a player's row. */
const rowStart = (p: Player) => (p === 1 ? 0 : 7);
export const ownerOf = (i: number): Player | null => (i >= 0 && i <= 5 ? 1 : i >= 7 && i <= 12 ? 2 : null);
/** The pit across the board (0 ↔ 12, 1 ↔ 11 … 5 ↔ 7). */
export const opposite = (i: number) => 12 - i;
/** A player's six pit indices in sowing order. */
export const rowOf = (p: Player): number[] => Array.from({ length: PITS }, (_, k) => rowStart(p) + k);

export function initialPits(seeds = SEEDS): Pits {
  const pits = Array(14).fill(seeds);
  pits[STORE[1]] = 0;
  pits[STORE[2]] = 0;
  return pits;
}

export interface State {
  pits: Pits;
  turn: Player;
}

export const newGame = (): State => ({ pits: initialPits(), turn: 1 });

export const rowEmpty = (pits: readonly number[], p: Player) => rowOf(p).every((i) => pits[i] === 0);
export const isOver = (s: State) => rowEmpty(s.pits, 1) || rowEmpty(s.pits, 2);

export function legalMoves(s: State): number[] {
  if (isOver(s)) return [];
  return rowOf(s.turn).filter((i) => s.pits[i] > 0);
}

export interface MoveResult {
  state: State;
  /** Every index a seed was dropped into, in order (for the sowing animation). */
  path: number[];
  /** Where the last seed landed. */
  last: number;
  extraTurn: boolean;
  /** Seeds captured from the opposite pit (0 = no capture). */
  captured: number;
  /** Set when this move ended the game: seeds each player banked from their own row. */
  sweep: { 1: number; 2: number } | null;
}

/** Sow from pit `i` for the player to move. Returns null if illegal. */
export function sow(s: State, i: number): MoveResult | null {
  if (isOver(s) || ownerOf(i) !== s.turn || s.pits[i] === 0) return null;
  const me = s.turn;
  const skip = STORE[other(me)];
  const pits = s.pits.slice();
  let hand = pits[i];
  pits[i] = 0;
  const path: number[] = [];
  let at = i;
  while (hand > 0) {
    at = (at + 1) % 14;
    if (at === skip) continue;
    pits[at]++;
    path.push(at);
    hand--;
  }
  const last = at;
  let captured = 0;
  const extraTurn = last === STORE[me];
  if (!extraTurn && ownerOf(last) === me && pits[last] === 1 && pits[opposite(last)] > 0) {
    captured = pits[opposite(last)];
    pits[STORE[me]] += captured + 1;
    pits[last] = 0;
    pits[opposite(last)] = 0;
  }
  let sweep: MoveResult['sweep'] = null;
  if (rowEmpty(pits, 1) || rowEmpty(pits, 2)) {
    sweep = { 1: 0, 2: 0 };
    for (const p of [1, 2] as Player[]) {
      for (const k of rowOf(p)) {
        sweep[p] += pits[k];
        pits[k] = 0;
      }
      pits[STORE[p]] += sweep[p];
    }
  }
  const turn = extraTurn && !sweep ? me : other(me);
  return { state: { pits, turn }, path, last, extraTurn, captured, sweep };
}

export const score = (pits: readonly number[]) => ({ 1: pits[STORE[1]], 2: pits[STORE[2]] });

/** 1, 2, or 0 for a draw. Only meaningful once the game is over. */
export function winnerOf(s: State): Player | 0 {
  const sc = score(s.pits);
  return sc[1] > sc[2] ? 1 : sc[2] > sc[1] ? 2 : 0;
}

// ---- computer opponent --------------------------------------------------------

/** Store difference from `me`'s view, plus a small nudge for seeds kept on your side. */
function evaluate(s: State, me: Player): number {
  const opp = other(me);
  if (isOver(s)) {
    const d = s.pits[STORE[me]] - s.pits[STORE[opp]];
    return d > 0 ? 1000 + d : d < 0 ? -1000 + d : 0;
  }
  let side = 0;
  for (const i of rowOf(me)) side += s.pits[i];
  for (const i of rowOf(opp)) side -= s.pits[i];
  return 4 * (s.pits[STORE[me]] - s.pits[STORE[opp]]) + side * 0.25;
}

interface Child {
  state: State;
  /** Store gain for the mover, used to order the search. */
  gain: number;
  extra: boolean;
}

/** Children of a position, most promising first (extra turns, then big gains). */
function children(s: State): Child[] {
  const me = s.turn;
  const out: Child[] = [];
  for (const m of legalMoves(s)) {
    const r = sow(s, m)!;
    out.push({ state: r.state, gain: r.state.pits[STORE[me]] - s.pits[STORE[me]], extra: r.extraTurn });
  }
  return out.sort((a, b) => Number(b.extra) - Number(a.extra) || b.gain - a.gain);
}

/**
 * Minimax with alpha-beta from `me`'s view. Each sowing is one ply; an extra
 * turn keeps the same side maximising (or minimising).
 */
function minimax(s: State, me: Player, depth: number, alpha: number, beta: number): number {
  if (depth === 0 || isOver(s)) return evaluate(s, me);
  const maximising = s.turn === me;
  let best = maximising ? -Infinity : Infinity;
  for (const c of children(s)) {
    const v = minimax(c.state, me, depth - 1, alpha, beta);
    if (maximising) {
      if (v > best) best = v;
      if (v > alpha) alpha = v;
    } else {
      if (v < best) best = v;
      if (v < beta) beta = v;
    }
    if (alpha >= beta) break;
  }
  return best;
}

export const HARD_DEPTH = 7;

/** Pick a pit for the player to move, or null when the game is over. Deterministic per rng. */
export function chooseMove(s: State, level: Level, rng: Rng): number | null {
  const moves = legalMoves(s);
  if (moves.length === 0) return null;
  const me = s.turn;
  if (level === 'easy') {
    // Usually grabs an obvious extra turn or capture, otherwise plays at random.
    if (rng.chance(0.55)) {
      const good = moves.filter((m) => {
        const r = sow(s, m)!;
        return r.extraTurn || r.captured > 0;
      });
      if (good.length) return rng.pick(good);
    }
    return rng.pick(moves);
  }
  const ordered = rng.shuffle(moves);
  let best = ordered[0];
  let alpha = -Infinity;
  for (const m of ordered) {
    const v = minimax(sow(s, m)!.state, me, HARD_DEPTH - 1, alpha, Infinity);
    if (v > alpha) {
      alpha = v;
      best = m;
    }
  }
  return best;
}

/** Pit number 1–6 in sowing order for its owner. */
export const pitNumber = (i: number) => (i <= 5 ? i + 1 : i - 6);
