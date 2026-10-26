import { navigate, useRoute, href } from '../app/router';
import { ROOM_GAMES, type RoomGameMeta, type Shelf } from '../room/registry';
import { Glyph } from '../ui/glyphs';
import { IconOffline } from '../ui/icons';
import { Footer, Masthead } from './TodayPage';

type Filter = 'all' | 'solo' | 'two';

const PLAYER_FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'solo', label: 'Solo' },
  { id: 'two', label: 'Two players' },
];

const SHELVES: { id: Shelf; title: string }[] = [
  { id: 'featured', title: 'Start here' },
  { id: 'more', title: 'More to play' },
  { id: 'filler', title: 'Quick fillers' },
];

function matches(filter: Filter, g: RoomGameMeta) {
  if (filter === 'solo') return g.players !== '2';
  if (filter === 'two') return g.players !== '1';
  return true;
}

const playersLabel = (p: string) => (p === '1' ? 'Solo' : p === '2' ? '2 players' : 'Solo or 2 players');

function GameCard({ g }: { g: RoomGameMeta }) {
  return (
    <a className="game-card" href={href(`/play/${g.id}`)}>
      <span className="game-card__glyph"><Glyph id={g.id} accent={g.accent} /></span>
      <span className="game-card__name display">{g.name}</span>
      <span className="game-card__blurb">{g.blurb}</span>
      <span className="game-card__meta">
        <span>{playersLabel(g.players)}</span>
        <span aria-hidden="true">·</span>
        <span>{g.minutes[0]}–{g.minutes[1]} min</span>
      </span>
    </a>
  );
}

export function PlayPage() {
  const route = useRoute();
  const raw = route.query.get('f') as Filter | null;
  const filter: Filter = raw && PLAYER_FILTERS.some((f) => f.id === raw) ? raw : 'all';
  const setFilter = (f: Filter) => navigate(f === 'all' ? '/play' : `/play?f=${f}`, { replace: true });

  return (
    <div className="page">
      <Masthead />
      <div className="page-head">
        <p className="eyebrow">The game room</p>
        <h1 className="page-title display">Play anywhere, together or alone.</h1>
        <p className="page-lede">
          <IconOffline size={16} /> Every game here works with no signal, once idl has loaded.
        </p>
      </div>

      <div className="chips room-filter" role="group" aria-label="Filter games">
        {PLAYER_FILTERS.map((f) => (
          <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {SHELVES.map((shelf) => {
        const games = ROOM_GAMES.filter((g) => g.shelf === shelf.id && matches(filter, g));
        if (!games.length) return null;
        return (
          <section key={shelf.id} aria-labelledby={`shelf-${shelf.id}`} className={`play-shelf play-shelf--${shelf.id}`}>
            <h2 id={`shelf-${shelf.id}`} className="section-title display">{shelf.title}</h2>
            <ul className="game-grid">
              {games.map((g) => (
                <li key={g.id}>
                  <GameCard g={g} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <Footer />
    </div>
  );
}
