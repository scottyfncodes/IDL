import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { usePersistentState } from '../../../lib/storage';
import { freshSeed } from '../../../lib/rng';
import { recordRoomResult } from '../../../room/stats';
import { GameScreen } from '../../../ui/GameScreen';
import { Button } from '../../../ui/Button';
import { Confirm } from '../../../ui/Confirm';
import { Segmented } from '../../../ui/Segmented';
import {
  FLAGGED,
  HIDDEN,
  REVEALED,
  SIZES,
  SIZE_IDS,
  adjacentCounts,
  chord,
  formatTime,
  generateMines,
  isValidField,
  mineMask,
  minesLeft,
  newField,
  reveal,
  toggleFlag,
  type Field,
  type SizeId,
} from './logic';
import './styles.css';

type Generation = 'no-guess' | 'fallback' | 'classic';

interface Game {
  size: SizeId;
  seed: number;
  field: Field;
  elapsed: number; // ms
  generation: Generation | null;
  /** Result already written to stats (guards against double counting). */
  recorded: boolean;
  newBest: boolean;
}

interface State {
  size: SizeId;
  noGuess: boolean;
  chording: boolean;
  flagMode: boolean;
  game: Game;
}

const LONG_PRESS_MS = 400;
const MOVE_SLOP = 10;

const freshGame = (size: SizeId): Game => ({ size, seed: freshSeed(), field: newField(size), elapsed: 0, generation: null, recorded: false, newBest: false });
const initial = (): State => ({ size: 'small', noGuess: true, chording: true, flagMode: false, game: freshGame('small') });
const isValidState = (s: State | undefined): s is State => !!s && !!s.game && s.game.size in SIZES && isValidField(s.game.field);

const SIZE_OPTIONS = SIZE_IDS.map((id) => ({ value: id, label: SIZES[id].label }));

export function MineGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6 6l2.1 2.1M15.9 15.9L18 18M6 18l2.1-2.1M15.9 8.1L18 6" />
      </g>
      <circle cx="12" cy="12" r="5.6" fill="currentColor" />
      <circle cx="10" cy="10" r="1.4" fill="var(--card)" opacity="0.8" />
    </svg>
  );
}

export function FlagGlyph({ className, crossed }: { className?: string; crossed?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M7.5 3.5v17" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
      <path d="M8.5 4.2l10 4.3-10 4.3z" fill="currentColor" />
      <path d="M5 20.5h6" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
      {crossed && <path d="M4 4l16 16" stroke="var(--error)" strokeWidth="2.4" strokeLinecap="round" />}
    </svg>
  );
}

function DigGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="mn-mode__icon" aria-hidden="true">
      <rect x="4.5" y="4.5" width="15" height="15" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="2.6" fill="currentColor" />
    </svg>
  );
}

export default function Mines() {
  const [stored, setStored] = usePersistentState<State>('room:mines', initial, 1);
  const state = isValidState(stored) ? stored : initial();
  const { game, flagMode, chording } = state;
  const { field } = game;
  const stateRef = useRef(state);
  stateRef.current = state;
  const [confirm, setConfirm] = useState<null | { size: SizeId }>(null);
  const [cursor, setCursor] = useState(0);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusCursor = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  const playing = field.status === 'playing';
  const over = field.status === 'won' || field.status === 'lost';

  // ---- timer --------------------------------------------------------------
  const lastTick = useRef(Date.now());
  useEffect(() => {
    if (!playing) return;
    lastTick.current = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      if (document.visibilityState === 'hidden') {
        lastTick.current = now;
        return;
      }
      const delta = Math.min(now - lastTick.current, 2000);
      lastTick.current = now;
      setStored((s) => (isValidState(s) && s.game.field.status === 'playing' ? { ...s, game: { ...s.game, elapsed: s.game.elapsed + delta } } : s));
    }, 1000);
    const onVis = () => {
      lastTick.current = Date.now();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [playing, setStored]);

  // ---- moves --------------------------------------------------------------
  const commit = useCallback(
    (next: State) => {
      stateRef.current = next;
      setStored(next);
    },
    [setStored],
  );

  const act = useCallback(
    (i: number, kind: 'tap' | 'flag') => {
      const s = stateRef.current;
      const g = s.game;
      const f = g.field;
      if (f.status === 'won' || f.status === 'lost') return;
      let nf = f;
      let generation = g.generation;
      const cell = f.cells[i];
      if (kind === 'flag') {
        nf = toggleFlag(f, i);
      } else if (cell === REVEALED) {
        if (s.chording) nf = chord(f, i);
      } else if (s.flagMode) {
        nf = toggleFlag(f, i);
      } else if (cell === HIDDEN) {
        if (f.status === 'ready') {
          const gen = generateMines(f.cols, f.rows, f.mineCount, i, g.seed, s.noGuess);
          generation = !s.noGuess ? 'classic' : gen.noGuess ? 'no-guess' : 'fallback';
          lastTick.current = Date.now();
          nf = reveal(f, i, gen.mines);
        } else nf = reveal(f, i);
      }
      if (nf === f) return;
      let ng: Game = { ...g, field: nf, generation };
      if ((nf.status === 'won' || nf.status === 'lost') && !g.recorded) {
        const elapsed = g.elapsed + (f.status === 'playing' ? Math.min(Date.now() - lastTick.current, 1000) : 0);
        const secs = Math.max(1, Math.round(elapsed / 1000));
        const newBest =
          nf.status === 'won'
            ? recordRoomResult('mines', { outcome: 'win', score: { variant: g.size, value: secs, better: 'lower', label: formatTime(secs * 1000) } })
            : (recordRoomResult('mines', { outcome: 'loss' }), false);
        ng = { ...ng, elapsed: secs * 1000, recorded: true, newBest };
      }
      if (navigator.vibrate && kind === 'flag') navigator.vibrate(12);
      commit({ ...s, game: ng });
    },
    [commit],
  );

  const startNew = useCallback(
    (size: SizeId) => {
      const s = stateRef.current;
      commit({ ...s, size, game: freshGame(size) });
      setCursor(0);
    },
    [commit],
  );
  const requestNew = (size: SizeId) => {
    if (playing) setConfirm({ size });
    else startNew(size);
  };

  // Bring the result into view when a game ends (the large field scrolls).
  useEffect(() => {
    if (over) endRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
  }, [over]);

  // ---- touch: tap, long-press to flag ------------------------------------
  const press = useRef<{ id: number; i: number; x: number; y: number; timer: number } | null>(null);
  /** Cell whose follow-up click belongs to a long-press and must be ignored. */
  const suppressClick = useRef<number | null>(null);
  const lastPointer = useRef<string>('mouse');
  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, i: number) => {
    lastPointer.current = e.pointerType;
    suppressClick.current = null;
    if (e.pointerType === 'mouse' || e.button !== 0 || over) return;
    cancelPress();
    const timer = window.setTimeout(() => {
      press.current = null;
      suppressClick.current = i;
      act(i, 'flag');
    }, LONG_PRESS_MS);
    press.current = { id: e.pointerId, i, x: e.clientX, y: e.clientY, timer };
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const p = press.current;
    if (!p || p.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) > MOVE_SLOP) cancelPress();
  };
  const onClick = (i: number) => {
    setCursor(i);
    if (suppressClick.current === i) {
      suppressClick.current = null;
      return;
    }
    act(i, 'tap');
  };
  const onContextMenu = (e: ReactMouseEvent, i: number) => {
    e.preventDefault();
    // Touch long-presses are handled by the timer; only mice flag here.
    if (lastPointer.current === 'mouse') act(i, 'flag');
  };
  useEffect(() => () => cancelPress(), []);

  // ---- keyboard -----------------------------------------------------------
  const onBoardKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dr, dc] = moves[e.key];
      const r = Math.min(field.rows - 1, Math.max(0, Math.floor(cursor / field.cols) + dr));
      const c = Math.min(field.cols - 1, Math.max(0, (cursor % field.cols) + dc));
      focusCursor.current = true;
      setCursor(r * field.cols + c);
    } else if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      act(cursor, 'flag');
    }
  };
  useEffect(() => {
    if (focusCursor.current) {
      focusCursor.current = false;
      cellRefs.current[cursor]?.focus();
    }
  }, [cursor]);

  const toggleMode = () => commit({ ...stateRef.current, flagMode: !stateRef.current.flagMode });

  // ---- derived ------------------------------------------------------------
  const counts = useMemo(() => adjacentCounts(field.cols, field.rows, field.mines), [field.cols, field.rows, field.mines]);
  const isMine = useMemo(() => mineMask(field.cells.length, field.mines), [field.cells.length, field.mines]);
  const left = minesLeft(field);
  const spec = SIZES[game.size];
  const boardStyle = { '--mn-cols': field.cols, '--mn-rows': field.rows } as CSSProperties;

  const status =
    field.status === 'ready'
      ? 'Tap any square to begin. The first one is always safe.'
      : field.status === 'won'
        ? `Field cleared in ${formatTime(game.elapsed)}.`
        : field.status === 'lost'
          ? 'A mine. That one was hiding well.'
          : flagMode
            ? 'Flag mode: taps plant or lift flags.'
            : '';

  const rules = (
    <>
      <p>Uncover every square that isn’t a mine. Each number tells you how many mines touch that square, diagonals included.</p>
      <ul>
        <li>Your first tap is always safe and opens up a patch of the field.</li>
        <li>Tap to uncover. Switch to <strong>Flag</strong> at the bottom (or press and hold a square) to mark a mine.</li>
        <li>Tap a number whose mines are all flagged to clear the rest of its neighbours at once.</li>
        <li><strong>No guessing needed</strong> (on by default) deals fields you can always clear by logic alone.</li>
        <li>On a computer: left click uncovers, right click flags. Arrow keys move, Space or Enter uncovers, F flags.</li>
      </ul>
    </>
  );

  const setup = (
    <div className="mn-setup">
      <Segmented label="Field size" options={SIZE_OPTIONS} value={over ? state.size : game.size} onChange={startNew} />
      <button
        type="button"
        role="switch"
        aria-checked={state.noGuess}
        className="mn-switch"
        onClick={() => commit({ ...stateRef.current, noGuess: !stateRef.current.noGuess })}
      >
        <span className="mn-switch__track" aria-hidden="true"><span className="mn-switch__thumb" /></span>
        <span>No guessing needed</span>
      </button>
    </div>
  );

  return (
    <GameScreen
      title="Mines"
      kicker={`Solo · ${spec.label} · ${spec.cols}×${spec.rows}`}
      backTo="/play"
      className="mn-body"
      rules={rules}
      menu={[
        { label: 'New game', onSelect: () => requestNew(game.size) },
        { label: chording ? 'Turn off number-tap clearing' : 'Turn on number-tap clearing', onSelect: () => commit({ ...stateRef.current, chording: !chording }) },
      ]}
    >
      {field.status === 'ready' && setup}

      <div className="mn-bar">
        <span className="mn-bar__item" aria-label={`${left} mines left`}>
          <MineGlyph className="mn-bar__icon" />
          <span className="mn-bar__value">{left}</span>
        </span>
        <span className="mn-bar__item mn-bar__item--time" aria-label={`Time ${formatTime(game.elapsed)}`}>
          <span className="mn-bar__value">{formatTime(game.elapsed)}</span>
        </span>
        <Button variant="quiet" size="sm" onClick={() => requestNew(game.size)} disabled={field.status === 'ready'}>New</Button>
      </div>

      <div
        className={`mn-board no-select is-${field.status}${flagMode ? ' is-flagmode' : ''}`}
        style={boardStyle}
        role="grid"
        aria-label="Mine field"
        aria-rowcount={field.rows}
        aria-colcount={field.cols}
        onKeyDown={onBoardKey}
      >
        {Array.from({ length: field.rows }, (_, r) => (
          <div role="row" key={r} className="mn-row">
            {Array.from({ length: field.cols }, (_, c) => {
              const i = r * field.cols + c;
              const st = field.cells[i];
              const mine = isMine[i] === 1;
              const showMine = field.status === 'lost' && mine && st !== FLAGGED;
              const wrongFlag = field.status === 'lost' && st === FLAGGED && !mine;
              const n = counts[i];
              let label: string;
              let content: ReactNode = null;
              let cls = 'mn-cell';
              if (showMine) {
                cls += ` is-mine${field.exploded === i ? ' is-exploded' : ''}`;
                label = field.exploded === i ? 'mine, hit' : 'mine';
                content = <MineGlyph className="mn-glyph" />;
              } else if (st === FLAGGED) {
                cls += wrongFlag ? ' is-flag is-wrong' : ' is-flag';
                label = wrongFlag ? 'flag, no mine here' : 'flagged';
                content = <FlagGlyph className="mn-glyph mn-glyph--flag" crossed={wrongFlag} />;
              } else if (st === REVEALED) {
                cls += ` is-open${n ? ` n${n}` : ''}`;
                label = n ? `${n}` : 'clear';
                content = n ? <span className="mn-num">{n}</span> : null;
              } else {
                cls += ' is-hidden';
                label = 'covered';
              }
              return (
                <div role="gridcell" key={c} className="mn-gridcell">
                  <button
                    ref={(el) => (cellRefs.current[i] = el)}
                    type="button"
                    className={cls}
                    tabIndex={i === cursor ? 0 : -1}
                    aria-label={`Row ${r + 1}, column ${c + 1}: ${label}`}
                    aria-disabled={over || undefined}
                    onPointerDown={(e) => onPointerDown(e, i)}
                    onPointerMove={onPointerMove}
                    onPointerUp={cancelPress}
                    onPointerCancel={cancelPress}
                    onPointerLeave={cancelPress}
                    onClick={() => onClick(i)}
                    onContextMenu={(e) => onContextMenu(e, i)}
                    onFocus={() => setCursor(i)}
                  >
                    {content}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <p className="mn-status meta" aria-live="polite">{status}</p>

      {over ? (
        <div className="end-card" ref={endRef} role="region" aria-label="Result">
          <p className="eyebrow">{field.status === 'won' ? (game.newBest ? 'New best' : 'Field cleared') : 'Mine hit'}</p>
          <h2 className="end-card__title display">{field.status === 'won' ? formatTime(game.elapsed) : 'Better luck next field'}</h2>
          <p className="muted">
            {field.status === 'won'
              ? game.newBest
                ? `Your fastest ${spec.label.toLowerCase()} field yet.`
                : `${spec.label} field, ${spec.mines} mines, all found.`
              : `${field.mines.filter((m) => field.cells[m] === FLAGGED).length} of ${spec.mines} mines were flagged.`}
          </p>
          {game.generation === 'fallback' && <p className="meta">This field couldn’t be checked for guess-free play in time, so it may have needed a guess.</p>}
          {setup}
          <div className="end-card__actions">
            <Button variant="primary" size="lg" onClick={() => startNew(state.size)}>New game</Button>
          </div>
        </div>
      ) : (
        <div className="mn-dock">
          {game.generation === 'fallback' && <p className="meta mn-dock__note">No guess-free layout found in time, so this one may need a guess.</p>}
          <div className="mn-mode" role="group" aria-label="Tap action">
            <button type="button" className="mn-mode__opt" aria-pressed={!flagMode} onClick={() => flagMode && toggleMode()}>
              <DigGlyph />
              <span>Uncover</span>
            </button>
            <button type="button" className="mn-mode__opt mn-mode__opt--flag" aria-pressed={flagMode} onClick={() => !flagMode && toggleMode()}>
              <FlagGlyph className="mn-mode__icon" />
              <span>Flag</span>
            </button>
          </div>
        </div>
      )}

      <Confirm
        open={confirm !== null}
        title="Start a new field?"
        message="This field and its time will be lost."
        confirmLabel="New game"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const c = confirm;
          setConfirm(null);
          if (c) startNew(c.size);
        }}
      />
    </GameScreen>
  );
}
