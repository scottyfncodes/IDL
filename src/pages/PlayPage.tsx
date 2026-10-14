import { navigate, useRoute, href } from '../app/router';
import { COLLECTIONS, ROOM_GAMES, type CollectionId } from '../room/registry';
import { Glyph } from '../ui/glyphs';
import { IconOffline } from '../ui/icons';
import { Footer, Masthead } from './TodayPage';

type Filter = 'all' | 'solo' | 'two' | CollectionId;

const PLAYER_FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'solo', label: 'Solo' },
  { id: 'two', label: 'Two players' },
];

function matches(filter: Filter, g: (typeof ROOM_GAMES)[number]) {
  if (filter === 'all') return true;
  if (filter === 'solo') return g.players !== '2';
  if (filter === 'two') return g.players !== '1';
  return g.collections.includes(filter);
}

const playersLabel = (p: string) => (p === '1' ? 'Solo' : p === '2' ? '2 players' : 'Solo or 2 players');

export function PlayPage() {
  const route = useRoute();
  const raw = route.query.get('f') as Filter | null;
  const filter: Filter = raw && (PLAYER_FILTERS.some((f) => f.id === raw) || COLLECTIONS.some((c) => c.id === raw)) ? raw : 'all';
  const collection = COLLECTIONS.find((c) => c.id === filter);
  const games = ROOM_GAMES.filter((g) => matches(filter, g));
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

      <section aria-label="Collections">
        <ul className="collections">
          {COLLECTIONS.map((c) => (
            <li key={c.id}>
              <button type="button" className="collection" aria-pressed={filter === c.id} onClick={() => setFilter(filter === c.id ? 'all' : c.id)}>
                <span className="collection__name display">{c.name}</span>
                <span className="collection__line">{c.line}</span>
                <span className="collection__count">{ROOM_GAMES.filter((g) => g.collections.includes(c.id)).length} games</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="games-title">
        <div className="section-head">
          <h2 id="games-title" className="section-title display">{collection ? collection.name : 'All games'}</h2>
          <div className="chips" role="group" aria-label="Filter games">
            {PLAYER_FILTERS.map((f) => (
              <button key={f.id} type="button" className="chip" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <ul className="game-grid">
          {games.map((g) => (
            <li key={g.id}>
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
            </li>
          ))}
        </ul>
      </section>
      <Footer />
    </div>
  );
}
