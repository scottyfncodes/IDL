import { load, keys, save } from '../lib/storage';
import type { EditionDate } from '../lib/date';
import type { DailyGameId, DailyRecord } from './types';

/** Bump only with a migration in place. */
export const DAILY_RECORD_VERSION = 1;

export const dailyKey = (game: DailyGameId, date: EditionDate) => `daily:${game}:${date}`;

export function loadDaily<S>(game: DailyGameId, date: EditionDate): DailyRecord<S> | undefined {
  return load<DailyRecord<S> | undefined>(dailyKey(game, date), undefined, DAILY_RECORD_VERSION);
}

export function saveDaily<S>(game: DailyGameId, date: EditionDate, record: Omit<DailyRecord<S>, 'updatedAt'>): DailyRecord<S> {
  const prev = loadDaily<S>(game, date);
  // A finished record is final: never let a stale write reopen it.
  if (prev && prev.status !== 'playing' && record.status === 'playing') return prev;
  const full: DailyRecord<S> = { ...record, updatedAt: Date.now() };
  save(dailyKey(game, date), full, DAILY_RECORD_VERSION);
  return full;
}

export type DailyState = 'unplayed' | 'playing' | 'won' | 'lost';

export function dailyState(game: DailyGameId, date: EditionDate): DailyState {
  const r = loadDaily(game, date);
  return r ? r.status : 'unplayed';
}

/** Dates (any game) that have some saved daily progress. */
export function datesWithProgress(): Set<EditionDate> {
  const out = new Set<EditionDate>();
  for (const k of keys('daily:')) out.add(k.split(':')[2]);
  return out;
}
