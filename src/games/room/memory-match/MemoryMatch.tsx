import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { usePersistentState } from '../../../lib/storage';
import { recordRoomResult } from '../../../room/stats';
import { freshSeed } from '../../../lib/rng';
import { GameScreen } from '../../../ui/GameScreen';
import { Button } from '../../../ui/Button';
import { Confirm } from '../../../ui/Confirm';
import { Segmented } from '../../../ui/Segmented';
import { IconCheck } from '../../../ui/icons';
import { motifName } from './content';
import { Motif } from './Motif';
import {
  SIZES,
  flip,
  formatTime,
  isBetter,
  isOver,
  isPending,
  newMatch,
  pairsFor,
  pairsFound,
  settle,
  winner,
  type Best,
  type MatchState,
  type Mode,
  type Player,
  type SizeId,
} from './logic';
import './styles.css';

interface Saved {
  match: MatchState;
  /** Solo clock time banked so far (the running segment lives in a ref). */
  elapsedMs: number;
  best: Partial<Record<SizeId, Best>>;
  /** Was the finished solo game a new best? */
  newBest: boolean;
  /** Has the finished game been recorded in stats? Guards against double counting. */
  recorded?: boolean;
}

const MISMATCH_MS = 800;
const NAMES = ['Player 1', 'Player 2'] as const;

const initial = (): Saved => ({ match: newMatch('solo', '4x4', freshSeed()), elapsedMs: 0, best: {}, newBest: false });

const isValid = (s: Saved | undefined): s is Saved =>
  !!s && !!s.match && Array.isArray(s.match.deck) && Array.isArray(s.match.matchedBy) && s.match.size in SIZES;

function PlayerMark({ p }: { p: Player }) {
  return p === 0 ? (
    <svg viewBox="0 0 20 20" className="mm-pmark" aria-hidden="true"><circle cx="10" cy="10" r="6" /></svg>
  ) : (
    <svg viewBox="0 0 20 20" className="mm-pmark" aria-hidden="true"><rect x="4.5" y="4.5" width="11" height="11" rx="1.5" /></svg>
  );
}

export default function MemoryMatch() {
  const [stored, setStored] = usePersistentState<Saved>('room:memory-match', initial, 1);
  const saved = isValid(stored) ? stored : initial();
  const { match, best } = saved;
  const { mode, size } = match;
  const spec = SIZES[size];
  const over = isOver(match);
  const started = match.moves > 0 || match.open.length > 0;
  const inProgress = started && !over;
  const running = mode === 'solo' && inProgress;

  const [pendingChange, setPendingChange] = useState<null | { mode: Mode; size: SizeId }>(null);
  const [note, setNote] = useState('');
  // After the last pair, the result sits over the board; "View board" lifts it.
  const [viewingBoard, setViewingBoard] = useState(false);
  const playAgainRef = useRef<HTMLButtonElement>(null);
  const afterPlayAgainRef = useRef<HTMLButtonElement>(null);
  // Keep focus on a real control as the result card opens and closes, so
  // keyboard and VoiceOver users never fall back to the top of the page.
  useEffect(() => {
    if (!over) return;
    (viewingBoard ? afterPlayAgainRef : playAgainRef).current?.focus({ preventScroll: true });
  }, [over, viewingBoard]);
  const [, setTick] = useState(0);
  const segStart = useRef<number | null>(null);

  // ---- clock (solo) -------------------------------------------------------
  const bank = (s: Saved): Saved => {
    if (segStart.current === null) return s;
    const now = Date.now();
    const out = { ...s, elapsedMs: s.elapsedMs + (now - segStart.current) };
    segStart.current = now;
    return out;
  };
  const elapsed = saved.elapsedMs + (running && segStart.current !== null ? Date.now() - segStart.current : 0);

  useEffect(() => {
    if (!running) {
      segStart.current = null;
      return;
    }
    if (segStart.current === null) segStart.current = Date.now();
    const id = window.setInterval(() => setTick((t) => t + 1), 500);
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        setStored((prev) => bank(prev));
        segStart.current = null;
      } else if (segStart.current === null) segStart.current = Date.now();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      // Leaving the screen: bank the running time so it doesn't tick while away.
      if (segStart.current !== null) {
        setStored((prev) => bank(prev));
        segStart.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // ---- mismatch turn-back -------------------------------------------------
  const pendingKey = isPending(match) ? match.open.join('-') : '';
  useEffect(() => {
    if (!pendingKey) return;
    const id = window.setTimeout(() => {
      setStored((prev) => (isValid(prev) ? { ...prev, match: settle(prev.match) } : prev));
    }, MISMATCH_MS);
    return () => window.clearTimeout(id);
  }, [pendingKey, setStored]);

  // ---- actions ------------------------------------------------------------
  const onCard = (i: number) => {
    const next = flip(match, i);
    if (next === match) return;
    if (segStart.current === null && mode === 'solo') segStart.current = Date.now();
    let s: Saved = bank({ ...saved, match: next });
    if (next.scores[0] + next.scores[1] > pairsFound(match)) {
      setNote(mode === 'duo' ? `A pair! ${NAMES[next.turn]} goes again.` : `A pair: ${motifName(next.deck[i])}.`);
    } else if (isPending(next)) {
      setNote(mode === 'duo' ? `Not a pair. Over to ${NAMES[next.turn === 0 ? 1 : 0]}.` : 'Not a pair.');
    } else setNote('');

    if (isOver(next)) {
      segStart.current = null;
      if (!saved.recorded) {
        recordRoomResult(
          'memory-match',
          mode === 'solo'
            ? { outcome: 'win', score: { variant: size, value: next.moves, better: 'lower', label: `${next.moves} moves` } }
            : { outcome: 'complete', opponent: 'friend' },
        );
        s = { ...s, recorded: true };
      }
      if (mode === 'solo') {
        const result: Best = { moves: next.moves, ms: s.elapsedMs };
        const isNew = isBetter(result, best[size]);
        s = { ...s, best: isNew ? { ...best, [size]: result } : best, newBest: isNew };
      }
    }
    setStored(s);
  };

  const start = (m: Mode, z: SizeId) => {
    segStart.current = null;
    setViewingBoard(false);
    setNote('');
    setStored({ ...saved, match: newMatch(m, z, freshSeed()), elapsedMs: 0, newBest: false, recorded: false });
  };
  const requestStart = (m: Mode, z: SizeId) => (inProgress ? setPendingChange({ mode: m, size: z }) : start(m, z));

  // ---- view ---------------------------------------------------------------
  const total = pairsFor(size);
  const found = pairsFound(match);
  let status: string;
  if (over) status = mode === 'solo' ? 'Every pair found.' : 'All pairs found.';
  else if (note) status = note;
  else if (mode === 'duo') status = `${NAMES[match.turn]}, turn over two cards.`;
  else status = started ? `${found} of ${total} pairs found` : 'Turn over two cards to find a pair.';

  const w = winner(match);
  const boardStyle = { '--mm-cols': spec.cols, '--mm-rows': spec.rows } as CSSProperties;

  return (
    <GameScreen
      title="Memory Match"
      kicker={mode === 'solo' ? 'Solo' : '2 players · one phone'}
      backTo="/play"
      className="mm-body"
      rules={
        <>
          <p>All cards start face down. Turn over two at a time to find matching pairs.</p>
          <ul>
            <li>A pair stays face up. Two different cards turn back over after a moment. Tap another card to hurry them along.</li>
            <li><strong>Solo:</strong> clear the board in as few moves as you can. A move is two cards. Time breaks ties for your best.</li>
            <li><strong>2 players:</strong> take turns. Find a pair and you go again. Most pairs wins.</li>
            <li>Every picture has its own shape, so colour is only a bonus.</li>
          </ul>
        </>
      }
      menu={[
        { label: 'New game', onSelect: () => requestStart(mode, size) },
        { label: 'Clear best scores', onSelect: () => setStored({ ...saved, best: {} }), destructive: true, disabled: Object.keys(best).length === 0 },
      ]}
    >
      <div className="mm-settings">
        <Segmented<Mode>
          label="Players"
          value={mode}
          options={[{ value: 'solo', label: 'Solo' }, { value: 'duo', label: '2 players' }]}
          onChange={(m) => m !== mode && requestStart(m, size)}
        />
        <Segmented<SizeId>
          label="Board size"
          value={size}
          options={(Object.keys(SIZES) as SizeId[]).map((z) => ({ value: z, label: SIZES[z].label }))}
          onChange={(z) => z !== size && requestStart(mode, z)}
        />
      </div>

      {mode === 'solo' ? (
        <div className="mm-stats" aria-label="Solo progress">
          <span><span className="meta">Moves</span> <strong>{match.moves}</strong></span>
          <span><span className="meta">Time</span> <strong>{formatTime(elapsed)}</strong></span>
          <span><span className="meta">Best</span> <strong>{best[size] ? `${best[size]!.moves} · ${formatTime(best[size]!.ms)}` : 'None yet'}</strong></span>
        </div>
      ) : (
        <div className="scoreboard">
          {([0, 1] as Player[]).map((p) => (
            <span key={p} className={`player-chip player-chip--p${p + 1}`} data-active={!over && match.turn === p}>
              <PlayerMark p={p} />
              <span className="player-chip__name">{NAMES[p]}</span>
              <span className="player-chip__score" aria-label={`${match.scores[p]} pairs`}>{match.scores[p]}</span>
            </span>
          ))}
        </div>
      )}

      {over && viewingBoard ? (
        <div className="button-row mm-after">
          <Button ref={afterPlayAgainRef} variant="primary" size="sm" onClick={() => start(mode, size)}>Play again</Button>
          <Button variant="quiet" size="sm" onClick={() => setViewingBoard(false)}>Show result</Button>
        </div>
      ) : (
        <p className="status-line" aria-live="polite">{status}</p>
      )}

      <div className="mm-stage">
      <div className={`mm-board${over ? ' is-over' : ''}`} style={boardStyle} role="group" aria-label={`${spec.label} cards`}>
        {match.deck.map((motif, i) => {
          const by = match.matchedBy[i];
          const matched = by !== null;
          const up = matched || match.open.includes(i);
          const miss = isPending(match) && match.open.includes(i);
          const label = !up
            ? `Card ${i + 1}, face down`
            : `Card ${i + 1}, ${motifName(motif)}${matched ? (mode === 'duo' ? `, matched by ${NAMES[by]}` : ', matched') : ''}`;
          return (
            <button
              key={i}
              type="button"
              className={`mm-card${up ? ' is-up' : ''}${matched ? ' is-matched' : ''}${miss ? ' is-miss' : ''}`}
              aria-label={label}
              aria-disabled={matched || over || undefined}
              onClick={() => onCard(i)}
            >
              <span className="mm-card__inner">
                <span className="mm-card__back" aria-hidden="true" />
                <span className="mm-card__front" aria-hidden="true">
                  {/* The motif is only in the DOM while face up. */}
                  {up && <Motif id={motif} />}
                  {matched && (
                    <span className={`mm-badge${mode === 'duo' ? ` mm-badge--p${by + 1}` : ''}`}>
                      {mode === 'duo' ? <PlayerMark p={by} /> : <IconCheck size={12} />}
                    </span>
                  )}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      {over && !viewingBoard && (
        <div className="mm-result">
        <div className="end-card" role="region" aria-label="Result">
          {mode === 'solo' ? (
            <>
              <p className="eyebrow">{saved.newBest ? 'New best' : 'Board cleared'}</p>
              <h2 className="end-card__title display">{`${match.moves} moves · ${formatTime(saved.elapsedMs)}`}</h2>
              <p className="muted">
                {saved.newBest
                  ? `Your best on ${spec.label} so far.`
                  : best[size]
                    ? `Best on ${spec.label}: ${best[size]!.moves} moves in ${formatTime(best[size]!.ms)}.`
                    : ''}
                {` A perfect game is ${total} moves.`}
              </p>
            </>
          ) : (
            <>
              <p className="eyebrow">Final pairs {match.scores[0]}–{match.scores[1]}</p>
              <h2 className="end-card__title display">{w === null ? 'A tie. Sharp memories.' : `${NAMES[w!]} wins`}</h2>
            </>
          )}
          <div className="end-card__actions">
            <Button ref={playAgainRef} variant="primary" size="lg" onClick={() => start(mode, size)}>Play again</Button>
            <Button variant="quiet" onClick={() => setViewingBoard(true)}>View board</Button>
          </div>
        </div>
        </div>
      )}
      </div>

      <Confirm
        open={pendingChange !== null}
        title="Start a new game?"
        message="This board will be shuffled away and its pairs lost."
        confirmLabel="New game"
        onCancel={() => setPendingChange(null)}
        onConfirm={() => {
          if (pendingChange) start(pendingChange.mode, pendingChange.size);
          setPendingChange(null);
        }}
      />
    </GameScreen>
  );
}
