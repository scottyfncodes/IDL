import { useCallback, useEffect, useRef, useState } from 'react';
import type { DailyGameProps, DailyRecord } from '../../../daily/types';
import { Button } from '../../../ui/Button';
import { Keyboard, usePhysicalKeyboard, type KeyPress } from '../../../ui/Keyboard';
import {
  applyStep,
  changedIndex,
  maxMoves,
  resultGrid,
  scoreText,
  status as gameStatus,
  STEP_MESSAGES,
  undoStep,
  WORD_LENGTH,
  type Puzzle,
  type State,
} from './logic';
import './styles.css';

const EMPTY: State = { ladder: [] };

function Rung({ word, prev, kind, label }: { word: string; prev?: string; kind: 'start' | 'step' | 'goal' | 'reached'; label: string }) {
  const changed = prev ? changedIndex(prev, word) : -1;
  const aria = `${label}: ${word.toUpperCase()}${changed >= 0 ? `, changed letter ${changed + 1}` : ''}`;
  return (
    <li className={`ws-rung ws-rung--${kind}`} aria-label={aria}>
      <span className="ws-rung__label" aria-hidden="true">{label}</span>
      <span className="ws-rung__tiles" aria-hidden="true">
        {[...word].map((ch, i) => (
          <span key={i} className={`ws-tile${i === changed ? ' is-changed' : ''}`}>
            {ch}
          </span>
        ))}
      </span>
    </li>
  );
}

export default function Wordsteps({ puzzle, record, save }: DailyGameProps<Puzzle, State>) {
  const [state, setState] = useState<State>(() => record?.state ?? EMPTY);
  const [typed, setTyped] = useState('');
  const [message, setMessage] = useState('');
  const [shake, setShake] = useState(0);
  const inputRef = useRef<HTMLLIElement>(null);

  const st = record && record.status !== 'playing' ? record.status : gameStatus(puzzle, state);
  const over = st !== 'playing';
  const moves = state.ladder.length;
  const limit = maxMoves(puzzle);

  const commit = useCallback(
    (next: State) => {
      setState(next);
      const s = gameStatus(puzzle, next);
      if (s === 'playing') save({ status: 'playing', state: next });
      else save({ status: s, state: next, result: { score: scoreText(puzzle, next), grid: [resultGrid(puzzle, next)] } });
    },
    [puzzle, save],
  );

  const onKey = useCallback(
    (k: KeyPress) => {
      if (over) return;
      if (k.type === 'letter') {
        setMessage('');
        setTyped((t) => (t.length < WORD_LENGTH ? t + k.letter : t));
      } else if (k.type === 'back') {
        setMessage('');
        setTyped((t) => t.slice(0, -1));
      } else {
        const res = applyStep(puzzle, state, typed);
        if ('error' in res) {
          if (res.error === 'over') return;
          setMessage(STEP_MESSAGES[res.error]);
          setShake((n) => n + 1);
          return;
        }
        setTyped('');
        setMessage('');
        commit(res.state);
      }
    },
    [over, puzzle, state, typed, commit],
  );
  usePhysicalKeyboard(onKey, !over);

  useEffect(() => {
    inputRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [moves]);

  const undo = () => {
    const next = undoStep(puzzle, state);
    if (next === state) return;
    setTyped('');
    setMessage('');
    commit(next);
  };

  const left = limit - moves;
  const statusText = over
    ? st === 'won'
      ? `Reached ${puzzle.end.toUpperCase()} in ${moves}. ${moves < puzzle.par ? 'Under par. Nicely found.' : moves === puzzle.par ? 'Right on par.' : `Par was ${puzzle.par}.`}`
      : `Out of moves. The ladder ran out before ${puzzle.end.toUpperCase()}.`
    : message || (moves === 0 ? `Change one letter of ${puzzle.start.toUpperCase()}.` : `${left} ${left === 1 ? 'move' : 'moves'} left`);

  return (
    <div className="ws">
      <div className="ws-meta" aria-hidden="true">
        <span>Par <strong>{puzzle.par}</strong></span>
        <span>Moves <strong>{moves}</strong> / {limit}</span>
      </div>

      <p className={`status-line ws-status${message ? ' is-error' : ''}`} aria-live="polite">{statusText}</p>

      <ol className="ws-ladder" aria-label="Ladder">
        <Rung word={puzzle.start} kind="start" label="Start" />
        {state.ladder.map((w, i) => (
          <Rung key={`${i}-${w}`} word={w} prev={i === 0 ? puzzle.start : state.ladder[i - 1]} kind={w === puzzle.end ? 'reached' : 'step'} label={w === puzzle.end ? 'Goal' : String(i + 1)} />
        ))}
        {!over && (
          <li ref={inputRef} key={`input-${shake}`} className={`ws-rung ws-rung--input${shake ? ' anim-shake' : ''}`} aria-label={`Move ${moves + 1}: ${typed ? typed.toUpperCase().split('').join(' ') : 'empty'}`}>
            <span className="ws-rung__label" aria-hidden="true">{moves + 1}</span>
            <span className="ws-rung__tiles" aria-hidden="true">
              {Array.from({ length: WORD_LENGTH }, (_, i) => (
                <span key={i} className={`ws-tile ws-tile--slot${typed[i] ? ' is-filled' : ''}${i === typed.length ? ' is-cursor' : ''}`}>
                  {typed[i] ?? ''}
                </span>
              ))}
            </span>
          </li>
        )}
        {st !== 'won' && (
          <>
            <li className="ws-gap" aria-hidden="true"><span /></li>
            <Rung word={puzzle.end} kind="goal" label="Goal" />
          </>
        )}
      </ol>

      {!over && (
        <>
          <div className="button-row">
            <Button variant="quiet" size="sm" onClick={undo} disabled={moves === 0}>Undo last step</Button>
          </div>
          <Keyboard onKey={onKey} enterLabel="Enter" />
        </>
      )}
    </div>
  );
}

export function WordstepsReveal({ puzzle, record }: { puzzle: Puzzle; record: DailyRecord<State> }) {
  const moves = record.state?.ladder.length ?? 0;
  return (
    <div className="ws-reveal">
      <h3 className="ws-reveal__title">A shortest ladder · {puzzle.par} moves</h3>
      <ol className="ws-reveal__path">
        {puzzle.solution.map((w, i) => {
          const c = i === 0 ? -1 : changedIndex(puzzle.solution[i - 1], w);
          return (
            <li key={w} aria-label={`${w.toUpperCase()}${c >= 0 ? `, changed letter ${c + 1}` : ''}`}>
              {[...w].map((ch, j) => (
                <span key={j} className={j === c ? 'is-changed' : undefined} aria-hidden="true">{ch}</span>
              ))}
            </li>
          );
        })}
      </ol>
      {record.status === 'won' && moves > puzzle.par && <p className="meta">Yours took {moves}. Any route counts.</p>}
    </div>
  );
}
