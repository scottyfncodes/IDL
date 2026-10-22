import { Suspense, lazy, useCallback, useMemo, useState, type ComponentType } from 'react';
import { DAILY_GAMES, dailyMeta, type DailyGameMeta } from '../daily/registry';
import { loadDaily, saveDaily } from '../daily/progress';
import { buildShareText, shareUrl } from '../daily/shareText';
import type { DailyGameProps, DailyModule, DailyRecord } from '../daily/types';
import { editionNumber, formatShort, isPlayable, localEditionDate, type EditionDate } from '../lib/date';
import { requestPersistence } from '../lib/storage';
import { shareText } from '../lib/share';
import { href } from '../app/router';
import { ErrorBoundary } from '../app/ErrorBoundary';
import { GameScreen } from '../ui/GameScreen';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { IconShare } from '../ui/icons';
import { LoadFailed, Loading, NotFound } from './States';
import { DailyStatsView } from '../daily/DailyStatsView';

// Cache lazy modules so each game's chunk is requested once.
const moduleCache = new Map<string, Promise<{ default: DailyModule }>>();
function loadModule(meta: DailyGameMeta) {
  let p = moduleCache.get(meta.id);
  if (!p) {
    p = meta.load();
    p.catch(() => moduleCache.delete(meta.id));
    moduleCache.set(meta.id, p);
  }
  return p;
}

function CompletionPanel({ meta, date, record, module, puzzle }: { meta: DailyGameMeta; date: EditionDate; record: DailyRecord; module: DailyModule; puzzle: unknown }) {
  const toast = useToast();
  const won = record.status === 'won';
  const next = useMemo(() => {
    const idx = DAILY_GAMES.findIndex((g) => g.id === meta.id);
    const order = [...DAILY_GAMES.slice(idx + 1), ...DAILY_GAMES.slice(0, idx)];
    return order.find((g) => {
      const r = loadDaily(g.id, date);
      return !r || r.status === 'playing';
    });
  }, [meta.id, date]);
  const Reveal = module.Reveal;

  const onShare = async () => {
    if (!record.result) return;
    const outcome = await shareText(buildShareText(meta.name, date, record.result, shareUrl()));
    if (outcome === 'copied') toast.show('Result copied, no spoilers');
    else if (outcome === 'failed') toast.show('Sharing isn’t available here');
  };

  return (
    <section className={`completion anim-rise is-${record.status}`} aria-labelledby="completion-title">
      <p className="eyebrow">{won ? 'Solved' : 'Finished'}</p>
      <h2 id="completion-title" className="completion__score display">{record.result?.score ?? (won ? 'Solved' : 'Not this time')}</h2>
      {record.result?.grid && record.result.grid.length > 0 && (
        <pre className="completion__grid" aria-label="Result grid">{record.result.grid.join('\n')}</pre>
      )}
      <div className="completion__actions">
        <Button variant="secondary" icon={<IconShare size={18} />} onClick={onShare} disabled={!record.result}>
          Share result
        </Button>
        {next ? (
          <a className="btn btn--primary btn--md" href={href(`/daily/${next.id}/${date}`)}>
            <span>Next: {next.name}</span>
          </a>
        ) : (
          <a className="btn btn--primary btn--md" href={href(date === localEditionDate() ? '/today' : `/edition/${date}`)}>
            <span>Back to the edition</span>
          </a>
        )}
      </div>
      {Reveal && (
        <div className="completion__reveal">
          <Reveal puzzle={puzzle} record={record} />
        </div>
      )}
      <div className="completion__stats">
        <h3 className="completion__stats-title display">Your {meta.name} record</h3>
        <DailyStatsView game={meta.id} highlight={date} />
      </div>
    </section>
  );
}

function DailyPlay({ meta, date, module }: { meta: DailyGameMeta; date: EditionDate; module: DailyModule }) {
  const puzzle = useMemo(() => module.getPuzzle(date), [module, date]);
  const [record, setRecord] = useState<DailyRecord | undefined>(() => loadDaily(meta.id, date));
  const save = useCallback<DailyGameProps<unknown, unknown>['save']>(
    (r) => {
      const stored = saveDaily(meta.id, date, r);
      setRecord(stored);
      if (r.status !== 'playing') void requestPersistence();
    },
    [meta.id, date],
  );
  const Game = module.Component as ComponentType<DailyGameProps<unknown, unknown>>;
  const isToday = date === localEditionDate();
  return (
    <GameScreen
      title={meta.name}
      kicker={`No. ${editionNumber(date)} · ${isToday ? 'Today' : formatShort(date)}`}
      backTo={isToday ? '/today' : `/edition/${date}`}
      rules={module.rules}
      className={`daily daily--${meta.id}`}
    >
      <Game key={`${meta.id}:${date}`} date={date} puzzle={puzzle} record={record} save={save} />
      {record && record.status !== 'playing' && <CompletionPanel meta={meta} date={date} record={record} module={module} puzzle={puzzle} />}
    </GameScreen>
  );
}

const lazyCache = new Map<string, ComponentType<{ date: EditionDate }>>();
function lazyDaily(meta: DailyGameMeta) {
  let C = lazyCache.get(meta.id);
  if (!C) {
    C = lazy(async () => {
      const mod = (await loadModule(meta)).default;
      return { default: ({ date }: { date: EditionDate }) => <DailyPlay meta={meta} date={date} module={mod} /> };
    });
    lazyCache.set(meta.id, C);
  }
  return C;
}

export function DailyRoute({ gameId, date }: { gameId: string; date?: string }) {
  const meta = dailyMeta(gameId);
  const today = localEditionDate();
  const d = date ?? today;
  if (!meta) return <NotFound />;
  if (!isPlayable(d, today)) {
    return (
      <NotFound
        title={d > today ? 'Not published yet' : 'No edition that day'}
        message={d > today ? 'This puzzle arrives on its date. Today’s edition is ready now.' : 'The archive begins on September 1, 2026.'}
      />
    );
  }
  const Lazy = lazyDaily(meta);
  return (
    <ErrorBoundary key={`${gameId}:${d}`} fallback={(reset) => <LoadFailed onRetry={reset} />}>
      <Suspense fallback={<Loading />}>
        <Lazy date={d} />
      </Suspense>
    </ErrorBoundary>
  );
}
