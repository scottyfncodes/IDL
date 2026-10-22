import { useCallback, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { load, usePersistentState } from '../../../lib/storage';
import { createRng, freshSeed } from '../../../lib/rng';
import { OpponentPicker } from '../../../ui/OpponentPicker';
import { COMPUTER_NAME, HUMAN_NAME, useComputerMove } from '../../../room/computer';
import { recordRoomResult, type Opponent, type RoomResult } from '../../../room/stats';
import { GameScreen } from '../../../ui/GameScreen';
import { Button } from '../../../ui/Button';
import { Confirm } from '../../../ui/Confirm';
import { IconUndo } from '../../../ui/icons';
import { boardOf, chooseMove, COLS, drop, landingRow, newGame, other, outcome, ROWS, turnOf, undo, undoForHuman, type Game, type Outcome, type Player } from './logic';
import './styles.css';

type Score = { 1: number; 2: number; draws: number };

interface Saved {
  game: Game;
  /** Against the computer, the human is always player 1 (clay, ✕). */
  opponent: Opponent;
  /** Running score per opponent. */
  scores: Record<Opponent, Score>;
  /** Has the finished round been scored and recorded? Guards against double counting. */
  counted: boolean;
}

const KEY = 'room:connect-four';
const zero = (): Score => ({ 1: 0, 2: 0, draws: 0 });
const fresh = (): Saved => ({ game: newGame(1), opponent: 'friend', scores: { friend: zero(), easy: zero(), hard: zero() }, counted: false });

/** v1 kept a single friend score; carry it (and any round in progress) over. */
function initial(): Saved {
  const v1 = load<{ game: Game; score: Score; counted: boolean } | null>(KEY, null, 1);
  const base = fresh();
  if (!v1 || !v1.game || !Array.isArray(v1.game.moves) || !v1.score) return base;
  return { ...base, game: v1.game, scores: { ...base.scores, friend: { ...zero(), ...v1.score } }, counted: !!v1.counted };
}

const FRIEND_NAMES: Record<Player, string> = { 1: 'Player 1', 2: 'Player 2' };
const IDL_NAMES: Record<Player, string> = { 1: HUMAN_NAME, 2: COMPUTER_NAME };
const OPPONENT_LABEL: Record<Opponent, string> = { friend: 'a friend', easy: 'idl · easy', hard: 'idl · hard' };

function resultFor(o: Outcome, opponent: Opponent): RoomResult {
  if (opponent === 'friend') return { outcome: 'complete', opponent };
  return { outcome: o.draw ? 'draw' : o.winner === 1 ? 'win' : 'loss', opponent };
}
const SHAPE: Record<Player, string> = { 1: 'cross', 2: 'ring' };

/** A disc with an inner mark: ✕ for player 1, ring for player 2. */
function Disc({ player, className = '', style }: { player: Player; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 40 40" className={`c4-disc c4-disc--p${player} ${className}`.trim()} style={style} aria-hidden="true">
      <circle className="c4-disc__body" cx="20" cy="20" r="19" />
      {player === 1 ? <path className="c4-disc__mark" d="M14 14l12 12M26 14L14 26" /> : <circle className="c4-disc__mark" cx="20" cy="20" r="8" />}
    </svg>
  );
}

export default function ConnectFour() {
  const [saved, setSaved] = usePersistentState<Saved>(KEY, initial, 2);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingOpponent, setPendingOpponent] = useState<Opponent | null>(null);
  const [confirmRestart, setConfirmRestart] = useState(false);
  // Index of the move that should animate (only discs dropped in this session).
  const [animMove, setAnimMove] = useState(-1);
  const [shakeCol, setShakeCol] = useState<number | null>(null);
  const colRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const { game, opponent } = saved;
  const score = saved.scores[opponent];
  const vsIdl = opponent !== 'friend';
  const NAMES = vsIdl ? IDL_NAMES : FRIEND_NAMES;
  const board = boardOf(game);
  const result = outcome(board);
  const over = result.winner !== null || result.draw;
  const current = turnOf(game);
  const idlTurn = vsIdl && !over && current === 2;
  const undone = vsIdl ? undoForHuman(game, 1) : undo(game);
  const winSet = new Set(result.cells?.map(([r, c]) => `${r}-${c}`));
  const lastIndex = game.moves.length - 1;
  const lastCol = lastIndex >= 0 ? game.moves[lastIndex] : -1;
  const lastRow = lastCol >= 0 ? landingRow(boardOf({ first: game.first, moves: game.moves.slice(0, -1) }), lastCol) : -1;

  /** Commit a move from either side; scores and records the round exactly once when it ends. */
  const commit = useCallback(
    (next: Game) => {
      const o = outcome(boardOf(next));
      const done = o.winner !== null || o.draw;
      const s = saved.scores[saved.opponent];
      const counting = done && !saved.counted;
      if (counting) recordRoomResult('connect-four', resultFor(o, saved.opponent));
      setAnimMove(next.moves.length - 1);
      setShakeCol(null);
      setSaved({
        ...saved,
        game: next,
        counted: done,
        scores: counting
          ? { ...saved.scores, [saved.opponent]: { 1: s[1] + (o.winner === 1 ? 1 : 0), 2: s[2] + (o.winner === 2 ? 1 : 0), draws: s.draws + (o.draw ? 1 : 0) } }
          : saved.scores,
      });
    },
    [saved, setSaved],
  );

  const onColumn = (col: number) => {
    if (over || idlTurn) return;
    const res = drop(game, col);
    if (!res) {
      setShakeCol(col);
      return;
    }
    commit(res.game);
  };

  const idlMove = useCallback(() => {
    if (saved.opponent === 'friend') return;
    const col = chooseMove(saved.game, saved.opponent, createRng(freshSeed()));
    const res = col === null ? null : drop(saved.game, col);
    if (res) commit(res.game);
  }, [saved, commit]);
  useComputerMove(idlTurn, idlMove);

  // Vs idl, undo takes back your move and idl's reply.
  const onUndo = () => {
    if (!undone) return;
    setAnimMove(-1);
    setSaved({ ...saved, game: undone });
  };

  const switchOpponent = (o: Opponent) => {
    setAnimMove(-1);
    setSaved({ ...saved, opponent: o, game: newGame(game.first), counted: false });
  };
  const requestOpponent = (o: Opponent) => {
    if (o === opponent) return;
    if (game.moves.length > 0 && !over) setPendingOpponent(o);
    else switchOpponent(o);
  };

  // Starter alternates every round.
  const nextRound = () => {
    setAnimMove(-1);
    setSaved({ ...saved, game: newGame(other(game.first)), counted: false });
  };
  const restartRound = () => {
    setAnimMove(-1);
    setSaved({ ...saved, game: newGame(game.first), counted: false });
  };

  const onKey = (ev: KeyboardEvent<HTMLButtonElement>, col: number) => {
    const delta = ev.key === 'ArrowLeft' ? -1 : ev.key === 'ArrowRight' ? 1 : 0;
    let target = -1;
    if (delta) target = (col + delta + COLS) % COLS;
    else if (ev.key === 'Home') target = 0;
    else if (ev.key === 'End') target = COLS - 1;
    if (target < 0) return;
    ev.preventDefault();
    colRefs.current[target]?.focus();
  };

  const status = result.winner
    ? `${NAMES[result.winner]} ${vsIdl && result.winner === 1 ? 'connect' : 'connects'} four`
    : result.draw
      ? 'Board full. A draw.'
      : idlTurn
        ? `${COMPUTER_NAME} is thinking…`
        : vsIdl
          ? 'Your turn to drop'
          : `${NAMES[current]} to drop`;
  const nextStarter = NAMES[other(game.first)];

  return (
    <GameScreen
      title="Connect Four"
      kicker={vsIdl ? `You vs ${OPPONENT_LABEL[opponent]}` : '2 players · one phone'}
      backTo="/play"
      className="c4-screen"
      rules={
        <>
          <p>Take turns dropping a disc into a column. It falls to the lowest open slot. Line up four of yours (across, down or diagonally) to win the round.</p>
          <ul>
            <li><strong>Player 1</strong> plays discs marked ✕, <strong>Player 2</strong> discs marked with a ring.</li>
            <li>Tap anywhere in a column to drop. On a keyboard, use ← → and Enter.</li>
            <li>A full board with no line is a draw. Starts alternate each round.</li>
            <li>Playing <strong>idl</strong>, the computer? You drop ✕ discs and still alternate who starts. Undo takes back your move and idl’s reply.</li>
          </ul>
        </>
      }
      menu={[
        { label: 'Undo last move', onSelect: onUndo, disabled: !undone },
        { label: 'Restart this round', onSelect: () => setConfirmRestart(true), disabled: over || game.moves.length === 0 },
        { label: 'Reset scores', onSelect: () => setConfirmReset(true), destructive: true },
      ]}
    >
      <div className="c4-top">
        <OpponentPicker value={opponent} onChange={requestOpponent} />
        <div className="scoreboard">
          {([1, 2] as Player[]).map((p) => (
            <span key={p} className={`player-chip player-chip--p${p}`} data-active={!over && current === p}>
              <Disc player={p} className="c4-chip-disc" />
              <span className="player-chip__name">{NAMES[p]}</span>
              <span className="player-chip__score" aria-label={`${score[p]} rounds won`}>{score[p]}</span>
            </span>
          ))}
        </div>
      </div>

      <p className="status-line" aria-live="polite">
        {!over && <Disc player={current} className="c4-chip-disc" />}
        <span>{status}</span>
        {vsIdl && !over && game.moves.length === 0 && <span className="meta">· {game.first === 1 ? 'you start' : 'idl starts'}</span>}
      </p>

      <div
        className={`c4-board c4-turn--p${current}${over ? ' is-over' : ''}${result.winner ? ' has-win' : ''}${idlTurn ? ' is-waiting' : ''}`}
        aria-busy={idlTurn || undefined}
        role="group"
        aria-label="Connect Four board, 7 columns"
        style={{ '--c4-rows': ROWS } as CSSProperties}
      >
        {Array.from({ length: COLS }, (_, col) => {
          const land = landingRow(board, col);
          const full = land < 0;
          const filled = ROWS - (full ? 0 : land + 1);
          const label = over
            ? `Column ${col + 1}, ${filled} of ${ROWS} filled`
            : full
              ? `Column ${col + 1}, full`
              : idlTurn
                ? `Column ${col + 1}, ${filled} of ${ROWS} filled`
                : `Column ${col + 1}, ${filled} of ${ROWS} filled. Drop ${vsIdl ? 'your' : NAMES[current]} disc`;
          return (
            <button
              key={col}
              ref={(el) => {
                colRefs.current[col] = el;
              }}
              type="button"
              className={`c4-col${full ? ' is-full' : ''}${shakeCol === col ? ' anim-shake' : ''}`}
              aria-label={label}
              aria-disabled={over || full || idlTurn}
              disabled={over || idlTurn}
              onClick={() => onColumn(col)}
              onKeyDown={(ev) => onKey(ev, col)}
              onAnimationEnd={(ev) => {
                if (ev.target === ev.currentTarget) setShakeCol(null);
              }}
            >
              {Array.from({ length: ROWS }, (_, row) => {
                const cell = board[row][col];
                const winning = winSet.has(`${row}-${col}`);
                const isLast = row === lastRow && col === lastCol;
                return (
                  <span key={row} className={`c4-slot${winning ? ' is-winning' : ''}${isLast && !over ? ' is-last' : ''}`}>
                    {cell ? (
                      <Disc
                        key={`m${isLast ? lastIndex : 'x'}`}
                        player={cell}
                        className={isLast && animMove === lastIndex ? 'is-dropping' : ''}
                        style={{ '--c4-from': row + 1 } as CSSProperties}
                      />
                    ) : row === land && !over && !idlTurn ? (
                      <Disc player={current} className="c4-ghost" />
                    ) : null}
                    {winning && <span className="c4-win-marker" aria-hidden="true" />}
                  </span>
                );
              })}
            </button>
          );
        })}
      </div>

      {!over && (
        <div className="button-row">
          <Button variant="quiet" size="sm" icon={<IconUndo size={18} />} onClick={onUndo} disabled={!undone}>
            Undo
          </Button>
        </div>
      )}

      {over && (
        <section className="end-card" aria-labelledby="c4-end-title">
          <h2 id="c4-end-title" className="end-card__title display">
            {result.winner ? `${NAMES[result.winner]} ${vsIdl && result.winner === 1 ? 'win' : 'wins'}` : 'A draw'}
          </h2>
          <p className="muted">
            {result.winner
              ? `Four ${SHAPE[result.winner]} discs in a line. ${nextStarter} ${vsIdl && other(game.first) === 1 ? 'start' : 'starts'} the next round.`
              : `Nobody got four. ${nextStarter} ${vsIdl && other(game.first) === 1 ? 'start' : 'starts'} the next round.`}
          </p>
          <div className="end-card__actions">
            <Button variant="primary" size="lg" onClick={nextRound}>Rematch</Button>
          </div>
        </section>
      )}
      {score.draws > 0 && <p className="meta c4-draws">Draws so far: {score.draws}</p>}

      <Confirm
        open={pendingOpponent !== null}
        title={`Play ${pendingOpponent ? OPPONENT_LABEL[pendingOpponent] : ''} instead?`}
        message="This round is abandoned and the board clears. Scores are kept."
        confirmLabel="Switch"
        destructive
        onCancel={() => setPendingOpponent(null)}
        onConfirm={() => {
          if (pendingOpponent) switchOpponent(pendingOpponent);
          setPendingOpponent(null);
        }}
      />
      <Confirm
        open={confirmRestart}
        title="Restart this round?"
        message="The board clears. The same player starts again."
        confirmLabel="Restart"
        destructive
        onCancel={() => setConfirmRestart(false)}
        onConfirm={() => {
          setConfirmRestart(false);
          restartRound();
        }}
      />
      <Confirm
        open={confirmReset}
        title="Reset scores?"
        message="Both scores and draws go back to zero and the board clears."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          setAnimMove(-1);
          setSaved({ ...saved, game: newGame(1), counted: false, scores: { ...saved.scores, [opponent]: zero() } });
        }}
      />
    </GameScreen>
  );
}
