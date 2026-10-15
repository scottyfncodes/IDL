/**
 * Per-game daily statistics, derived entirely from saved records (so the
 * history players already have counts). No streaks — just a quiet record.
 *
 * Each game's spoiler-free `result.score` has a stable format; a bucket
 * function maps it onto a small distribution. Tests pin every format so a
 * change to a game's score text fails loudly instead of skewing stats.
 */
import { keys, load } from '../lib/storage';
import { dailyKey, DAILY_RECORD_VERSION } from './progress';
import type { DailyGameId, DailyRecord } from './types';
import { useStorageVersion } from '../lib/storage';
import type { EditionDate } from '../lib/date';

export interface StatSpec {
  /** Heading above the distribution, e.g. "Guesses". */
  axis: string;
  buckets: string[];
  bucketOf: (score: string, status: 'won' | 'lost') => string | null;
}

const num = (re: RegExp, s: string) => {
  const m = re.exec(s);
  return m ? Number(m[1]) : null;
};

export const STAT_SPECS: Record<DailyGameId, StatSpec> = {
  linkup: {
    axis: 'Mistakes',
    buckets: ['0', '1', '2', '3', 'Missed'],
    bucketOf: (score, status) => {
      if (status === 'lost') return 'Missed';
      if (/no mistakes/.test(score)) return '0';
      const n = num(/(\d) mistakes?/, score);
      return n === null ? null : String(Math.min(n, 3));
    },
  },
  wordcraft: {
    axis: 'Guesses',
    buckets: ['1', '2', '3', '4', '5', '6', 'X'],
    bucketOf: (score) => {
      const m = /^([1-6X])\/6$/.exec(score);
      return m ? m[1] : null;
    },
  },
  sumwise: {
    axis: 'Targets hit',
    buckets: ['0', '1', '2', '3'],
    bucketOf: (score) => {
      const n = num(/^(\d)\/3 targets$/, score);
      return n === null ? null : String(n);
    },
  },
  deduction: {
    axis: 'Accusations',
    buckets: ['1st', '2nd', '3rd', 'Unsolved'],
    bucketOf: (score) => {
      if (score === 'Case unsolved') return 'Unsolved';
      const m = /^Solved on (1st|2nd|3rd) accusation$/.exec(score);
      return m ? m[1] : null;
    },
  },
  pattern: {
    axis: 'Correct',
    buckets: ['0', '1', '2', '3'],
    bucketOf: (score) => {
      const n = num(/^(\d)\/3$/, score);
      return n === null ? null : String(n);
    },
  },
  wordsteps: {
    axis: 'Steps vs par',
    buckets: ['Under', 'Par', '+1', '+2', '+3', '+4', 'Unsolved'],
    bucketOf: (score) => {
      if (/^Unsolved/.test(score)) return 'Unsolved';
      const m = /^Solved in (\d+) · par (\d+)$/.exec(score);
      if (!m) return null;
      const d = Number(m[1]) - Number(m[2]);
      return d < 0 ? 'Under' : d === 0 ? 'Par' : `+${Math.min(d, 4)}`;
    },
  },
};

export interface DailyStats {
  played: number;
  won: number;
  /** Count per bucket, in STAT_SPECS order. */
  distribution: { bucket: string; count: number }[];
  /** Bucket of a particular date's result, for highlighting. */
  bucketFor: (date: EditionDate) => string | null;
}

export function dailyStats(game: DailyGameId): DailyStats {
  const spec = STAT_SPECS[game];
  const counts = new Map(spec.buckets.map((b) => [b, 0]));
  const byDate = new Map<string, string>();
  let played = 0;
  let won = 0;
  for (const k of keys(`daily:${game}:`)) {
    const rec = load<DailyRecord | undefined>(k, undefined, DAILY_RECORD_VERSION);
    if (!rec || rec.status === 'playing') continue;
    played++;
    if (rec.status === 'won') won++;
    const b = rec.result ? spec.bucketOf(rec.result.score, rec.status) : null;
    if (b !== null && counts.has(b)) {
      counts.set(b, (counts.get(b) ?? 0) + 1);
      byDate.set(k.split(':')[2], b);
    }
  }
  return {
    played,
    won,
    distribution: spec.buckets.map((bucket) => ({ bucket, count: counts.get(bucket) ?? 0 })),
    bucketFor: (date) => byDate.get(date) ?? null,
  };
}

export function useDailyStats(game: DailyGameId): DailyStats {
  useStorageVersion(`daily:${game}:`);
  return dailyStats(game);
}

// Re-exported for tests that want the storage key shape.
export { dailyKey };
