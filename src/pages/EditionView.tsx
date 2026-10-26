import { EDITION_GAMES } from '../daily/registry';
import { dailyState, type DailyState } from '../daily/progress';
import { editionNumber, formatLong, weekday, type EditionDate } from '../lib/date';
import { useStorageVersion } from '../lib/storage';
import { href } from '../app/router';
import { Glyph } from '../ui/glyphs';
import { IconCheck, IconChevron } from '../ui/icons';

const STATE_LABEL: Record<DailyState, string> = {
  unplayed: 'Play',
  playing: 'Continue',
  won: 'Solved',
  lost: 'Played',
};

export function useEditionStates(date: EditionDate) {
  useStorageVersion('daily:');
  return EDITION_GAMES.map((g) => ({ game: g, state: dailyState(g.id, date) }));
}

export function EditionProgress({ date }: { date: EditionDate }) {
  const rows = useEditionStates(date);
  const done = rows.filter((r) => r.state === 'won' || r.state === 'lost').length;
  return (
    <div className="edition-progress" aria-label={`${done} of ${rows.length} puzzles finished`}>
      <ol className="edition-progress__marks" aria-hidden="true">
        {rows.map((r) => (
          <li key={r.game.id} data-state={r.state} />
        ))}
      </ol>
      <span className="meta">
        {done === 0 ? 'Six puzzles, no rush.' : done === rows.length ? 'All six finished. Lovely.' : `${done} of ${rows.length} finished`}
      </span>
    </div>
  );
}

export function EditionLineup({ date }: { date: EditionDate }) {
  const rows = useEditionStates(date);
  return (
    <ol className="lineup">
      {rows.map(({ game, state }, i) => (
        <li key={game.id} className="anim-rise" style={{ animationDelay: `${i * 30}ms` }}>
          <a className="lineup__item" href={href(`/daily/${game.id}/${date}`)} data-state={state}>
            <span className="lineup__glyph">
              <Glyph id={game.id} accent={game.accent} />
            </span>
            <span className="lineup__text">
              <span className="lineup__name display">{game.name}</span>
              <span className="lineup__tag">{game.tagline}</span>
            </span>
            <span className="lineup__side">
              {state === 'won' || state === 'lost' ? (
                <span className={`lineup__state is-${state}`}>
                  {state === 'won' && <IconCheck size={16} />}
                  {STATE_LABEL[state]}
                </span>
              ) : (
                <>
                  <span className={`lineup__state is-${state}`}>{STATE_LABEL[state]}</span>
                  <span className="lineup__time">~{game.minutes} min</span>
                </>
              )}
            </span>
            <IconChevron size={18} className="lineup__chev" />
          </a>
        </li>
      ))}
    </ol>
  );
}

export function EditionHeading({ date, isToday }: { date: EditionDate; isToday: boolean }) {
  return (
    <div className="edition-head">
      <p className="eyebrow">{isToday ? `Today’s edition · No. ${editionNumber(date)}` : `From the archive · No. ${editionNumber(date)}`}</p>
      <h1 className="edition-head__date display" aria-label={formatLong(date)}>
        <span className="edition-head__weekday">{weekday(date)}</span>
        <span>{formatLong(date).split(', ')[1]}</span>
      </h1>
      <EditionProgress date={date} />
    </div>
  );
}
