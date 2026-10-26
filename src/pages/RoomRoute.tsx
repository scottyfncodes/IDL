import { Suspense, lazy, type ComponentType } from 'react';
import { roomMeta, type RoomGameMeta } from '../room/registry';
import { ErrorBoundary } from '../app/ErrorBoundary';
import { LoadFailed, Loading, NotFound } from './States';
import { GameArtContext } from '../art/context';

const cache = new Map<string, ComponentType>();
function lazyRoom(meta: RoomGameMeta) {
  let C = cache.get(meta.id);
  if (!C) {
    C = lazy(meta.load);
    cache.set(meta.id, C);
  }
  return C;
}

export function RoomRoute({ gameId }: { gameId: string }) {
  const meta = roomMeta(gameId);
  if (!meta) return <NotFound />;
  const Game = lazyRoom(meta);
  return (
    <ErrorBoundary key={gameId} fallback={(reset) => <LoadFailed onRetry={reset} />}>
      <Suspense fallback={<Loading />}>
        <GameArtContext.Provider value={meta.id}>
          <Game />
        </GameArtContext.Provider>
      </Suspense>
    </ErrorBoundary>
  );
}
