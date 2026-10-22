import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { usePersistentState } from '../../../lib/storage';
import { createRng, freshSeed } from '../../../lib/rng';
import { recordRoomResult, type Opponent } from '../../../room/stats';
import { COMPUTER_NAME, HUMAN_NAME, useComputerMove } from '../../../room/computer';
import { GameScreen } from '../../../ui/GameScreen';
import { Button } from '../../../ui/Button';
import { Confirm } from '../../../ui/Confirm';
import { OpponentPicker } from '../../../ui/OpponentPicker';
import { IconUndo } from '../../../ui/icons';
import {
  CELLS,
  SIZE,
  chooseMove,
  counts,
  flipsFor,
  isOver,
  legalMoves,
  newGame,
  play,
  squareName,
  undo,
  winnerOf,
  type Game,
  type Player,
} from './logic';
import './styles.css';

interface Saved {
  opponent: Opponent;
  game: Game;
  hints: boolean;
  /** Has this finished game been sent to the room stats? */
  recorded: boolean;
  /** Seeds the computer's tie-breaks for this game. */
  seed: number;
}

const initial = (): Saved => ({ opponent: 'friend', game: newGame(), hints: true, recorded: false, seed: freshSeed() });

const isValid = (s: Saved | undefined): s is Saved =>
  !!s && !!s.game && Array.isArray(s.game.board) && s.game.board.length === CELLS && Array.isArray(s.game.history);

/** Player 1: solid disc with a fine inner ring. Player 2: paper-filled disc with a strong outline. */
export function Disc({ player, className = '' }: { player: Player; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={`rv-disc rv-disc--p${player} ${className}`.trim()} aria-hidden="true">
      <circle className="rv-disc__body" cx="20" cy="20" r={player === 1 ? 18 : 16.75} />
      {player === 1 && <circle className="rv-disc__mark" cx="20" cy="20" r="9" />}
    </svg>
  );
}

export default function Reversi() {
  const [stored, setSaved] = usePersistentState<Saved>('room:reversi', initial, 1);
  const saved = isValid(stored) ? stored : initial();
  const { opponent, game, hints } = saved;
  const vsComputer = opponent !== 'friend';
  const over = isOver(game);
  const n = counts(game.board);
  const winner = over ? winnerOf(game.board) : null;

  const [pending, setPending] = useState<null | { opponent: Opponent }>(null);
  // Only animate moves made while this screen is open (not on reload).
  const [animAt, setAnimAt] = useState(-1);
  const [shake, setShake] = useState<number | null>(null);
  const [viewingBoard, setViewingBoard] = useState(false);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rematchRef = useRef<HTMLButtonElement>(null);

  const name = (p: Player) => (vsComputer ? (p === 1 ? HUMAN_NAME : COMPUTER_NAME) : `Player ${p}`);
  const computerTurn = vsComputer && !over && game.turn === 2;
  const humanCanPlay = !over && !computerTurn;
  const legal = humanCanPlay ? new Set(legalMoves(game.board, game.turn)) : new Set<number>();

  useEffect(() => {
    if (over && !viewingBoard) rematchRef.current?.focus({ preventScroll: true });
  }, [over, viewingBoard]);

  /** Store the next position; on the final move, record the result once. */
  const commit = useCallback(
    (next: Game) => {
      setAnimAt(next.history.length);
      setShake(null);
      let recorded = saved.recorded;
      if (isOver(next) && !recorded) {
        const w = winnerOf(next.board);
        recordRoomResult(
          'reversi',
          vsComputer
            ? { outcome: w === 1 ? 'win' : w === 2 ? 'loss' : 'draw', opponent }
            : { outcome: 'complete', opponent: 'friend' },
        );
        recorded = true;
      }
      setSaved({ ...saved, game: next, recorded });
    },
    [saved, setSaved, vsComputer, opponent],
  );

  const onCell = (i: number) => {
    if (!humanCanPlay) return;
    const next = play(game, i);
    if (!next) {
      if (game.board[i] === 0) setShake(i);
      return;
    }
    commit(next);
  };

  const computerMove = useCallback(() => {
    if (!vsComputer || isOver(game) || game.turn !== 2) return;
    const rng = createRng(`${saved.seed}:${game.history.length}`);
    const m = chooseMove(game.board, 2, opponent as 'easy' | 'hard', rng);
    if (m === null) return;
    const next = play(game, m);
    if (next) commit(next);
  }, [vsComputer, game, saved.seed, opponent, commit]);
  useComputerMove(computerTurn, computerMove, 560);

  const start = (o: Opponent) => {
    setAnimAt(-1);
    setShake(null);
    setViewingBoard(false);
    setSaved({ ...saved, opponent: o, game: newGame(), recorded: false, seed: freshSeed() });
  };
  const inProgress = game.history.length > 0 && !over;
  const requestStart = (o: Opponent) => (inProgress ? setPending({ opponent: o }) : start(o));

  // Against idl, undo takes back your last move and idl's reply.
  const undone = over ? null : vsComputer ? undo(game, 1) : undo(game);
  const onUndo = () => {
    if (!undone) return;
    setAnimAt(-1);
    setShake(null);
    setSaved({ ...saved, game: undone });
  };

  const onKey = (ev: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const r = Math.floor(i / SIZE);
    const c = i % SIZE;
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const d = moves[ev.key];
    if (!d) return;
    ev.preventDefault();
    const nr = (r + d[0] + SIZE) % SIZE;
    const nc = (c + d[1] + SIZE) % SIZE;
    cellRefs.current[nr * SIZE + nc]?.focus();
  };

  // What just changed, for the flip animation and the last-move marker.
  const prev = game.history.length > 0 ? game.history[game.history.length - 1].board : null;
  const animate = animAt === game.history.length && prev !== null;

  let status: string;
  if (over) status = winner === 0 ? `A draw, ${n[1]}–${n[2]}` : `${name(winner as Player)} ${vsComputer && winner === 1 ? 'win' : 'wins'}, ${Math.max(n[1], n[2])}–${Math.min(n[1], n[2])}`;
  else if (computerTurn) status = game.passed === 1 ? `No moves, you pass. ${COMPUTER_NAME} is thinking…` : `${COMPUTER_NAME} is thinking…`;
  else if (game.passed) {
    const passer = vsComputer ? (game.passed === 1 ? 'you pass' : `${COMPUTER_NAME} passes`) : `Player ${game.passed} passes`;
    status = `No moves: ${passer}. ${vsComputer ? 'Your move again' : `Player ${game.turn} again`}.`;
  } else status = vsComputer ? 'Your move' : `Player ${game.turn} to move`;

  let endTitle = '';
  if (over) {
    if (winner === 0) endTitle = 'A draw';
    else if (vsComputer) endTitle = winner === 1 ? 'You win' : `${COMPUTER_NAME} wins`;
    else endTitle = `Player ${winner} wins`;
  }

  const cellLabel = (i: number) => {
    const c = game.board[i];
    const base = squareName(i).toUpperCase();
    if (c) return `${base}: ${name(c)}${c === 1 ? ', solid disc' : ', outlined disc'}${game.last === i ? ', last move' : ''}`;
    return `${base}: empty${legal.has(i) ? `, can play, flips ${flipsFor(game.board, i, game.turn).length}` : ''}`;
  };

  return (
    <GameScreen
      title="Reversi"
      kicker={vsComputer ? `vs ${COMPUTER_NAME} · ${opponent}` : '2 players · one phone'}
      backTo="/play"
      className="rv-body"
      rules={
        <>
          <p>Place a disc so that it traps a straight line of your opponent’s discs between it and another of yours. Every trapped disc flips to your side.</p>
          <ul>
            <li><strong>{vsComputer ? 'You' : 'Player 1'}</strong> play{vsComputer ? '' : 's'} the solid discs marked with a ring and move{vsComputer ? '' : 's'} first; <strong>{vsComputer ? COMPUTER_NAME : 'Player 2'}</strong> plays the outlined discs.</li>
            <li>Lines run across, down or diagonally, and one move can flip several lines at once.</li>
            <li>A move must flip at least one disc. With no such move, you pass.</li>
            <li>When neither side can move, the most discs wins. Small dots show where you can play.</li>
          </ul>
        </>
      }
      menu={[
        { label: 'New game', onSelect: () => requestStart(opponent) },
        { label: vsComputer ? 'Undo your last move' : 'Undo last move', onSelect: onUndo, disabled: !undone || computerTurn },
        { label: hints ? 'Hide move hints' : 'Show move hints', onSelect: () => setSaved({ ...saved, hints: !hints }) },
      ]}
    >
      <div className="rv-settings">
        <OpponentPicker value={opponent} onChange={(o) => o !== opponent && requestStart(o)} />
      </div>

      <div className="scoreboard">
        {([1, 2] as Player[]).map((p) => (
          <span key={p} className={`player-chip player-chip--p${p}`} data-active={!over && game.turn === p}>
            <Disc player={p} className="rv-chip-disc" />
            <span className="player-chip__name">{name(p)}</span>
            <span className="player-chip__score" aria-label={`${n[p]} discs`}>{n[p]}</span>
          </span>
        ))}
      </div>

      {over && viewingBoard ? (
        <div className="button-row rv-after">
          <Button variant="primary" size="sm" onClick={() => start(opponent)}>Rematch</Button>
          <Button variant="quiet" size="sm" onClick={() => setViewingBoard(false)}>Show result</Button>
        </div>
      ) : (
        <p className="status-line rv-status" aria-live="polite">
          {!over && <Disc player={game.turn} className="rv-chip-disc" />}
          <span>{status}</span>
        </p>
      )}

      <div className="rv-stage">
        <div
          className={`rv-board${over ? ' is-over' : ''}${computerTurn ? ' is-waiting' : ''}`}
          role="group"
          aria-label="Reversi board, 8 by 8"
        >
          {game.board.map((c, i) => {
            const isLegal = legal.has(i);
            const flipped = animate && c !== 0 && prev![i] !== 0 && prev![i] !== c;
            const placed = animate && game.last === i;
            return (
              <button
                key={i}
                ref={(el) => (cellRefs.current[i] = el)}
                type="button"
                className={`rv-cell${isLegal ? ' is-legal' : ''}${game.last === i ? ' is-last' : ''}${shake === i ? ' is-shake' : ''}`}
                aria-label={cellLabel(i)}
                aria-disabled={!isLegal || undefined}
                tabIndex={i === (game.last ?? 27) ? 0 : -1}
                onClick={() => onCell(i)}
                onKeyDown={(e) => onKey(e, i)}
                onAnimationEnd={() => shake === i && setShake(null)}
              >
                {c !== 0 && (
                  <Disc
                    key={`${i}-${c}`}
                    player={c}
                    className={flipped ? 'is-flipping' : placed ? 'is-placed' : ''}
                  />
                )}
                {c === 0 && isLegal && hints && <span className="rv-hint" aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        {over && !viewingBoard && (
          <div className="rv-result">
            <div className="end-card" role="region" aria-label="Result">
              <p className="eyebrow">Final discs {n[1]}–{n[2]}</p>
              <h2 className="end-card__title display">{endTitle}</h2>
              <p className="muted rv-result__line">
                {winner === 0
                  ? 'Even to the last disc.'
                  : `${name(1)} ${n[1]}, ${name(2)} ${n[2]}${n.empty ? ` · ${n.empty} squares left empty` : ''}`}
              </p>
              <div className="end-card__actions">
                <Button ref={rematchRef} variant="primary" size="lg" onClick={() => start(opponent)}>Rematch</Button>
                <Button variant="quiet" onClick={() => setViewingBoard(true)}>View board</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {!over && (
        <div className="button-row">
          <Button variant="quiet" icon={<IconUndo size={18} />} onClick={onUndo} disabled={!undone || computerTurn}>
            Undo
          </Button>
          <Button variant="quiet" onClick={() => requestStart(opponent)} disabled={game.history.length === 0}>
            New game
          </Button>
        </div>
      )}

      <Confirm
        open={pending !== null}
        title="Start a new game?"
        message="This game will end here and its discs will be cleared."
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
