/**
 * Edition dates.
 *
 * Convention: an edition is keyed by a calendar date string `YYYY-MM-DD`.
 * Each player's "today" is their *local* calendar date, so the new edition
 * arrives at local midnight. The puzzle for a given date string is identical
 * for every player everywhere (see daily/edition.ts). All date arithmetic on
 * edition keys is done in UTC on the date string itself, so DST and time zone
 * offsets can never shift which puzzle a key maps to.
 */

export type EditionDate = string; // 'YYYY-MM-DD'

/** First published edition. Archive starts here. Never change. */
export const LAUNCH_DATE: EditionDate = '2026-09-01';

const DAY_MS = 86_400_000;
const RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isEditionDate(value: string): value is EditionDate {
  const m = RE.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

/** The local calendar date for `now`, as an edition key. */
export function localEditionDate(now: Date = new Date()): EditionDate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toUtcMs(date: EditionDate): number {
  const m = RE.exec(date);
  if (!m) throw new Error(`Invalid edition date: ${date}`);
  return Date.UTC(+m[1], +m[2] - 1, +m[3]);
}

export function fromUtcMs(ms: number): EditionDate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Whole days from LAUNCH_DATE to `date` (0 on launch day). */
export function dayNumber(date: EditionDate): number {
  return Math.round((toUtcMs(date) - toUtcMs(LAUNCH_DATE)) / DAY_MS);
}

export function addDays(date: EditionDate, days: number): EditionDate {
  return fromUtcMs(toUtcMs(date) + days * DAY_MS);
}

export function compareDates(a: EditionDate, b: EditionDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Is this edition playable yet (launched and not in the player's future)? */
export function isPlayable(date: EditionDate, today: EditionDate = localEditionDate()): boolean {
  return isEditionDate(date) && date >= LAUNCH_DATE && date <= today;
}

/** All playable edition dates, newest first. */
export function archiveDates(today: EditionDate = localEditionDate()): EditionDate[] {
  const out: EditionDate[] = [];
  for (let d = today; d >= LAUNCH_DATE; d = addDays(d, -1)) out.push(d);
  return out;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function weekday(date: EditionDate): string {
  return WEEKDAYS[new Date(toUtcMs(date)).getUTCDay()];
}

/** "Wednesday, October 14" */
export function formatLong(date: EditionDate): string {
  const d = new Date(toUtcMs(date));
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Oct 14" */
export function formatShort(date: EditionDate): string {
  const d = new Date(toUtcMs(date));
  return `${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`;
}

export function monthLabel(date: EditionDate): string {
  const d = new Date(toUtcMs(date));
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** Edition number shown to players (No. 1 on launch day). */
export function editionNumber(date: EditionDate): number {
  return dayNumber(date) + 1;
}
