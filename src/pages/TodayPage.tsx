import { localEditionDate } from '../lib/date';
import { useOnline } from '../lib/online';
import { href } from '../app/router';
import { ROOM_GAMES } from '../room/registry';
import { Cover } from '../art/covers';
import { IconOffline } from '../ui/icons';
import { Wordmark } from '../ui/Wordmark';
import { EditionHeading, EditionLineup } from './EditionView';

// The strongest games for passing the phone, not the shortest.
const QUICK = ['connect-four', 'dots-boxes', 'reversi'];

export function Masthead() {
  const online = useOnline();
  return (
    <header className="masthead">
      <a href={href('/today')} className="masthead__brand">
        <Wordmark />
      </a>
      {!online && (
        <span className="offline-pill" role="status">
          <IconOffline size={16} /> Offline · all games work
        </span>
      )}
    </header>
  );
}

export function TodayPage() {
  const today = localEditionDate();
  return (
    <div className="page">
      <Masthead />
      <EditionHeading date={today} isToday />
      <EditionLineup date={today} />

      <section className="teaser" aria-labelledby="teaser-title">
        <div className="section-head">
          <h2 id="teaser-title" className="section-title display">Hand the phone over</h2>
          <a className="text-link" href={href('/play')}>Game room</a>
        </div>
        <ul className="teaser__row">
          {QUICK.map((id) => {
            const g = ROOM_GAMES.find((x) => x.id === id)!;
            return (
              <li key={id}>
                <a className="mini-card" href={href(`/play/${id}`)}>
                  <Cover id={id} className="mini-card__art" />
                  <span className="mini-card__name">{g.name}</span>
                  <span className="meta">{g.players === '2' ? '2 players' : g.players === '1' ? 'Solo' : 'Solo or 2'}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </section>
      <Footer />
    </div>
  );
}

export function Footer() {
  return (
    <footer className="site-foot">
      <p>Free to play. No account, no ads.</p>
      <p>
        Made by <span className="site-foot__maker">HaveAnApp</span>
      </p>
    </footer>
  );
}
