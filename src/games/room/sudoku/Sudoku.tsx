import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { usePersistentState } from '../../../lib/storage';
import { recordRoomResult } from '../../../room/stats';
import { freshSeed } from '../../../lib/rng';
import { GameScreen } from '../../../ui/GameScreen';
import { Button } from '../../../ui/Button';
import { Confirm } from '../../../ui/Confirm';
import { Segmented } from '../../../ui/Segmented';
import { useToast } from '../../../ui/Toast';
import { IconEraser, IconPause, IconPencil, IconPlay, IconUndo } from '../../../ui/icons';
import {
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  UNITS,
  boxOf,
  colOf,
  completedDigits,
  eraseCell,
  formatTime,
  generate,
  isWon,
  noteDigits,
  placeDigit,
  rowOf,
  toggleNote,
  undoChange,
  type Board,
  type Change,
  type Difficulty,
  type Grid,
  type MoveResult,
} from './logic';
import { cellFromPoint } from './touch';
import './styles.css';

interface Game {
  seed: number;
  difficulty: Difficulty;
  givens: Grid;
  solution: Grid;
  values: Grid;
  notes: number[];
  mistakes: number;
  elapsed: number; // ms
  history: Change[];
  won: boolean;
  /** Has the win been recorded in stats? Guards against double counting. */
  recorded?: boolean;
  /** Was the recorded time a personal best for this difficulty? */
  newBest?: boolean;
}

interface State {
  difficulty: Difficulty;
  notesMode: boolean;
  paused: boolean;
  selected: number | null;
  game: Game | null;
}

const initial = (): State => ({ difficulty: 'easy', notesMode: false, paused: false, selected: null, game: null });
const HISTORY_CAP = 300;

function newGame(seed: number, difficulty: Difficulty): Game {
  const p = generate(seed, difficulty);
  return {
    seed,
    difficulty,
    givens: p.puzzle,
    solution: p.solution,
    values: p.puzzle.slice(),
    notes: Array(81).fill(0),
    mistakes: 0,
    elapsed: 0,
    history: [],
    won: false,
  };
}

const DIFF_OPTIONS = DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABEL[d] }));

export default function Sudoku() {
  const [state, setState] = usePersistentState<State>('room:sudoku', initial, 1);
  const [generating, setGenerating] = useState<Difficulty | null>(null);
  const [confirm, setConfirm] = useState<null | 'new' | 'restart'>(null);
  const [shake, setShake] = useState<number | null>(null);
  const toast = useToast();
  const boardRef = useRef<HTMLDivElement>(null);
  // Touch: select the cell under the finger and follow it while it slides,
  // so a near-miss can be corrected before lifting. Taps on grid lines still
  // land on the nearest square. The synthetic click that follows is ignored.
  const touch = useRef<{ id: number; suppressUntil: number } | null>(null);
  const { game, selected, notesMode, paused } = state;
  const playing = !!game && !game.won;

  // ---- generation (after paint, so the "shuffling" state shows) ----------
  const start = (difficulty: Difficulty) => {
    setGenerating(difficulty);
    window.setTimeout(() => {
      const g = newGame(freshSeed(), difficulty);
      setState((s) => ({ ...s, difficulty, game: g, paused: false, notesMode: false, selected: null }));
      setGenerating(null);
    }, 60);
  };

  // ---- timer --------------------------------------------------------------
  const running = playing && !paused && !generating;
  const last = useRef(0);
  useEffect(() => {
    if (!running) return;
    last.current = Date.now();
    const id = window.setInterval(() => {
      if (document.visibilityState === 'hidden') {
        last.current = Date.now();
        return;
      }
      const now = Date.now();
      const delta = Math.min(now - last.current, 2000);
      last.current = now;
      setState((s) => (s.game && !s.game.won && !s.paused ? { ...s, game: { ...s.game, elapsed: s.game.elapsed + delta } } : s));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, setState]);

  // Auto-pause when the page is hidden (tab switch, phone locked).
  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        setState((s) => (s.game && !s.game.won && !s.paused ? { ...s, paused: true } : s));
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [setState]);

  // ---- moves --------------------------------------------------------------
  const apply = useCallback(
    (fn: (b: Board, g: Game) => MoveResult) => {
      setState((s) => {
        const g = s.game;
        if (!g || g.won || s.paused) return s;
        const r = fn({ givens: g.givens, values: g.values, notes: g.notes }, g);
        if (!r.change) return s;
        const won = isWon(r.board.values, g.solution);
        // The persistent setter runs this updater exactly once, against the
        // latest saved state, so the win is recorded once per grid.
        const record = won && !g.recorded;
        const newBest = record
          ? recordRoomResult('sudoku', {
              outcome: 'win',
              score: { variant: g.difficulty, value: Math.floor(g.elapsed / 1000), better: 'lower', label: formatTime(g.elapsed) },
            })
          : !!g.newBest;
        return {
          ...s,
          game: {
            ...g,
            values: r.board.values,
            notes: r.board.notes,
            mistakes: g.mistakes + (r.mistake ? 1 : 0),
            history: [...g.history, r.change].slice(-HISTORY_CAP),
            won,
            recorded: g.recorded || record,
            newBest,
          },
        };
      });
    },
    [setState],
  );

  const input = useCallback(
    (d: number) => {
      if (!game) return;
      if (selected === null) {
        toast.show('Tap a square first');
        return;
      }
      if (game.givens[selected]) {
        setShake(selected);
        return;
      }
      if (notesMode) {
        if (game.values[selected]) {
          setShake(selected);
          return;
        }
        apply((b) => toggleNote(b, selected, d));
      } else apply((b, g) => placeDigit(b, selected, d, g.solution));
    },
    [apply, game, notesMode, selected, toast],
  );

  const erase = useCallback(() => {
    if (selected === null) return;
    apply((b) => eraseCell(b, selected));
  }, [apply, selected]);

  const undo = useCallback(() => {
    setState((s) => {
      const g = s.game;
      if (!g || g.won || s.paused || g.history.length === 0) return s;
      const change = g.history[g.history.length - 1];
      const b = undoChange({ givens: g.givens, values: g.values, notes: g.notes }, change);
      return { ...s, selected: change.cells[0][0], game: { ...g, values: b.values, notes: b.notes, history: g.history.slice(0, -1) } };
    });
  }, [setState]);

  const select = useCallback((i: number | null) => setState((s) => (s.selected === i ? s : { ...s, selected: i })), [setState]);

  const selectAt = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = boardRef.current;
    if (!el) return;
    const i = cellFromPoint(el.getBoundingClientRect(), e.clientX, e.clientY);
    if (i !== null) select(i);
  };
  const onBoardPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' || !game || game.won || paused) return;
    touch.current = { id: e.pointerId, suppressUntil: 0 };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    selectAt(e);
  };
  const onBoardPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (touch.current?.id === e.pointerId) selectAt(e);
  };
  const onBoardPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (touch.current?.id !== e.pointerId) return;
    touch.current = { id: -1, suppressUntil: Date.now() + 500 };
  };
  const onCellClick = (i: number) => {
    if (touch.current && Date.now() < touch.current.suppressUntil) return;
    select(i);
  };
  const toggleNotes = useCallback(() => setState((s) => ({ ...s, notesMode: !s.notesMode })), [setState]);
  const setPaused = useCallback((p: boolean) => setState((s) => ({ ...s, paused: p })), [setState]);

  // ---- physical keyboard --------------------------------------------------
  useEffect(() => {
    if (!playing || generating) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (document.querySelector('dialog[open]')) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (paused) {
        if (e.key === 'p' || e.key === ' ') {
          e.preventDefault();
          setPaused(false);
        }
        return;
      }
      const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
      if (moves[e.key]) {
        e.preventDefault();
        const [dr, dc] = moves[e.key];
        const cur = selected ?? 40;
        const r = selected === null ? 4 : (rowOf(cur) + dr + 9) % 9;
        const c = selected === null ? 4 : (colOf(cur) + dc + 9) % 9;
        select(r * 9 + c);
        return;
      }
      if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        input(Number(e.key));
      } else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') {
        e.preventDefault();
        erase();
      } else if (e.key === 'n' || e.key === 'N') {
        toggleNotes();
      } else if (e.key === 'u' || e.key === 'U') {
        undo();
      } else if (e.key === 'p' || e.key === 'P') {
        setPaused(true);
      } else if (e.key === 'Escape') {
        select(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playing, generating, paused, selected, input, erase, undo, select, toggleNotes, setPaused]);

  useEffect(() => {
    if (shake === null) return;
    const id = window.setTimeout(() => setShake(null), 380);
    return () => window.clearTimeout(id);
  }, [shake]);

  // ---- derived ------------------------------------------------------------
  const done = game ? completedDigits(game.values, game.solution) : new Set<number>();
  const selDigit = game && selected !== null ? game.values[selected] : 0;
  const remaining = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (game ? 9 - game.values.filter((v, i) => v === d && game.solution[i] === d).length : 9));
  const inProgress = !!game && !game.won && game.values.some((v, i) => v !== game.givens[i] || game.notes[i]);

  const rules = (
    <>
      <p>Fill every row, every column and every 3×3 box with the digits 1 to 9 — each exactly once.</p>
      <ul>
        <li>Tap a square, then a number. Digits in dark ink are given and can’t change.</li>
        <li>Turn on <strong>Notes</strong> to pencil in candidates. Placing a digit tidies matching notes nearby.</li>
        <li>A digit that doesn’t belong is underlined in red and counted as a mistake. There’s no limit — take your time.</li>
        <li>Every grid has exactly one solution, so no guessing is ever required.</li>
        <li>On a keyboard: 1–9, arrows, Backspace, N for notes, U to undo, P to pause.</li>
      </ul>
    </>
  );

  const status = !game
    ? ''
    : game.won
      ? `Solved in ${formatTime(game.elapsed)}`
      : paused
        ? 'Paused'
        : notesMode
          ? 'Notes on — tap numbers to pencil them in'
          : '';

  return (
    <GameScreen
      title="Pocket Sudoku"
      kicker={game ? `Solo · ${DIFFICULTY_LABEL[game.difficulty]}` : 'Solo · logic'}
      backTo="/play"
      className="sdk-body"
      rules={rules}
      menu={[
        { label: 'New game', onSelect: () => (inProgress ? setConfirm('new') : setState((s) => ({ ...s, game: null }))), disabled: !game || !!generating },
        { label: 'Restart this grid', onSelect: () => setConfirm('restart'), disabled: !inProgress, destructive: true },
      ]}
    >
      {generating ? (
        <div className="sdk-setup panel" aria-live="polite">
          <div className="sdk-shuffle" aria-hidden="true">
            {Array.from({ length: 9 }, (_, i) => <span key={i} style={{ animationDelay: `${i * 60}ms` }} />)}
          </div>
          <p className="sdk-setup__title display">Shuffling a fresh grid…</p>
          <p className="meta">{DIFFICULTY_LABEL[generating]}</p>
        </div>
      ) : !game ? (
        <div className="sdk-setup panel anim-rise">
          <p className="sdk-setup__title display">A fresh nine-by-nine</p>
          <p className="muted">Every grid is made on your phone and has exactly one solution.</p>
          <Segmented label="Difficulty" options={DIFF_OPTIONS} value={state.difficulty} onChange={(d) => setState((s) => ({ ...s, difficulty: d }))} />
          <Button variant="primary" size="lg" onClick={() => start(state.difficulty)}>Start</Button>
        </div>
      ) : (
        <>
          <div className="sdk-bar">
            <span className="sdk-bar__item">
              <span className="sdk-bar__label">Mistakes</span>
              <span className="sdk-bar__value">{game.mistakes}</span>
            </span>
            <span className="sdk-bar__item sdk-bar__item--time">
              <span className="sdk-bar__label">Time</span>
              <span className="sdk-bar__value" aria-label={`Time ${formatTime(game.elapsed)}`}>{formatTime(game.elapsed)}</span>
            </span>
            {!game.won && (
              <button type="button" className="sdk-pause" onClick={() => setPaused(!paused)} aria-label={paused ? 'Resume' : 'Pause'}>
                {paused ? <IconPlay size={18} /> : <IconPause size={18} />}
                <span>{paused ? 'Resume' : 'Pause'}</span>
              </button>
            )}
          </div>

          <div className="sdk-board-wrap">
            <div
              ref={boardRef}
              className={`sdk-board no-select${paused && !game.won ? ' is-paused' : ''}${game.won ? ' is-won' : ''}`}
              role="group"
              aria-label="Sudoku board"
              aria-hidden={paused && !game.won ? true : undefined}
              onPointerDown={onBoardPointerDown}
              onPointerMove={onBoardPointerMove}
              onPointerUp={onBoardPointerEnd}
              onPointerCancel={onBoardPointerEnd}
            >
              {UNITS.slice(18).map((box, b) => (
                <div className="sdk-box" key={b}>
                  {box.map((i) => {
                    const v = game.values[i];
                    const given = !!game.givens[i];
                    const wrong = !!v && !given && v !== game.solution[i];
                    const sel = !game.won && selected === i;
                    const peer = !game.won && selected !== null && !sel && (rowOf(i) === rowOf(selected) || colOf(i) === colOf(selected) || boxOf(i) === boxOf(selected));
                    const same = !game.won && !!selDigit && v === selDigit && !sel;
                    const notes = !v ? noteDigits(game.notes[i]) : [];
                    const cls = ['sdk-cell', given && 'is-given', v && !given && 'is-player', wrong && 'is-wrong', sel && 'is-selected', peer && 'is-peer', same && 'is-same', shake === i && 'anim-shake']
                      .filter(Boolean)
                      .join(' ');
                    const label = `Row ${rowOf(i) + 1}, column ${colOf(i) + 1}: ${v ? `${v}${given ? ', given' : wrong ? ', incorrect' : ''}` : notes.length ? `empty, notes ${notes.join(' ')}` : 'empty'}`;
                    return (
                      <button
                        key={i}
                        type="button"
                        className={cls}
                        aria-label={label}
                        aria-pressed={sel}
                        disabled={game.won || paused}
                        onClick={() => onCellClick(i)}
                      >
                        {v ? (
                          <span className="sdk-digit" key={v}>{v}</span>
                        ) : notes.length ? (
                          <span className="sdk-notes" aria-hidden="true">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                              <span key={d} className={selDigit === d ? 'is-hl' : undefined}>{notes.includes(d) ? d : ''}</span>
                            ))}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            {paused && !game.won && (
              <div className="sdk-paused anim-rise">
                <p className="display">Paused</p>
                <p className="meta">The grid is hidden while the clock is stopped.</p>
                <Button variant="primary" icon={<IconPlay size={18} />} onClick={() => setPaused(false)}>Resume</Button>
              </div>
            )}
          </div>

          <p className="visually-hidden" aria-live="polite">{status}</p>

          {game.won ? (
            <div className="end-card">
              {game.newBest && <p className="eyebrow">New best</p>}
              <p className="end-card__title display">Solved</p>
              <dl className="sdk-stats">
                <div><dt>Time</dt><dd>{formatTime(game.elapsed)}</dd></div>
                <div><dt>Mistakes</dt><dd>{game.mistakes}</dd></div>
                <div><dt>Level</dt><dd>{DIFFICULTY_LABEL[game.difficulty]}</dd></div>
              </dl>
              <p className="muted">{game.mistakes === 0 ? 'Clean sheet. Not a single slip.' : 'Every square in its place.'}</p>
              <Segmented label="Difficulty" options={DIFF_OPTIONS} value={state.difficulty} onChange={(d) => setState((s) => ({ ...s, difficulty: d }))} />
              <div className="end-card__actions">
                <Button variant="primary" size="lg" onClick={() => start(state.difficulty)}>New game</Button>
              </div>
            </div>
          ) : (
            <div className={`sdk-keys${notesMode ? ' is-notes' : ''}`} role="group" aria-label={notesMode ? 'Pencil a note' : 'Place a number'} aria-hidden={paused ? true : undefined}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
                const left = remaining[d - 1];
                return (
                  <button
                    key={d}
                    type="button"
                    className={`sdk-key${done.has(d) ? ' is-done' : ''}`}
                    style={{ gridArea: `d${d}` }}
                    aria-label={done.has(d) ? `${d}, all placed` : `${d}, ${left} left`}
                    disabled={paused}
                    onClick={() => input(d)}
                  >
                    <span className="sdk-key__digit">{d}</span>
                    {!notesMode && left > 0 && <span className="sdk-key__left" aria-hidden="true">{left}</span>}
                  </button>
                );
              })}
              <button type="button" className="sdk-tool" style={{ gridArea: 'erase' }} onClick={erase} disabled={paused || selected === null || !!game.givens[selected] || (!game.values[selected] && !game.notes[selected])}>
                <IconEraser size={20} />
                <span>Erase</span>
              </button>
              <button type="button" className="sdk-tool" style={{ gridArea: 'undo' }} onClick={undo} disabled={paused || game.history.length === 0}>
                <IconUndo size={20} />
                <span>Undo</span>
              </button>
              <button type="button" className="sdk-tool" style={{ gridArea: 'notes' }} aria-pressed={notesMode} onClick={toggleNotes} disabled={paused}>
                <IconPencil size={20} />
                <span>{notesMode ? 'Notes on' : 'Notes off'}</span>
              </button>
            </div>
          )}
        </>
      )}

      <Confirm
        open={confirm !== null}
        title={confirm === 'new' ? 'Start a new grid?' : 'Restart this grid?'}
        message={confirm === 'new' ? 'Your progress on this grid will be lost.' : 'Your digits, notes and time will be cleared. The givens stay.'}
        confirmLabel={confirm === 'new' ? 'New game' : 'Restart'}
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const which = confirm;
          setConfirm(null);
          if (which === 'new') setState((s) => ({ ...s, game: null, paused: false, selected: null }));
          else
            setState((s) =>
              s.game
                ? { ...s, paused: false, game: { ...s.game, values: s.game.givens.slice(), notes: Array(81).fill(0), mistakes: 0, elapsed: 0, history: [] } }
                : s,
            );
        }}
      />
    </GameScreen>
  );
}
