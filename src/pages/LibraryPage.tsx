import { useMemo, useState } from 'react';
import { DAILY_GAMES, dailyMeta } from '../daily/registry';
import type { DailyGameId } from '../daily/types';
import { DailyStatsView } from '../daily/DailyStatsView';
import { ROOM_GAMES } from '../room/registry';
import { loadRoomStats, type RoomStats } from '../room/stats';
import { Sheet } from '../ui/Sheet';
import { dailyState } from '../daily/progress';
import { addDays, LAUNCH_DATE, localEditionDate, monthLabel, type EditionDate } from '../lib/date';
import { clearAll, keys, load, useStorageVersion } from '../lib/storage';
import { useSettings, type ThemePref } from '../lib/settings';
import { href } from '../app/router';
import { Button } from '../ui/Button';
import { Confirm } from '../ui/Confirm';
import { Segmented } from '../ui/Segmented';
import { useToast } from '../ui/Toast';
import { IconBack, IconChevron } from '../ui/icons';
import { Footer, Masthead } from './TodayPage';

interface DayInfo {
  date: EditionDate;
  finished: number;
  started: boolean;
}

function dayInfo(date: EditionDate): DayInfo {
  let finished = 0;
  let started = false;
  for (const g of DAILY_GAMES) {
    const s = dailyState(g.id, date);
    if (s === 'won' || s === 'lost') finished++;
    if (s !== 'unplayed') started = true;
  }
  return { date, finished, started };
}

function monthStart(date: EditionDate): EditionDate {
  return `${date.slice(0, 7)}-01`;
}

function ArchiveCalendar({ today }: { today: EditionDate }) {
  useStorageVersion('daily:');
  const [month, setMonth] = useState(monthStart(today));
  const first = month;
  const canPrev = first > monthStart(LAUNCH_DATE);
  const nextMonth = monthStart(addDays(first, 32));
  const canNext = nextMonth <= monthStart(today);
  const prevMonth = monthStart(addDays(first, -1));

  const cells = useMemo(() => {
    const dow = new Date(`${first}T00:00:00Z`).getUTCDay(); // 0 Sun
    const lead = (dow + 6) % 7; // Monday-first
    const out: (DayInfo | null)[] = Array(lead).fill(null);
    for (let d = first; d.slice(0, 7) === first.slice(0, 7); d = addDays(d, 1)) {
      out.push(d >= LAUNCH_DATE && d <= today ? dayInfo(d) : { date: d, finished: -1, started: false });
    }
    return out;
  }, [first, today]);

  return (
    <div className="calendar">
      <div className="calendar__head">
        <button type="button" className="icon-btn" aria-label="Previous month" disabled={!canPrev} onClick={() => setMonth(prevMonth)}>
          <IconBack size={20} />
        </button>
        <h3 className="calendar__month display" aria-live="polite">{monthLabel(first)}</h3>
        <button type="button" className="icon-btn" aria-label="Next month" disabled={!canNext} onClick={() => setMonth(nextMonth)}>
          <IconChevron size={20} />
        </button>
      </div>
      <div className="calendar__grid" role="list">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="calendar__dow" aria-hidden="true">{d}</span>
        ))}
        {cells.map((c, i) => {
          if (!c) return <span key={`e${i}`} />;
          const day = +c.date.slice(8);
          if (c.finished < 0) {
            return <span key={c.date} className="calendar__day is-unavailable" aria-hidden="true">{day}</span>;
          }
          const pct = c.finished / DAILY_GAMES.length;
          return (
            <a
              key={c.date}
              role="listitem"
              href={href(`/edition/${c.date}`)}
              className={`calendar__day${c.date === today ? ' is-today' : ''}${c.finished === DAILY_GAMES.length ? ' is-complete' : ''}`}
              aria-label={`${c.date}: ${c.finished} of ${DAILY_GAMES.length} finished`}
              style={{ '--pct': pct } as React.CSSProperties}
            >
              <span>{day}</span>
            </a>
          );
        })}
      </div>
      <p className="calendar__legend meta">
        <span className="calendar__key" /> Ring fills as you finish each day’s six puzzles.
      </p>
    </div>
  );
}

function useStats() {
  useStorageVersion('daily:');
  const all = keys('daily:');
  let won = 0;
  let played = 0;
  const perGame: Record<string, number> = {};
  for (const k of all) {
    const rec = load<{ status: string } | undefined>(k, undefined, 1);
    if (!rec || rec.status === 'playing') continue;
    played++;
    if (rec.status === 'won') {
      won++;
      const g = k.split(':')[1];
      perGame[g] = (perGame[g] ?? 0) + 1;
    }
  }
  return { won, played, perGame };
}

function Preferences() {
  const [settings, setSettings] = useSettings();
  const [confirm, setConfirm] = useState<null | 'daily' | 'all'>(null);
  const toast = useToast();
  return (
    <section className="prefs" aria-labelledby="prefs-title">
      <h2 id="prefs-title" className="section-title display">Preferences</h2>
      <div className="pref-row">
        <span>Appearance</span>
        <Segmented<ThemePref>
          label="Appearance"
          value={settings.theme}
          onChange={(theme) => setSettings({ ...settings, theme })}
          options={[
            { value: 'system', label: 'Auto' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </div>
      <div className="pref-note">
        <h3>Your data stays on this device</h3>
        <p className="muted">
          idl has no accounts and sends nothing anywhere. Progress lives in this browser’s storage. Clearing website data — or, on
          iPhone, long periods without opening idl — can remove it. Adding idl to your Home Screen keeps it safest.
        </p>
      </div>
      <div className="button-row button-row--start">
        <Button variant="quiet" size="sm" onClick={() => setConfirm('daily')}>Clear puzzle history</Button>
        <Button variant="quiet" size="sm" onClick={() => setConfirm('all')}>Reset everything</Button>
      </div>
      <Confirm
        open={confirm !== null}
        title={confirm === 'all' ? 'Reset everything?' : 'Clear puzzle history?'}
        message={
          confirm === 'all'
            ? 'All daily results, saved games, scores and preferences on this device will be erased. This can’t be undone.'
            : 'Every daily puzzle result and in-progress daily puzzle on this device will be erased. Saved game-room games are kept.'
        }
        confirmLabel={confirm === 'all' ? 'Erase everything' : 'Clear history'}
        cancelLabel="Cancel"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          clearAll(confirm === 'all' ? '' : 'daily:');
          setConfirm(null);
          toast.show(confirm === 'all' ? 'Everything has been reset' : 'Puzzle history cleared');
        }}
      />
    </section>
  );
}

function roomSummary(st: RoomStats): string[] {
  const out: string[] = [];
  const vs = (['easy', 'hard'] as const)
    .filter((l) => st.vsComputer[l].played > 0)
    .map((l) => {
      const t = st.vsComputer[l];
      return `vs idl ${l}: ${t.wins}–${t.losses}${t.draws ? `–${t.draws}` : ''}`;
    });
  out.push(...vs);
  if (st.vsFriend) out.push(`${st.vsFriend} with a friend`);
  if (st.completed) out.push(`${st.completed} solved`);
  const bests = Object.entries(st.best);
  if (bests.length) out.push(`best ${bests.map(([v, b]) => `${v} ${b.label}`).join(', ')}`);
  return out;
}

function RoomShelf() {
  useStorageVersion('stats:room:');
  const rows = ROOM_GAMES.map((g) => ({ g, st: loadRoomStats(g.id) })).filter((r) => r.st.played > 0);
  return (
    <section aria-labelledby="room-shelf-title" className="library-section">
      <div className="section-head">
        <h2 id="room-shelf-title" className="section-title display">Game room</h2>
        <a className="text-link" href={href('/play')}>Play</a>
      </div>
      {rows.length === 0 ? (
        <p className="meta">Finished games show up here: wins against idl, games with friends and personal bests.</p>
      ) : (
        <ul className="room-shelf">
          {rows.map(({ g, st }) => (
            <li key={g.id}>
              <a href={href(`/play/${g.id}`)}>
                <span className="room-shelf__name">{g.name}</span>
                <span className="room-shelf__count">{st.played} played</span>
                <span className="room-shelf__detail meta">{roomSummary(st).join(' · ')}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function LibraryPage() {
  const today = localEditionDate();
  const stats = useStats();
  const [recordFor, setRecordFor] = useState<DailyGameId | null>(null);
  return (
    <div className="page">
      <Masthead />
      <div className="page-head">
        <p className="eyebrow">Library</p>
        <h1 className="page-title display">Every edition, kept on the shelf.</h1>
      </div>

      <section aria-labelledby="archive-title" className="library-section">
        <div className="section-head">
          <h2 id="archive-title" className="section-title display">The archive</h2>
          <a className="text-link" href={href(`/edition/${addDays(today, -1)}`)}>Yesterday</a>
        </div>
        <ArchiveCalendar today={today} />
      </section>

      <section aria-labelledby="stats-title" className="library-section">
        <h2 id="stats-title" className="section-title display">Your shelf</h2>
        <div className="stats">
          <div className="stat"><span className="stat__n display">{stats.played}</span><span className="stat__l">puzzles finished</span></div>
          <div className="stat"><span className="stat__n display">{stats.won}</span><span className="stat__l">solved</span></div>
        </div>
        <ul className="per-game">
          {DAILY_GAMES.map((g) => (
            <li key={g.id}>
              <button type="button" className="per-game__row" onClick={() => setRecordFor(g.id)}>
                <span>{g.name}</span>
                <span className="meta">{stats.perGame[g.id] ?? 0} solved</span>
                <IconChevron size={16} className="per-game__chev" />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <RoomShelf />

      <Preferences />

      <Sheet open={recordFor !== null} onClose={() => setRecordFor(null)} title={recordFor ? `${dailyMeta(recordFor)!.name} record` : 'Record'}>
        {recordFor && (
          <div className="record-sheet">
            <DailyStatsView game={recordFor} highlight={today} />
            <a className="btn btn--primary btn--md" href={href(`/daily/${recordFor}/${today}`)} onClick={() => setRecordFor(null)}>
              <span>Play today’s {dailyMeta(recordFor)!.name}</span>
            </a>
          </div>
        )}
      </Sheet>
      <Footer />
    </div>
  );
}
