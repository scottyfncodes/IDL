import { EndArt } from '../../../art/EndArt';
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePersistentState } from '../../../lib/storage';
import { createRng, freshSeed } from '../../../lib/rng';
import { recordRoomResult, type Opponent } from '../../../room/stats';
import { COMPUTER_NAME, HUMAN_NAME, useComputerMove } from '../../../room/computer';
import { GameScreen } from '../../../ui/GameScreen';
import { Button } from '../../../ui/Button';
import { Confirm } from '../../../ui/Confirm';
import { OpponentPicker } from '../../../ui/OpponentPicker';
import {
  STORE,
  chooseMove,
  isOver,
  newGame,
  ownerOf,
  pitNumber,
  rowOf,
  score,
  sow,
  winnerOf,
  type MoveResult,
  type Player,
  type State,
} from './logic';
import './styles.css';

interface Saved {
  opponent: Opponent;
  game: State;
  /** Where the most recent move's last seed landed. */
  lastPit: number | null;
  /** What the most recent move did, for the status line. */
  note: { by: Player; extra: boolean; captured: number } | null;
  /** Seeds each side banked when the game ended. */
  sweep: { 1: number; 2: number } | null;
  moves: number;
  /** Has this finished game been sent to the room stats? */
  recorded: boolean;
  seed: number;
}

const initial = (): Saved => ({
  opponent: 'friend',
  game: newGame(),
  lastPit: null,
  note: null,
  sweep: null,
  moves: 0,
  recorded: false,
  seed: freshSeed(),
});

const isValid = (s: Saved | undefined): s is Saved =>
  !!s && !!s.game && Array.isArray(s.game.pits) && s.game.pits.length === 14 && (s.game.turn === 1 || s.game.turn === 2);

/** Above this many seeds a pit shows its number only. */
const DOT_CAP = 12;
/** Total time budget for the sowing animation. */
const SOW_MS = 600;

interface Anim {
  from: number[];
  origin: number;
  path: number[];
  step: number;
}

function PlayerMark({ p }: { p: Player }) {
  return p === 1 ? (
    <svg viewBox="0 0 20 20" className="mnc-pmark" aria-hidden="true"><circle cx="10" cy="10" r="6" /></svg>
  ) : (
    <svg viewBox="0 0 20 20" className="mnc-pmark" aria-hidden="true"><rect x="4.5" y="4.5" width="11" height="11" rx="1.5" /></svg>
  );
}

function Seeds({ n }: { n: number }) {
  if (n === 0 || n > DOT_CAP) return null;
  return (
    <span className="mnc-seeds" aria-hidden="true">
      {Array.from({ length: n }, (_, k) => (
        <span key={k} className="mnc-seed" />
      ))}
    </span>
  );
}

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export default function Mancala() {
  const [stored, setSaved] = usePersistentState<Saved>('room:mancala', initial, 1);
  const saved = isValid(stored) ? stored : initial();
  const { opponent, game, note } = saved;
  const vsComputer = opponent !== 'friend';
  const over = isOver(game);
  const winner = over ? winnerOf(game) : null;

  const [anim, setAnim] = useState<Anim | null>(null);
  const [pending, setPending] = useState<null | { opponent: Opponent }>(null);
  const rematchRef = useRef<HTMLButtonElement>(null);

  const name = (p: Player) => (vsComputer ? (p === 1 ? HUMAN_NAME : COMPUTER_NAME) : `Player ${p}`);
  const computerTurn = vsComputer && !over && game.turn === 2;
  const busy = anim !== null;

  // Step the sowing animation seed by seed.
  useEffect(() => {
    if (!anim) return;
    const stepMs = Math.min(110, Math.floor(SOW_MS / Math.max(1, anim.path.length)));
    const id = window.setTimeout(
      () => setAnim((a) => (!a ? a : a.step >= a.path.length ? null : { ...a, step: a.step + 1 })),
      anim.step >= anim.path.length ? 160 : stepMs,
    );
    return () => window.clearTimeout(id);
  }, [anim]);

  useEffect(() => {
    if (over && !busy) rematchRef.current?.focus({ preventScroll: true });
  }, [over, busy]);

  const commit = useCallback(
    (pit: number, r: MoveResult) => {
      if (!reducedMotion()) setAnim({ from: game.pits, origin: pit, path: r.path, step: 1 });
      let recorded = saved.recorded;
      if (r.sweep && !recorded) {
        const w = winnerOf(r.state);
        recordRoomResult(
          'mancala',
          vsComputer
            ? { outcome: w === 1 ? 'win' : w === 2 ? 'loss' : 'draw', opponent }
            : { outcome: 'complete', opponent: 'friend' },
        );
        recorded = true;
      }
      setSaved({
        ...saved,
        game: r.state,
        lastPit: r.last,
        note: { by: game.turn, extra: r.extraTurn && !r.sweep, captured: r.captured },
        sweep: r.sweep,
        moves: saved.moves + 1,
        recorded,
      });
    },
    [game, saved, setSaved, vsComputer, opponent],
  );

  const onPit = (i: number) => {
    if (busy || over || computerTurn) return;
    const r = sow(game, i);
    if (r) commit(i, r);
  };

  const computerMove = useCallback(() => {
    if (!vsComputer || isOver(game) || game.turn !== 2) return;
    const m = chooseMove(game, opponent as 'easy' | 'hard', createRng(`${saved.seed}:${saved.moves}`));
    if (m === null) return;
    const r = sow(game, m);
    if (r) commit(m, r);
  }, [vsComputer, game, opponent, saved.seed, saved.moves, commit]);
  useComputerMove(computerTurn && !busy, computerMove, 650);

  const start = (o: Opponent) => {
    setAnim(null);
    setSaved({ ...initial(), opponent: o });
  };
  const inProgress = saved.moves > 0 && !over;
  const requestStart = (o: Opponent) => (inProgress ? setPending({ opponent: o }) : start(o));

  // The pits on screen: mid-animation frame, or the settled position.
  let shown = game.pits;
  let highlight = saved.lastPit;
  if (anim) {
    shown = anim.from.slice();
    shown[anim.origin] = 0;
    for (let k = 0; k < anim.step && k < anim.path.length; k++) shown[anim.path[k]]++;
    highlight = anim.path[Math.min(anim.step, anim.path.length) - 1];
  }

  const turnText = (p: Player) =>
    vsComputer ? (p === 1 ? 'Your turn.' : `${COMPUTER_NAME} is thinking…`) : `Player ${p}’s turn.`;
  // Scores follow the animation, so a capture lands when the seeds do.
  const sc = score(shown);
  let status: string;
  if (anim) status = `${name(note?.by ?? game.turn)} ${vsComputer && note?.by === 1 ? 'sow' : 'sows'} ${anim.path.length} seed${anim.path.length === 1 ? '' : 's'}…`;
  else if (over) status = winner === 0 ? `A draw, ${sc[1]}–${sc[2]}` : `${name(winner as Player)} ${vsComputer && winner === 1 ? 'win' : 'wins'}, ${Math.max(sc[1], sc[2])}–${Math.min(sc[1], sc[2])}`;
  else if (note?.extra) status = vsComputer ? (note.by === 1 ? 'Last seed in your store. Go again.' : `Extra turn for ${COMPUTER_NAME}. Thinking…`) : `Last seed in the store. Player ${note.by} goes again.`;
  else if (note && note.captured > 0) {
    const who = vsComputer && note.by === 1 ? 'You capture' : `${name(note.by)} captures`;
    status = `${who} ${note.captured + 1} seeds. ${turnText(game.turn)}`;
  } else status = saved.moves === 0 && !vsComputer ? 'Player 1 starts. Tap a pit on your side.' : turnText(game.turn);

  const canTap = (i: number) => !busy && !over && !computerTurn && ownerOf(i) === game.turn && game.pits[i] > 0;

  const pitLabel = (i: number) => {
    const owner = ownerOf(i)!;
    const whose = vsComputer ? (owner === 1 ? 'Your' : `${COMPUTER_NAME}’s`) : `Player ${owner}`;
    return `${whose} pit ${pitNumber(i)}: ${shown[i]} seed${shown[i] === 1 ? '' : 's'}${highlight === i ? ', last seed' : ''}`;
  };

  const renderPit = (i: number) => {
    const owner = ownerOf(i)!;
    return (
      <button
        key={i}
        type="button"
        className={`mnc-pit mnc-pit--p${owner}${highlight === i ? ' is-last' : ''}${!over && game.turn === owner && !computerTurn ? ' is-turn' : ''}`}
        aria-label={pitLabel(i)}
        disabled={!canTap(i)}
        onClick={() => onPit(i)}
      >
        <span className="mnc-count">{shown[i]}</span>
        <Seeds n={shown[i]} />
      </button>
    );
  };

  const renderStore = (p: Player) => {
    const i = STORE[p];
    return (
      <div
        className={`mnc-store mnc-store--p${p}${highlight === i ? ' is-last' : ''}`}
        role="img"
        aria-label={`${vsComputer ? (p === 1 ? 'Your' : `${COMPUTER_NAME}’s`) : `Player ${p}’s`} store: ${shown[i]} seeds`}
      >
        <PlayerMark p={p} />
        <span className="mnc-store__count">{shown[i]}</span>
      </div>
    );
  };

  let endTitle = '';
  if (over) {
    if (winner === 0) endTitle = 'A draw';
    else if (vsComputer) endTitle = winner === 1 ? 'You win' : `${COMPUTER_NAME} wins`;
    else endTitle = `Player ${winner} wins`;
  }
  const sweepLine = (() => {
    const sw = saved.sweep;
    if (!sw) return '';
    const parts = ([1, 2] as Player[])
      .filter((p) => sw[p] > 0)
      .map((p) => `${name(p)} banked ${sw[p]} left on ${vsComputer && p === 1 ? 'your' : 'their'} side`);
    return parts.length ? `${parts.join(' · ')}.` : '';
  })();

  return (
    <GameScreen
      title="Mancala"
      kicker={vsComputer ? `vs ${COMPUTER_NAME} · ${opponent}` : '2 players · one phone'}
      backTo="/play"
      className="mnc-body"
      rules={
        <>
          <p>Each side has six pits and a store. Pick up every seed in one of your pits and sow them one by one, counter-clockwise, into the following pits.</p>
          <ul>
            <li><strong>{vsComputer ? 'Your' : 'Player 1’s'}</strong> pits run along the bottom with the store on the right; <strong>{vsComputer ? `${COMPUTER_NAME}’s` : 'Player 2’s'}</strong> run along the top with the store on the left.</li>
            <li>You sow into your own store but skip your opponent’s.</li>
            <li>Last seed in your store? Take another turn.</li>
            <li>Last seed in an <strong>empty pit on your side</strong>, with seeds in the pit straight across: capture both into your store. If the pit across is empty, nothing is captured.</li>
            <li>When either row runs out, the game ends and each player keeps the seeds still on their own side. Most seeds in the store wins.</li>
          </ul>
        </>
      }
      menu={[{ label: 'New game', onSelect: () => requestStart(opponent) }]}
    >
      <div className="mnc-settings">
        <OpponentPicker value={opponent} onChange={(o) => o !== opponent && requestStart(o)} />
      </div>

      <div className="scoreboard">
        {([1, 2] as Player[]).map((p) => (
          <span key={p} className={`player-chip player-chip--p${p}`} data-active={!over && game.turn === p}>
            <PlayerMark p={p} />
            <span className="player-chip__name">{name(p)}</span>
            <span className="player-chip__score" aria-label={`${sc[p]} seeds in store`}>{sc[p]}</span>
          </span>
        ))}
      </div>

      <p className="status-line mnc-status" aria-live="polite">{status}</p>

      <div className={`mnc-board${over ? ' is-over' : ''}`} role="group" aria-label="Mancala board">
        {renderStore(2)}
        <div className="mnc-row mnc-row--top">{rowOf(2).slice().reverse().map(renderPit)}</div>
        <div className="mnc-row mnc-row--bottom">{rowOf(1).map(renderPit)}</div>
        {renderStore(1)}
      </div>
      <p className="meta mnc-caption">
        {vsComputer ? 'Your' : 'Player 1’s'} pits: bottom row · sowing runs counter-clockwise
      </p>

      {over && !busy && (
        <div className="end-card" role="region" aria-label="Result">
          <EndArt />
          <p className="eyebrow">Final stores {sc[1]}–{sc[2]}</p>
          <h2 className="end-card__title display">{endTitle}</h2>
          {sweepLine && <p className="muted mnc-sweep">{sweepLine}</p>}
          <div className="end-card__actions">
            <Button ref={rematchRef} variant="primary" size="lg" onClick={() => start(opponent)}>Rematch</Button>
          </div>
        </div>
      )}

      <Confirm
        open={pending !== null}
        title="Start a new game?"
        message="This game ends here and the seeds go back to four a pit."
        confirmLabel="New game"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          if (pending) start(pending.opponent);
          setPending(null);
        }}
      />
    </GameScreen>
  );
}
