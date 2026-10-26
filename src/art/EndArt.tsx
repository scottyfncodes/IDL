import { useContext } from 'react';
import { GameArtContext } from './context';
import { Cover } from './covers';

/** The game's cover at the top of its end card: the sun lifts for a finish, dims for a loss. */
export function EndArt({ lost = false }: { lost?: boolean }) {
  const id = useContext(GameArtContext);
  if (!id) return null;
  return <Cover id={id} className="end-card__art" mood={lost ? 'lost' : 'won'} />;
}

/** The game's cover at the top of its start or hand-off card. */
export function StartArt() {
  const id = useContext(GameArtContext);
  if (!id) return null;
  return <Cover id={id} className="start-card__art" />;
}
