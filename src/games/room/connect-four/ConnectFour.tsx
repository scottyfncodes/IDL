import { useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { usePersistentState } from '../../../lib/storage';
import { GameScreen } from '../../../ui/GameScreen';
import { Button } from '../../../ui/Button';
import { Confirm } from '../../../ui/Confirm';
import { IconUndo } from '../../../ui/icons';
import { boardOf, COLS, drop, landingRow, newGame, other, outcome, ROWS, turnOf, undo, type Game, type Player } from './logic';
import './styles.css';

interface Saved {
  game: Game;
  score: { 1: number; 2: number; draws: number };
  /** Has the finished round been added to the score? */
  counted: boolean;
}

const initial = (): Saved => ({ game: newGame(1), score: { 1: 0, 2: 0, draws: 0 }, counted: false });

const NAMES: Record<Player, string> = { 1: 'Player 1', 2: 'Player 2' };
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
  const [saved, setSaved] = usePersistentState<Saved>('room:connect-four', initial, 1);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  // Index of the move that should animate (only discs dropped in this session).
  const [animMove, setAnimMove] = useState(-1);
  const [shakeCol, setShakeCol] = useState<number | null>(null);
  const colRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const { game, score } = saved;
  const board = boardOf(game);
  const result = outcome(board);
  const over = result.winner !== null || result.draw;
  const current = turnOf(game);
  const winSet = new Set(result.cells?.map(([r, c]) => `${r}-${c}`));
  const lastIndex = game.moves.length - 1;
  const lastCol = lastIndex >= 0 ? game.moves[lastIndex] : -1;
  const lastRow = lastCol >= 0 ? landingRow(boardOf({ first: game.first, moves: game.moves.slice(0, -1) }), lastCol) : -1;

  const onColumn = (col: number) => {
    if (over) return;
    const res = drop(game, col);
    if (!res) {
      setShakeCol(col);
      return;
    }
    const o = outcome(boardOf(res.game));
    const done = o.winner !== null || o.draw;
    setAnimMove(res.game.moves.length - 1);
    setShakeCol(null);
    setSaved({
      ...saved,
      game: res.game,
      counted: done,
      score: done
        ? {
            1: score[1] + (o.winner === 1 ? 1 : 0),
            2: score[2] + (o.winner === 2 ? 1 : 0),
            draws: score.draws + (o.draw ? 1 : 0),
          }
        : score,
    });
  };

  const onUndo = () => {
    const u = undo(game);
    if (!u) return;
    setAnimMove(-1);
    setSaved({ ...saved, game: u });
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
    ? `${NAMES[result.winner]} connects four`
    : result.draw
      ? 'Board full. A draw.'
      : `${NAMES[current]} to drop`;

  return (
    <GameScreen
      title="Connect Four"
      kicker="2 players · one phone"
      backTo="/play"
      className="c4-screen"
      rules={
        <>
          <p>Take turns dropping a disc into a column. It falls to the lowest open slot. Line up four of yours — across, down or diagonally — to win the round.</p>
          <ul>
            <li><strong>Player 1</strong> plays discs marked ✕, <strong>Player 2</strong> discs marked with a ring.</li>
            <li>Tap anywhere in a column to drop. On a keyboard, use ← → and Enter.</li>
            <li>A full board with no line is a draw. Starts alternate each round.</li>
          </ul>
        </>
      }
      menu={[
        { label: 'Undo last move', onSelect: onUndo, disabled: over || game.moves.length === 0 },
        { label: 'Restart this round', onSelect: () => setConfirmRestart(true), disabled: over || game.moves.length === 0 },
        { label: 'Reset scores', onSelect: () => setConfirmReset(true), destructive: true },
      ]}
    >
      <div className="scoreboard">
        {([1, 2] as Player[]).map((p) => (
          <span key={p} className={`player-chip player-chip--p${p}`} data-active={!over && current === p}>
            <Disc player={p} className="c4-chip-disc" />
            <span className="player-chip__name">{NAMES[p]}</span>
            <span className="player-chip__score" aria-label={`${score[p]} rounds won`}>{score[p]}</span>
          </span>
        ))}
      </div>

      <p className="status-line" aria-live="polite">
        {!over && <Disc player={current} className="c4-chip-disc" />}
        <span>{status}</span>
      </p>

      <div
        className={`c4-board c4-turn--p${current}${over ? ' is-over' : ''}`}
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
              : `Column ${col + 1}, ${filled} of ${ROWS} filled. Drop ${NAMES[current]} disc`;
          return (
            <button
              key={col}
              ref={(el) => {
                colRefs.current[col] = el;
              }}
              type="button"
              className={`c4-col${full ? ' is-full' : ''}${shakeCol === col ? ' anim-shake' : ''}`}
              aria-label={label}
              aria-disabled={over || full}
              disabled={over}
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
                    ) : row === land && !over ? (
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
          <Button variant="quiet" size="sm" icon={<IconUndo size={18} />} onClick={onUndo} disabled={game.moves.length === 0}>
            Undo
          </Button>
        </div>
      )}

      {over && (
        <section className="end-card" aria-labelledby="c4-end-title">
          <h2 id="c4-end-title" className="end-card__title display">
            {result.winner ? `${NAMES[result.winner]} wins` : 'A draw'}
          </h2>
          <p className="muted">
            {result.winner
              ? `Four ${SHAPE[result.winner]} discs in a line. ${NAMES[other(game.first)]} starts the next round.`
              : `Nobody got four. ${NAMES[other(game.first)]} starts the next round.`}
          </p>
          <div className="end-card__actions">
            <Button variant="primary" size="lg" onClick={nextRound}>Rematch</Button>
          </div>
        </section>
      )}
      {score.draws > 0 && <p className="meta c4-draws">Draws so far: {score.draws}</p>}

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
          setSaved(initial());
        }}
      />
    </GameScreen>
  );
}
