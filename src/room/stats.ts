/**
 * Local game-room records. Every game calls `recordRoomResult` exactly once
 * when a game ends. Nothing leaves the device.
 *
 * Outcomes are from the phone owner's point of view only when that is
 * meaningful (solo puzzles, games against the computer). A pass-and-play
 * game between friends records 'complete' — idl doesn't pick a side.
 */
import { load, save, useStorageVersion } from '../lib/storage';
import type { RoomGameId } from './registry';

export type RoomOutcome = 'win' | 'loss' | 'draw' | 'complete';
export type Opponent = 'friend' | 'easy' | 'hard';

export interface Tally {
  played: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface RoomStats {
  /** Every finished game, any mode. */
  played: number;
  /** Solo puzzles solved / completed. */
  completed: number;
  vsFriend: number;
  vsComputer: { easy: Tally; hard: Tally };
  /** Best score per variant (e.g. difficulty or board size). */
  best: Record<string, { value: number; better: 'lower' | 'higher'; label: string; at: number }>;
  lastPlayed: number | null;
}

export interface RoomResult {
  outcome: RoomOutcome;
  opponent?: Opponent;
  /**
   * Optional personal-best candidate, e.g. { variant: 'hard', value: 312,
   * better: 'lower', label: '5:12' }.
   */
  score?: { variant: string; value: number; better: 'lower' | 'higher'; label: string };
}

export const ROOM_STATS_VERSION = 1;
const key = (id: RoomGameId) => `stats:room:${id}`;
const tally = (): Tally => ({ played: 0, wins: 0, losses: 0, draws: 0 });

export const emptyRoomStats = (): RoomStats => ({
  played: 0,
  completed: 0,
  vsFriend: 0,
  vsComputer: { easy: tally(), hard: tally() },
  best: {},
  lastPlayed: null,
});

export function loadRoomStats(id: RoomGameId): RoomStats {
  return load<RoomStats>(key(id), emptyRoomStats(), ROOM_STATS_VERSION);
}

/** Pure reducer, exported for tests. Returns [next, isNewBest]. */
export function applyResult(stats: RoomStats, r: RoomResult, now = Date.now()): [RoomStats, boolean] {
  const next: RoomStats = {
    ...stats,
    vsComputer: { easy: { ...stats.vsComputer.easy }, hard: { ...stats.vsComputer.hard } },
    best: { ...stats.best },
    played: stats.played + 1,
    lastPlayed: now,
  };
  if (r.opponent === 'easy' || r.opponent === 'hard') {
    const t = next.vsComputer[r.opponent];
    t.played++;
    if (r.outcome === 'win') t.wins++;
    else if (r.outcome === 'loss') t.losses++;
    else if (r.outcome === 'draw') t.draws++;
  } else if (r.opponent === 'friend') {
    next.vsFriend++;
  } else if (r.outcome === 'win' || r.outcome === 'complete') {
    next.completed++;
  }
  let isNewBest = false;
  if (r.score) {
    const prev = next.best[r.score.variant];
    const better = !prev || (r.score.better === 'lower' ? r.score.value < prev.value : r.score.value > prev.value);
    if (better) {
      next.best[r.score.variant] = { value: r.score.value, better: r.score.better, label: r.score.label, at: now };
      isNewBest = true;
    }
  }
  return [next, isNewBest];
}

/** Record a finished game. Returns true if it set a new personal best. */
export function recordRoomResult(id: RoomGameId, r: RoomResult): boolean {
  const [next, best] = applyResult(loadRoomStats(id), r);
  save(key(id), next, ROOM_STATS_VERSION);
  return best;
}

export function useRoomStats(id: RoomGameId): RoomStats {
  useStorageVersion(`stats:room:${id}`);
  return loadRoomStats(id);
}
