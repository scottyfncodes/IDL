import type { EditionDate } from '../lib/date';
import { STAT_SPECS, useDailyStats } from './stats';
import type { DailyGameId } from './types';

/**
 * A quiet record for one daily game: how many played, how many solved, and
 * the spread of results. The bar for `highlight` (usually the edition just
 * finished) is marked in text as well as colour.
 */
export function DailyStatsView({ game, highlight }: { game: DailyGameId; highlight?: EditionDate }) {
  const stats = useDailyStats(game);
  const spec = STAT_SPECS[game];
  if (stats.played === 0) return <p className="meta">Finish a puzzle to start your record.</p>;
  const max = Math.max(1, ...stats.distribution.map((d) => d.count));
  const mine = highlight ? stats.bucketFor(highlight) : null;
  const pct = Math.round((stats.won / stats.played) * 100);
  return (
    <div className="dstats">
      <dl className="dstats__totals">
        <div><dt>Played</dt><dd className="display">{stats.played}</dd></div>
        <div><dt>Solved</dt><dd className="display">{pct}%</dd></div>
      </dl>
      <p className="dstats__axis eyebrow" id={`dstats-${game}`}>{spec.axis}</p>
      <ol className="dstats__bars" aria-labelledby={`dstats-${game}`}>
        {stats.distribution.map((d) => {
          const isMine = d.bucket === mine;
          return (
            <li key={d.bucket} className={`dstats__row${isMine ? ' is-mine' : ''}`} aria-label={`${d.bucket}: ${d.count}${isMine ? ', this result' : ''}`}>
              <span className="dstats__label" aria-hidden="true">{d.bucket}</span>
              <span className="dstats__track" aria-hidden="true">
                <span className="dstats__bar" style={{ width: d.count ? `max(${(d.count / max) * 100}%, 6px)` : 0 }} />
                <span className="dstats__count">{d.count}</span>
              </span>
              <span className="dstats__tag" aria-hidden="true">{isMine ? 'this one' : ''}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
