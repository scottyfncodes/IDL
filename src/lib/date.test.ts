import { addDays, archiveDates, dayNumber, editionNumber, formatLong, isEditionDate, isPlayable, LAUNCH_DATE, localEditionDate, weekday } from './date';

describe('edition dates', () => {
  it('counts days from launch', () => {
    expect(dayNumber(LAUNCH_DATE)).toBe(0);
    expect(dayNumber('2026-09-02')).toBe(1);
    expect(dayNumber('2026-10-14')).toBe(43);
    expect(editionNumber('2026-10-14')).toBe(44);
  });

  it('is unaffected by DST transitions', () => {
    // US DST ends Nov 1 2026, EU Oct 25 2026.
    expect(dayNumber('2026-11-02') - dayNumber('2026-10-31')).toBe(2);
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
    expect(addDays('2027-03-13', 1)).toBe('2027-03-14');
  });

  it('uses the local calendar date for today', () => {
    expect(localEditionDate(new Date(2026, 9, 14, 23, 59))).toBe('2026-10-14');
    expect(localEditionDate(new Date(2026, 9, 15, 0, 1))).toBe('2026-10-15');
  });

  it('validates date keys', () => {
    expect(isEditionDate('2026-02-30')).toBe(false);
    expect(isEditionDate('2026-1-01')).toBe(false);
    expect(isEditionDate('2028-02-29')).toBe(true);
  });

  it('only allows launched, non-future editions', () => {
    expect(isPlayable('2026-08-31', '2026-10-14')).toBe(false);
    expect(isPlayable(LAUNCH_DATE, '2026-10-14')).toBe(true);
    expect(isPlayable('2026-10-14', '2026-10-14')).toBe(true);
    expect(isPlayable('2026-10-15', '2026-10-14')).toBe(false);
  });

  it('lists the archive newest first back to launch', () => {
    const list = archiveDates('2026-09-03');
    expect(list).toEqual(['2026-09-03', '2026-09-02', '2026-09-01']);
  });

  it('formats dates without time-zone drift', () => {
    expect(weekday('2026-10-14')).toBe('Wednesday');
    expect(formatLong('2026-10-14')).toBe('Wednesday, October 14');
  });
});
