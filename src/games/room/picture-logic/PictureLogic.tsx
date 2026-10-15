import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { usePersistentState } from '../../../lib/storage';
import { recordRoomResult } from '../../../room/stats';
import { GameScreen } from '../../../ui/GameScreen';
import { Button } from '../../../ui/Button';
import { Confirm } from '../../../ui/Confirm';
import { Segmented } from '../../../ui/Segmented';
import { IconCheck, IconLightbulb, IconUndo } from '../../../ui/icons';
import {
  BLANK,
  CROSS,
  FILL,
  applyStroke,
  colOf,
  countMistakes,
  decodeMarks,
  encodeMarks,
  findHint,
  formatTime,
  isSolved,
  lineSatisfied,
  rowOf,
  strokeAction,
  strokeCells,
  type Bitmap,
  type Mark,
  type StrokeAction,
} from './logic';
import { ALL_PUZZLES, PUZZLES_10, PUZZLES_5, SIZE_LABEL, nextUnsolved, puzzleById, type Puzzle, type SizeId } from './puzzles';
import './styles.css';

interface Progress {
  marks: string;
  elapsed: number; // ms
  done: boolean;
  newBest: boolean;
  hints: number;
}

interface State {
  view: 'picker' | 'play';
  current: string | null;
  mode: 'fill' | 'cross';
  pickerSize: SizeId;
  /** Best solve time (seconds) per puzzle id. */
  solved: Record<string, { seconds: number; at: number }>;
  progress: Record<string, Progress>;
}

const initial = (): State => ({ view: 'picker', current: null, mode: 'fill', pickerSize: '5x5', solved: {}, progress: {} });
const isValidState = (s: State | undefined): s is State =>
  !!s && (s.view === 'picker' || s.view === 'play') && typeof s.solved === 'object' && !!s.solved && typeof s.progress === 'object' && !!s.progress;

const LONG_PRESS_MS = 400;
const UNDO_CAP = 120;
const SIZE_OPTIONS = (['5x5', '10x10'] as SizeId[]).map((v) => ({ value: v, label: SIZE_LABEL[v] }));

export function Thumb({ bitmap, size, className }: { bitmap: Bitmap; size: number; className?: string }) {
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} aria-hidden="true" shapeRendering="crispEdges">
      {bitmap.map((b, i) => (b ? <rect key={i} x={i % size} y={Math.floor(i / size)} width="1.02" height="1.02" /> : null))}
    </svg>
  );
}

function CrossGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="pl-x" aria-hidden="true">
      <path d="M7 7l10 10M17 7L7 17" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

const freshProgress = (p: Puzzle): Progress => ({ marks: encodeMarks(Array(p.size * p.size).fill(BLANK)), elapsed: 0, done: false, newBest: false, hints: 0 });

export default function PictureLogic() {
  const [stored, setStored] = usePersistentState<State>('room:picture-logic', initial, 1);
  const state = isValidState(stored) ? stored : initial();
  const stateRef = useRef(state);
  stateRef.current = state;
  const commit = useCallback(
    (next: State) => {
      stateRef.current = next;
      setStored(next);
    },
    [setStored],
  );

  const puzzle = state.view === 'play' ? puzzleById(state.current) : undefined;
  const solvedSet = useMemo(() => new Set(Object.keys(state.solved)), [state.solved]);

  const open = (p: Puzzle) => {
    const s = stateRef.current;
    const prog = s.progress[p.id];
    // Re-opening a finished picture starts it again.
    const progress = !prog || prog.done ? { ...s.progress, [p.id]: freshProgress(p) } : s.progress;
    commit({ ...s, view: 'play', current: p.id, pickerSize: p.sizeId, progress });
    window.scrollTo?.(0, 0);
  };
  const toPicker = () => {
    commit({ ...stateRef.current, view: 'picker' });
    window.scrollTo?.(0, 0);
  };

  if (!puzzle) return <Picker state={state} solvedSet={solvedSet} onOpen={open} onSize={(z) => commit({ ...stateRef.current, pickerSize: z })} />;
  return <Play key={puzzle.id} puzzle={puzzle} state={state} stateRef={stateRef} commit={commit} solvedSet={solvedSet} onOpen={open} onPicker={toPicker} />;
}

// ---------------------------------------------------------------------------
// Picker
// ---------------------------------------------------------------------------

const RULES = (
  <>
    <p>Each number is a run of filled squares in that row or column, in order, with at least one gap between runs. Fill the right squares to reveal a picture.</p>
    <ul>
      <li>Tap to fill. Drag along a row or column to fill a run.</li>
      <li>Switch to <strong>Cross</strong> — or press and hold — to mark squares you know are empty.</li>
      <li>A clue dims once its line matches. <strong>Check</strong> tells you how many squares are wrong, not where. <strong>Hint</strong> fills a square the clues force.</li>
      <li>Every picture can be solved by logic alone, one line at a time. No guessing.</li>
      <li>On a keyboard: arrows move, Space fills, X crosses, Ctrl+Z undoes.</li>
    </ul>
  </>
);

function Picker({ state, solvedSet, onOpen, onSize }: { state: State; solvedSet: Set<string>; onOpen: (p: Puzzle) => void; onSize: (z: SizeId) => void }) {
  const list = state.pickerSize === '5x5' ? PUZZLES_5 : PUZZLES_10;
  const next = nextUnsolved(solvedSet, null);
  const nextHere = list.find((p) => !solvedSet.has(p.id)) ?? next;
  const total = ALL_PUZZLES.length;
  return (
    <GameScreen title="Picture Logic" kicker="Solo · pictures from clues" backTo="/play" className="pl-body" rules={RULES}>
      <div className="pl-picker-head">
        <p className="meta">{solvedSet.size === total ? 'Every picture revealed. Replay any you like.' : `${solvedSet.size} of ${total} pictures revealed`}</p>
        {nextHere && (
          <Button variant="primary" size="lg" onClick={() => onOpen(nextHere)}>
            {state.progress[nextHere.id] && !state.progress[nextHere.id].done ? 'Continue' : 'Next unsolved'}
          </Button>
        )}
        <Segmented label="Grid size" options={SIZE_OPTIONS} value={state.pickerSize} onChange={onSize} />
      </div>
      <ul className="pl-tiles" aria-label={`${SIZE_LABEL[state.pickerSize]} pictures`}>
        {list.map((p) => {
          const solved = solvedSet.has(p.id);
          const prog = state.progress[p.id];
          const started = !!prog && !prog.done && prog.marks.includes('1');
          return (
            <li key={p.id}>
              <button
                type="button"
                className={`pl-tile${solved ? ' is-solved' : ''}`}
                onClick={() => onOpen(p)}
                aria-label={solved ? `${p.title}, solved in ${formatTime(state.solved[p.id].seconds)}` : `Picture ${p.number}, ${SIZE_LABEL[p.sizeId]}${started ? ', in progress' : ''}`}
              >
                {solved ? <Thumb bitmap={p.bitmap} size={p.size} className="pl-tile__thumb" /> : <span className="pl-tile__blank" aria-hidden="true">{SIZE_LABEL[p.sizeId]}</span>}
                <span className="pl-tile__label" aria-hidden="true">{solved ? p.title : `No. ${p.number}`}</span>
                {started && <span className="pl-tile__dot" aria-hidden="true" />}
                {solved && <span className="pl-tile__check" aria-hidden="true"><IconCheck size={12} /></span>}
              </button>
            </li>
          );
        })}
      </ul>
    </GameScreen>
  );
}

// ---------------------------------------------------------------------------
// Play
// ---------------------------------------------------------------------------

interface PlayProps {
  puzzle: Puzzle;
  state: State;
  stateRef: MutableRefObject<State>;
  commit: (s: State) => void;
  solvedSet: Set<string>;
  onOpen: (p: Puzzle) => void;
  onPicker: () => void;
}

interface Stroke {
  pointerId: number;
  start: number;
  end: number;
  base: Mark[];
  action: StrokeAction;
  timer: number | null;
  touch: boolean;
}

function Play({ puzzle, state, stateRef, commit, solvedSet, onOpen, onPicker }: PlayProps) {
  const { size, clues, bitmap } = puzzle;
  const prog = state.progress[puzzle.id] ?? freshProgress(puzzle);
  const saved = useMemo(() => decodeMarks(prog.marks, size), [prog.marks, size]);
  const [preview, setPreview] = useState<Mark[] | null>(null);
  const marks = preview ?? saved;
  const done = prog.done;
  const [cursor, setCursor] = useState(0);
  const [note, setNote] = useState('');
  const [hinted, setHinted] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const undoStack = useRef<string[]>([]);
  const [, bump] = useState(0);
  const cellsRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusCursor = useRef(false);
  const stroke = useRef<Stroke | null>(null);
  /** Last pointer activity on the grid; clicks right after it are the pointer's own and are ignored. */
  const lastPointerAt = useRef(0);
  const endRef = useRef<HTMLDivElement>(null);

  // ---- timer --------------------------------------------------------------
  const lastTick = useRef(Date.now());
  useEffect(() => {
    if (done) return;
    lastTick.current = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === 'hidden') {
        lastTick.current = now;
        return;
      }
      const delta = Math.min(now - lastTick.current, 2000);
      lastTick.current = now;
      const s = stateRef.current;
      const p = s.progress[puzzle.id];
      if (!p || p.done || s.current !== puzzle.id || s.view !== 'play') return;
      commit({ ...s, progress: { ...s.progress, [puzzle.id]: { ...p, elapsed: p.elapsed + delta } } });
    }, 1000);
    const onVis = () => (lastTick.current = Date.now());
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [done, puzzle.id, commit, stateRef]);

  // ---- commit marks (win detection + stats, exactly once) -----------------
  const save = useCallback(
    (next: Mark[], opts: { hint?: boolean } = {}) => {
      const s = stateRef.current;
      const p = s.progress[puzzle.id] ?? freshProgress(puzzle);
      if (p.done) return;
      const enc = encodeMarks(next);
      if (enc === p.marks) return;
      undoStack.current = [...undoStack.current, p.marks].slice(-UNDO_CAP);
      let np: Progress = { ...p, marks: enc, hints: p.hints + (opts.hint ? 1 : 0) };
      let solved = s.solved;
      if (isSolved(next, bitmap)) {
        const ms = p.elapsed + Math.min(Date.now() - lastTick.current, 1000);
        const seconds = Math.max(1, Math.round(ms / 1000));
        const newBest = recordRoomResult('picture-logic', { outcome: 'win', score: { variant: puzzle.sizeId, value: seconds, better: 'lower', label: formatTime(seconds) } });
        np = { ...np, done: true, elapsed: seconds * 1000, newBest };
        const prev = s.solved[puzzle.id];
        solved = { ...s.solved, [puzzle.id]: { seconds: prev ? Math.min(prev.seconds, seconds) : seconds, at: Date.now() } };
        setNote('');
      }
      commit({ ...s, solved, progress: { ...s.progress, [puzzle.id]: np } });
    },
    [bitmap, commit, puzzle, stateRef],
  );

  const undo = useCallback(() => {
    const s = stateRef.current;
    const p = s.progress[puzzle.id];
    const prev = undoStack.current[undoStack.current.length - 1];
    if (!p || p.done || prev === undefined) return;
    undoStack.current = undoStack.current.slice(0, -1);
    commit({ ...s, progress: { ...s.progress, [puzzle.id]: { ...p, marks: prev } } });
    bump((n) => n + 1);
  }, [commit, puzzle.id, stateRef]);

  // ---- pointer painting -----------------------------------------------------
  const cellAt = (x: number, y: number): number | null => {
    const el = cellsRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (r.width <= 0) return null;
    const c = Math.floor(((x - r.left) / r.width) * size);
    const row = Math.floor(((y - r.top) / r.height) * size);
    if (c < 0 || row < 0 || c >= size || row >= size) return null;
    return row * size + c;
  };
  const clamp = (x: number, y: number): number => {
    const el = cellsRef.current!;
    const r = el.getBoundingClientRect();
    const c = Math.min(size - 1, Math.max(0, Math.floor(((x - r.left) / r.width) * size)));
    const row = Math.min(size - 1, Math.max(0, Math.floor(((y - r.top) / r.height) * size)));
    return row * size + c;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    lastPointerAt.current = Date.now();
    if (done || stroke.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 2) return;
    const i = cellAt(e.clientX, e.clientY);
    if (i === null) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const mode: 1 | 2 = e.button === 2 || state.mode === 'cross' ? CROSS : FILL;
    const base = saved.slice();
    const action = strokeAction(base, i, mode);
    const touch = e.pointerType !== 'mouse';
    const st: Stroke = { pointerId: e.pointerId, start: i, end: i, base, action, timer: null, touch };
    if (touch && mode === FILL) {
      st.timer = window.setTimeout(() => {
        const cur = stroke.current;
        if (!cur || cur.end !== cur.start) return;
        cur.timer = null;
        cur.action = strokeAction(cur.base, cur.start, CROSS);
        navigator.vibrate?.(12);
        setPreview(applyStroke(cur.base, [cur.start], cur.action));
      }, LONG_PRESS_MS);
    }
    stroke.current = st;
    setCursor(i);
    setPreview(applyStroke(base, [i], action));
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const st = stroke.current;
    if (!st || st.pointerId !== e.pointerId) return;
    const i = clamp(e.clientX, e.clientY);
    if (i === st.end) return;
    st.end = i;
    if (st.timer !== null) {
      window.clearTimeout(st.timer);
      st.timer = null;
    }
    setPreview(applyStroke(st.base, strokeCells(size, st.start, i), st.action));
  };
  const endStroke = (e: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    const st = stroke.current;
    lastPointerAt.current = Date.now();
    if (!st || st.pointerId !== e.pointerId) return;
    if (st.timer !== null) window.clearTimeout(st.timer);
    stroke.current = null;
    const next = applyStroke(st.base, strokeCells(size, st.start, st.end), st.action);
    setPreview(null);
    if (!cancelled) save(next);
  };

  // Keyboard / assistive tech: a click with no pointer stroke behind it.
  const toggleAt = useCallback(
    (i: number, mark: 1 | 2) => {
      const cur = decodeMarks(stateRef.current.progress[puzzle.id]?.marks, size);
      save(applyStroke(cur, [i], strokeAction(cur, i, mark)));
    },
    [puzzle.id, save, size, stateRef],
  );

  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
      return;
    }
    if (moves[e.key]) {
      e.preventDefault();
      const [dr, dc] = moves[e.key];
      const r = Math.min(size - 1, Math.max(0, Math.floor(cursor / size) + dr));
      const c = Math.min(size - 1, Math.max(0, (cursor % size) + dc));
      focusCursor.current = true;
      setCursor(r * size + c);
    } else if (e.key === 'x' || e.key === 'X') {
      e.preventDefault();
      toggleAt(cursor, CROSS);
    }
  };
  useEffect(() => {
    if (focusCursor.current) {
      focusCursor.current = false;
      cellRefs.current[cursor]?.focus();
    }
  }, [cursor]);

  // ---- tools --------------------------------------------------------------
  const check = () => {
    const n = countMistakes(saved, bitmap);
    setNote(n === 0 ? 'No mistakes so far.' : n === 1 ? '1 square is wrong.' : `${n} squares are wrong.`);
  };
  const hint = () => {
    const h = findHint(saved, bitmap, clues);
    if (!h) return;
    const next = saved.slice();
    next[h.index] = h.value === 'fill' ? FILL : CROSS;
    setHinted(h.index);
    setCursor(h.index);
    setNote(h.value === 'fill' ? 'The clues force that square.' : 'That square must be empty.');
    save(next, { hint: true });
  };
  useEffect(() => {
    if (hinted === null) return;
    const id = window.setTimeout(() => setHinted(null), 900);
    return () => window.clearTimeout(id);
  }, [hinted]);
  useEffect(() => {
    if (!note) return;
    const id = window.setTimeout(() => setNote(''), 3200);
    return () => window.clearTimeout(id);
  }, [note]);
  useEffect(() => {
    if (done) endRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [done]);

  const setMode = (m: 'fill' | 'cross') => commit({ ...stateRef.current, mode: m });
  const clearAll = () => {
    const s = stateRef.current;
    undoStack.current = [];
    const p = s.progress[puzzle.id];
    commit({ ...s, progress: { ...s.progress, [puzzle.id]: { ...freshProgress(puzzle), elapsed: p?.elapsed ?? 0, hints: p?.hints ?? 0 } } });
  };

  // ---- layout -------------------------------------------------------------
  const maxRow = Math.max(1, ...clues.rows.map((c) => c.length));
  const maxCol = Math.max(1, ...clues.cols.map((c) => c.length));
  const boardStyle = { '--pl-n': size, '--pl-r': maxRow, '--pl-c': maxCol } as CSSProperties;
  const nextP = nextUnsolved(solvedSet, puzzle.id);
  const elapsedS = Math.floor(prog.elapsed / 1000);
  const filledCount = marks.filter((m) => m === FILL).length;

  return (
    <GameScreen
      title="Picture Logic"
      kicker={`No. ${puzzle.number} · ${SIZE_LABEL[puzzle.sizeId]}${done ? ` · ${puzzle.title}` : ''}`}
      backTo="/play"
      className="pl-body"
      rules={RULES}
      menu={[
        { label: 'All pictures', onSelect: onPicker },
        { label: 'Clear this grid', onSelect: () => setConfirmClear(true), disabled: done || filledCount + marks.filter((m) => m === CROSS).length === 0, destructive: true },
      ]}
    >
      <div className="pl-bar">
        <Button variant="quiet" size="sm" onClick={onPicker}>Pictures</Button>
        <span className="pl-bar__time" aria-label={`Time ${formatTime(elapsedS)}`}>{formatTime(elapsedS)}</span>
        {!done && (
          <span className="pl-bar__tools">
            <button type="button" className="pl-tool" onClick={check}>
              <IconCheck size={18} />
              <span>Check</span>
            </button>
            <button type="button" className="pl-tool" onClick={hint}>
              <IconLightbulb size={18} />
              <span>Hint</span>
            </button>
          </span>
        )}
      </div>

      <div className={`pl-board pl-n${size}${done ? ' is-solved' : ''}`} style={boardStyle}>
        <div className="pl-corner" aria-hidden="true" />
        <div className="pl-colclues" aria-hidden="true">
          {clues.cols.map((clue, c) => (
            <div key={c} className={`pl-colclue${lineSatisfied(clue, colOf(marks, size, c)) ? ' is-met' : ''}${c % 5 === 4 && c < size - 1 ? ' is-major' : ''}`}>
              {(clue.length ? clue : [0]).map((v, k) => <span key={k}>{v}</span>)}
            </div>
          ))}
        </div>
        <div className="pl-rowclues" aria-hidden="true">
          {clues.rows.map((clue, r) => (
            <div key={r} className={`pl-rowclue${lineSatisfied(clue, rowOf(marks, size, r)) ? ' is-met' : ''}${r % 5 === 4 && r < size - 1 ? ' is-major' : ''}`}>
              {(clue.length ? clue : [0]).map((v, k) => <span key={k}>{v}</span>)}
            </div>
          ))}
        </div>
        <div
          ref={cellsRef}
          className="pl-cells no-touch-scroll"
          role="grid"
          aria-label={`Picture grid, ${size} by ${size}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={(e) => endStroke(e)}
          onPointerCancel={(e) => endStroke(e, true)}
          onContextMenu={(e) => e.preventDefault()}
          onKeyDown={onKey}
        >
          {Array.from({ length: size }, (_, r) => (
            <div role="row" key={r} className="pl-row">
              {Array.from({ length: size }, (_, c) => {
                const i = r * size + c;
                const m = marks[i];
                const cls = [
                  'pl-cell',
                  m === FILL && 'is-fill',
                  m === CROSS && 'is-cross',
                  c % 5 === 4 && c < size - 1 && 'is-major-c',
                  r % 5 === 4 && r < size - 1 && 'is-major-r',
                  hinted === i && 'is-hinted',
                ]
                  .filter(Boolean)
                  .join(' ');
                const rowClue = clues.rows[r].join(' ') || '0';
                const colClue = clues.cols[c].join(' ') || '0';
                return (
                  <div role="gridcell" key={c} className="pl-gridcell">
                    <button
                      ref={(el) => (cellRefs.current[i] = el)}
                      type="button"
                      className={cls}
                      style={done ? ({ '--d': `${(r + c) * 28}ms` } as CSSProperties) : undefined}
                      tabIndex={i === cursor ? 0 : -1}
                      aria-label={`Row ${r + 1} (clue ${rowClue}), column ${c + 1} (clue ${colClue}): ${m === FILL ? 'filled' : m === CROSS ? 'crossed' : 'blank'}`}
                      aria-disabled={done || undefined}
                      onFocus={() => setCursor(i)}
                      onClick={() => {
                        if (Date.now() - lastPointerAt.current > 800 && !done) toggleAt(i, state.mode === 'cross' ? CROSS : FILL);
                      }}
                    >
                      {m === CROSS && !done && <CrossGlyph />}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <p className="pl-note meta" aria-live="polite">{note}</p>

      {done ? (
        <div className="end-card pl-end" ref={endRef} role="region" aria-label="Result">
          <p className="eyebrow">{prog.newBest ? 'New best' : 'Picture revealed'}</p>
          <h2 className="end-card__title display">{puzzle.title}</h2>
          <p className="muted">
            {`Solved in ${formatTime(elapsedS)}`}
            {prog.hints ? ` with ${prog.hints} hint${prog.hints === 1 ? '' : 's'}` : ''}.
            {prog.newBest ? ` Your fastest ${SIZE_LABEL[puzzle.sizeId]} yet.` : ''}
          </p>
          <div className="end-card__actions">
            {nextP ? (
              <Button variant="primary" size="lg" onClick={() => onOpen(nextP)}>Next picture</Button>
            ) : (
              <p className="meta">That was the last unsolved picture. Well done.</p>
            )}
            <Button variant="quiet" onClick={onPicker}>All pictures</Button>
          </div>
        </div>
      ) : (
        <div className="pl-dock">
          <div className="pl-mode" role="group" aria-label="Tap action">
            <button type="button" className="pl-mode__opt" aria-pressed={state.mode === 'fill'} onClick={() => setMode('fill')}>
              <span className="pl-mode__swatch" aria-hidden="true" />
              <span>Fill</span>
            </button>
            <button type="button" className="pl-mode__opt pl-mode__opt--cross" aria-pressed={state.mode === 'cross'} onClick={() => setMode('cross')}>
              <CrossGlyph />
              <span>Cross</span>
            </button>
          </div>
          <button type="button" className="pl-undo" onClick={undo} disabled={undoStack.current.length === 0} aria-label="Undo">
            <IconUndo size={20} />
            <span>Undo</span>
          </button>
        </div>
      )}

      <Confirm
        open={confirmClear}
        title="Clear this grid?"
        message="Every fill and cross on this picture will be wiped. The clock keeps its time."
        confirmLabel="Clear"
        destructive
        onCancel={() => setConfirmClear(false)}
        onConfirm={() => {
          setConfirmClear(false);
          clearAll();
        }}
      />
    </GameScreen>
  );
}
