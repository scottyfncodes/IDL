import { useState } from 'react';
import { usePersistentState } from '../../../lib/storage';
import { GameScreen } from '../../../ui/GameScreen';
import { Button } from '../../../ui/Button';
import { Confirm } from '../../../ui/Confirm';
import { emptyBoard, outcome, play, turn, type Board, type Mark } from './logic';
import './styles.css';

interface State {
  board: Board;
  first: Mark;
  score: { X: number; O: number; draws: number };
  counted: boolean; // has this finished round been added to the score?
}

const initial = (): State => ({ board: emptyBoard(), first: 'X', score: { X: 0, O: 0, draws: 0 }, counted: false });

const NAMES: Record<Mark, string> = { X: 'Player 1', O: 'Player 2' };

function MarkIcon({ mark }: { mark: Mark }) {
  return mark === 'X' ? (
    <svg viewBox="0 0 40 40" className="ttt-mark ttt-mark--x" aria-hidden="true"><path d="M10 10l20 20M30 10L10 30" /></svg>
  ) : (
    <svg viewBox="0 0 40 40" className="ttt-mark ttt-mark--o" aria-hidden="true"><circle cx="20" cy="20" r="11" /></svg>
  );
}

export default function TicTacToe() {
  const [state, setState] = usePersistentState<State>('room:tic-tac-toe', initial, 1);
  const [confirmReset, setConfirmReset] = useState(false);
  const { board, first, score } = state;
  const result = outcome(board);
  const over = result.winner !== null || result.draw;
  const current = turn(board, first);

  const onCell = (i: number) => {
    const next = play(board, i, first);
    if (next === board) return;
    const o = outcome(next);
    const done = o.winner !== null || o.draw;
    setState({
      ...state,
      board: next,
      counted: done,
      score: done
        ? { ...score, X: score.X + (o.winner === 'X' ? 1 : 0), O: score.O + (o.winner === 'O' ? 1 : 0), draws: score.draws + (o.draw ? 1 : 0) }
        : score,
    });
  };

  // Loser (or the player who went second after a draw) starts the next round.
  const rematch = () => setState({ ...state, board: emptyBoard(), first: first === 'X' ? 'O' : 'X', counted: false });

  return (
    <GameScreen
      title="Tic-Tac-Toe"
      kicker="2 players · one phone"
      backTo="/play"
      rules={
        <>
          <p>Take turns placing your mark. Get three in a row — across, down or diagonally — to win the round.</p>
          <ul>
            <li><strong>Player 1</strong> plays ✕, <strong>Player 2</strong> plays ◯.</li>
            <li>A full board with no line is a draw.</li>
            <li>Starts alternate each round. Scores are kept until you reset them.</li>
          </ul>
        </>
      }
      menu={[
        { label: 'Restart this round', onSelect: () => setState({ ...state, board: emptyBoard(), counted: false }), disabled: board.every((c) => !c) || over },
        { label: 'Reset scores', onSelect: () => setConfirmReset(true), destructive: true },
      ]}
    >
      <div className="scoreboard">
        {(['X', 'O'] as Mark[]).map((m) => (
          <span key={m} className={`player-chip player-chip--${m === 'X' ? 'p1' : 'p2'}`} data-active={!over && current === m}>
            <MarkIcon mark={m} />
            <span className="player-chip__name">{NAMES[m]}</span>
            <span className="player-chip__score">{score[m]}</span>
          </span>
        ))}
      </div>

      <p className="status-line" aria-live="polite">
        {result.winner ? `${NAMES[result.winner]} wins the round` : result.draw ? 'A draw. Well defended.' : `${NAMES[current]} to move`}
      </p>

      <div className={`ttt-board${over ? ' is-over' : ''}`} role="grid" aria-label="Tic-Tac-Toe board">
        {board.map((cell, i) => {
          const winning = result.line?.includes(i);
          return (
            <button
              key={i}
              type="button"
              role="gridcell"
              className={`ttt-cell${winning ? ' is-winning' : ''}`}
              aria-label={`Row ${Math.floor(i / 3) + 1}, column ${(i % 3) + 1}: ${cell ? NAMES[cell] : 'empty'}`}
              disabled={!!cell || over}
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
        open={confirmReset}
        title="Reset scores?"
        message="Both scores go back to zero and the board clears."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => {
          setConfirmReset(false);
          setState(initial());
        }}
      />
    </GameScreen>
  );
}
