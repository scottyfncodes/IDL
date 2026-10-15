import { useCallback, useState } from 'react';
import { load, usePersistentState } from '../../../lib/storage';
import { createRng, freshSeed } from '../../../lib/rng';
import { GameScreen } from '../../../ui/GameScreen';
import { Button } from '../../../ui/Button';
import { Confirm } from '../../../ui/Confirm';
import { OpponentPicker } from '../../../ui/OpponentPicker';
import { COMPUTER_NAME, HUMAN_NAME, useComputerMove } from '../../../room/computer';
import { recordRoomResult, type Opponent, type RoomResult } from '../../../room/stats';
import { chooseMove, emptyBoard, outcome, play, turn, type Board, type Mark, type Outcome } from './logic';
import './styles.css';

type Score = { X: number; O: number; draws: number };

interface State {
  board: Board;
  first: Mark;
  /** Against the computer, the human is always ✕ (Player 1). */
  opponent: Opponent;
  /** Running score per opponent, so switching doesn't lose a tally. */
  scores: Record<Opponent, Score>;
  /** Has this finished round been scored and recorded? Guards against double counting. */
  counted: boolean;
}

const KEY = 'room:tic-tac-toe';
const VERSION = 2;
const zero = (): Score => ({ X: 0, O: 0, draws: 0 });
const fresh = (): State => ({ board: emptyBoard(), first: 'X', opponent: 'friend', scores: { friend: zero(), easy: zero(), hard: zero() }, counted: false });

/** v1 kept a single friend score; carry it (and any round in progress) over. */
function initial(): State {
  const v1 = load<{ board: Board; first: Mark; score: Score; counted: boolean } | null>(KEY, null, 1);
  const base = fresh();
  if (!v1 || !Array.isArray(v1.board) || v1.board.length !== 9 || !v1.score) return base;
  return { ...base, board: v1.board, first: v1.first === 'O' ? 'O' : 'X', scores: { ...base.scores, friend: { ...zero(), ...v1.score } }, counted: !!v1.counted };
}

const FRIEND_NAMES: Record<Mark, string> = { X: 'Player 1', O: 'Player 2' };
const IDL_NAMES: Record<Mark, string> = { X: HUMAN_NAME, O: COMPUTER_NAME };
const OPPONENT_LABEL: Record<Opponent, string> = { friend: 'a friend', easy: 'idl · easy', hard: 'idl · hard' };

function resultFor(o: Outcome, opponent: Opponent): RoomResult {
  if (opponent === 'friend') return { outcome: 'complete', opponent };
  return { outcome: o.draw ? 'draw' : o.winner === 'X' ? 'win' : 'loss', opponent };
}

function MarkIcon({ mark }: { mark: Mark }) {
  return mark === 'X' ? (
    <svg viewBox="0 0 40 40" className="ttt-mark ttt-mark--x" aria-hidden="true"><path d="M10 10l20 20M30 10L10 30" /></svg>
  ) : (
    <svg viewBox="0 0 40 40" className="ttt-mark ttt-mark--o" aria-hidden="true"><circle cx="20" cy="20" r="11" /></svg>
  );
}

export default function TicTacToe() {
  const [state, setState] = usePersistentState<State>(KEY, initial, VERSION);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pendingOpponent, setPendingOpponent] = useState<Opponent | null>(null);
  const { board, first, opponent } = state;
  const score = state.scores[opponent];
  const vsIdl = opponent !== 'friend';
  const NAMES = vsIdl ? IDL_NAMES : FRIEND_NAMES;
  const result = outcome(board);
  const over = result.winner !== null || result.draw;
  const current = turn(board, first);
  const idlTurn = vsIdl && !over && current === 'O';
  const empty = board.every((c) => !c);

  /** Commit a move from either side; scores and records the round exactly once when it ends. */
  const commit = useCallback(
    (next: Board) => {
      const o = outcome(next);
      const done = o.winner !== null || o.draw;
      const s = state.scores[state.opponent];
      const counting = done && !state.counted;
      if (counting) recordRoomResult('tic-tac-toe', resultFor(o, state.opponent));
      setState({
        ...state,
        board: next,
        counted: done,
        scores: counting
          ? { ...state.scores, [state.opponent]: { X: s.X + (o.winner === 'X' ? 1 : 0), O: s.O + (o.winner === 'O' ? 1 : 0), draws: s.draws + (o.draw ? 1 : 0) } }
          : state.scores,
      });
    },
    [state, setState],
  );

  const onCell = (i: number) => {
    if (idlTurn) return;
    const next = play(board, i, first);
    if (next !== board) commit(next);
  };

  const idlMove = useCallback(() => {
    if (state.opponent === 'friend') return;
    const i = chooseMove(state.board, state.first, state.opponent, createRng(freshSeed()));
    if (i >= 0) commit(play(state.board, i, state.first));
  }, [state, commit]);
  useComputerMove(idlTurn, idlMove);

  // Loser (or the player who went second after a draw) starts the next round.
  const rematch = () => setState({ ...state, board: emptyBoard(), first: first === 'X' ? 'O' : 'X', counted: false });

  const switchOpponent = (o: Opponent) => setState({ ...state, opponent: o, board: emptyBoard(), counted: false });
  const requestOpponent = (o: Opponent) => {
    if (o === opponent) return;
    if (!empty && !over) setPendingOpponent(o);
    else switchOpponent(o);
  };

  let status: string;
  if (result.winner) status = vsIdl ? (result.winner === 'X' ? 'You win the round' : 'idl wins the round') : `${NAMES[result.winner]} wins the round`;
  else if (result.draw) status = 'A draw. Well defended.';
  else if (idlTurn) status = `${COMPUTER_NAME} is thinking…`;
  else status = vsIdl ? 'Your move' : `${NAMES[current]} to move`;

  return (
    <GameScreen
      title="Tic-Tac-Toe"
      kicker={vsIdl ? `You vs ${OPPONENT_LABEL[opponent]}` : '2 players · one phone'}
      backTo="/play"
      rules={
        <>
          <p>Take turns placing your mark. Get three in a row — across, down or diagonally — to win the round.</p>
          <ul>
            <li><strong>Player 1</strong> plays ✕, <strong>Player 2</strong> plays ◯.</li>
            <li>A full board with no line is a draw.</li>
            <li>Starts alternate each round. Scores are kept until you reset them.</li>
            <li>No one to play? Pick <strong>idl</strong>, the computer, on easy or hard. You play ✕; idl plays ◯ and starts every other round.</li>
          </ul>
        </>
      }
      menu={[
        { label: 'Restart this round', onSelect: () => setState({ ...state, board: emptyBoard(), counted: false }), disabled: empty || over },
        { label: 'Reset scores', onSelect: () => setConfirmReset(true), destructive: true },
      ]}
    >
      <div className="ttt-top">
        <OpponentPicker value={opponent} onChange={requestOpponent} />
        <div className="scoreboard">
          {(['X', 'O'] as Mark[]).map((m) => (
            <span key={m} className={`player-chip player-chip--${m === 'X' ? 'p1' : 'p2'}`} data-active={!over && current === m}>
              <MarkIcon mark={m} />
              <span className="player-chip__name">{NAMES[m]}</span>
              <span className="player-chip__score">{score[m]}</span>
            </span>
          ))}
        </div>
      </div>

      <p className="status-line" aria-live="polite">
        <span>{status}</span>
        {vsIdl && empty && !over && <span className="meta">· {first === 'X' ? 'you start' : 'idl starts'} this round</span>}
      </p>

      <div className={`ttt-board${over ? ' is-over' : ''}${idlTurn ? ' is-waiting' : ''}`} role="grid" aria-label="Tic-Tac-Toe board" aria-busy={idlTurn || undefined}>
        {board.map((cell, i) => {
          const winning = result.line?.includes(i);
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              className={`ttt-cell${winning ? ' is-winning' : ''}`}
              aria-label={`Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}: ${cell ? NAMES[cell] : 'empty'}`}
              disabled={!!cell || over || idlTurn}
              onClick={() => onCell(i)}
            >
              {cell && <MarkIcon mark={cell} />}
            </button>
          );
        })}
      </div>

      {over && (
        <div className="button-row">
          <Button variant="primary" size="lg" onClick={rematch}>Rematch</Button>
        </div>
      )}
      {score.draws > 0 && <p className="meta" style={{ textAlign: 'center' }}>Draws so far: {score.draws}</p>}

      <Confirm
        open={pendingOpponent !== null}
        title={`Play ${pendingOpponent ? OPPONENT_LABEL[pendingOpponent] : ''} instead?`}
        message="This round is abandoned and the board clears. Scores are kept."
        confirmLabel="Switch"
        cancelLabel="Keep playing"
        destructive
        onCancel={() => setPendingOpponent(null)}
        onConfirm={() => {
          if (pendingOpponent) switchOpponent(pendingOpponent);
          setPendingOpponent(null);
        }}
      />
      <Confirm
        open={confirmReset}
        title="Reset scores?"
        message="Both scores go back to zero and the board clears."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          setState({ ...state, board: emptyBoard(), first: 'X', counted: false, scores: { ...state.scores, [opponent]: zero() } });
        }}
      />
    </GameScreen>
  );
}
