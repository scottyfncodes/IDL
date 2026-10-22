import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { usePersistentState } from '../../../lib/storage';
import { freshSeed } from '../../../lib/rng';
import { recordRoomResult } from '../../../room/stats';
import { GameScreen } from '../../../ui/GameScreen';
import { Button } from '../../../ui/Button';
import { Confirm } from '../../../ui/Confirm';
import { Segmented } from '../../../ui/Segmented';
import { useToast } from '../../../ui/Toast';
import { IconRefresh, IconShuffle, IconUndo, IconCheck } from '../../../ui/icons';
import {
  SUIT_GLYPHS,
  SUIT_NAMES,
  applyMove,
  autoStep,
  canAutoComplete,
  canMove,
  cardName,
  cardOf,
  cardsAt,
  fanLayout,
  formatTime,
  generateDeal,
  isRed,
  isWon,
  rankLabel,
  rankOf,
  smartTargets,
  stockMove,
  suitOf,
  type Board,
  type Card,
  type DealResult,
  type Dst,
  type DrawMode,
  type Move,
  type Src,
} from './logic';
import './styles.css';

interface Snap {
  b: Board;
  m: number;
}

export interface Game {
  seed: number;
  attempt: number;
  /** The solver found a win for this deal before it was dealt. */
  verified: boolean;
  board: Board;
  history: Snap[];
  moves: number;
  elapsed: number; // ms
  won: boolean;
  recorded: boolean;
  newBest: boolean;
}

export interface State {
  draw: DrawMode;
  winnable: boolean;
  game: Game | null;
}

export const STORAGE_KEY = 'room:patience';
export const STORAGE_VERSION = 1;
const HISTORY_CAP = 250;
const LONG_PRESS_MS = 420;
const DRAG_SLOP = 8;

const initial = (): State => ({ draw: 1, winnable: true, game: null });

export function newGame(seed: number, d: DealResult): Game {
  return { seed, attempt: d.attempt, verified: d.verified, board: d.board, history: [], moves: 0, elapsed: 0, won: false, recorded: false, newBest: false };
}

/** Seal a finished game: record it exactly once. */
function settle(g: Game): Game {
  if (!isWon(g.board) || g.recorded) return g;
  const secs = Math.max(1, Math.round(g.elapsed / 1000));
  const best = recordRoomResult('patience', {
    outcome: 'win',
    score: { variant: `draw${g.board.draw}`, value: secs, better: 'lower', label: formatTime(secs * 1000) },
  });
  return { ...g, won: true, recorded: true, newBest: best };
}

const srcKey = (s: Src) => (s.pile === 'waste' ? 'w' : s.pile === 'foundation' ? `f${s.suit}` : `t${s.col}:${s.index}`);
function parseSrc(k: string | undefined): Src | null {
  if (!k) return null;
  if (k === 'w') return { pile: 'waste' };
  if (k[0] === 'f') return { pile: 'foundation', suit: Number(k.slice(1)) };
  const [c, i] = k.slice(1).split(':').map(Number);
  return { pile: 'tableau', col: c, index: i };
}
function parseDst(k: string | undefined): Dst | null {
  if (!k) return null;
  if (k === 'f') return { pile: 'foundation' };
  if (k[0] === 't') return { pile: 'tableau', col: Number(k.slice(1)) };
  return null;
}
/** Where a tap on this source would put a selected card. */
const dstOf = (s: Src): Dst | null => (s.pile === 'tableau' ? { pile: 'tableau', col: s.col } : s.pile === 'foundation' ? { pile: 'foundation' } : null);
const sameSrc = (a: Src | null, b: Src | null) => !!a && !!b && srcKey(a) === srcKey(b);
const dstName = (d: Dst) => (d.pile === 'foundation' ? 'its foundation' : `column ${d.col + 1}`);

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function CardFace({ card }: { card: Card }) {
  const r = rankOf(card);
  const glyph = SUIT_GLYPHS[suitOf(card)];
  return (
    <span className={`pt-face ${isRed(card) ? 'is-red' : 'is-black'}`} aria-hidden="true">
      <span className="pt-corner">
        <span className="pt-rank">{rankLabel(r)}</span>
        <span className="pt-suit">{glyph}</span>
      </span>
      <span className={`pt-pip${r > 10 ? ' is-court' : ''}`}>{r > 10 ? rankLabel(r) : glyph}</span>
      {r > 10 && <span className="pt-pip-suit">{glyph}</span>}
    </span>
  );
}

interface Dims {
  w: number;
  h: number;
  gap: number;
  avail: number;
}

interface DragState {
  src: Src;
  cards: Card[];
  offX: number;
  offY: number;
  x: number;
  y: number;
  upOff: number;
}

export default function Patience() {
  const [state, setState] = usePersistentState<State>(STORAGE_KEY, initial, STORAGE_VERSION);
  const [dealing, setDealing] = useState(false);
  const [confirm, setConfirm] = useState<null | { draw: DrawMode }>(null);
  const [selected, setSelected] = useState<Src | null>(null);
  const [shake, setShake] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [autoRun, setAutoRun] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [dims, setDims] = useState<Dims>({ w: 48, h: 69, gap: 4, avail: 380 });
  const toast = useToast();

  const playRef = useRef<HTMLDivElement>(null);
  const tableauRef = useRef<HTMLDivElement>(null);
  const toolsRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const lastSmart = useRef<{ card: Card; src: Src; k: number; histLen: number } | null>(null);
  const pointer = useRef<{ id: number; src: Src; x: number; y: number; rect: DOMRect; timer: number; dragging: boolean; upOff: number } | null>(null);
  const suppressClick = useRef(0);
  const focusCard = useRef<Card | null>(null);
  const endRef = useRef<HTMLButtonElement>(null);

  const { game } = state;
  const board = game?.board ?? null;
  const inProgress = !!game && !game.won && game.moves > 0;

  // ---- dealing -------------------------------------------------------------
  const startDeal = useCallback(
    (draw: DrawMode, winnable: boolean) => {
      setDealing(true);
      setSelected(null);
      setAutoRun(false);
      setCelebrate(false);
      lastSmart.current = null;
      window.setTimeout(() => {
        const seed = freshSeed();
        const d = generateDeal(seed, draw, winnable);
        setState((s) => ({ ...s, draw, winnable, game: newGame(seed, d) }));
        setDealing(false);
      }, 40);
    },
    [setState],
  );

  useEffect(() => {
    if (!state.game && !dealing) startDeal(state.draw, state.winnable);
    // Only on first arrival with nothing saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- timer ---------------------------------------------------------------
  const running = !!game && !game.won && game.moves > 0 && !dealing;
  useEffect(() => {
    if (!running) return;
    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      const delta = Math.min(now - last, 2000);
      last = now;
      if (document.visibilityState === 'hidden') return;
      setState((s) => (s.game && !s.game.won ? { ...s, game: { ...s.game, elapsed: s.game.elapsed + delta } } : s));
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, setState]);

  // ---- moves ---------------------------------------------------------------
  /** Apply a move; returns whether it happened. `replaceLast` swaps the last move instead of adding one. */
  const play = useCallback(
    (m: Move, opts: { replaceLast?: boolean } = {}): boolean => {
      let ok = false;
      setState((s) => {
        const g = s.game;
        if (!g || g.won) return s;
        if (opts.replaceLast) {
          const prev = g.history[g.history.length - 1];
          const nb = prev && applyMove(prev.b, m);
          if (!nb) return s;
          ok = true;
          return { ...s, game: settle({ ...g, board: nb }) };
        }
        const nb = applyMove(g.board, m);
        if (!nb) return s;
        ok = true;
        const history = [...g.history, { b: g.board, m: g.moves }].slice(-HISTORY_CAP);
        return { ...s, game: settle({ ...g, board: nb, moves: g.moves + 1, history }) };
      });
      if (ok) setSelected(null);
      return ok;
    },
    [setState],
  );

  const undo = useCallback(() => {
    setAutoRun(false);
    setSelected(null);
    lastSmart.current = null;
    setState((s) => {
      const g = s.game;
      if (!g || g.won || g.history.length === 0) return s;
      const prev = g.history[g.history.length - 1];
      return { ...s, game: { ...g, board: prev.b, moves: prev.m, history: g.history.slice(0, -1) } };
    });
    setAnnounce('Undone');
  }, [setState]);

  const nope = (key: string, msg: string) => {
    setShake(key);
    setAnnounce(msg);
  };

  const drawFromStock = () => {
    if (!board || game?.won) return;
    lastSmart.current = null;
    setSelected(null);
    const m = stockMove(board);
    if (!m) return;
    if (play(m)) setAnnounce(m.t === 'draw' ? 'Drew from the stock' : 'Turned the waste over');
  };

  /** Move a selected (or dragged) source to a destination. */
  const moveTo = (from: Src, to: Dst, card: Card) => {
    if (!board) return false;
    lastSmart.current = null;
    if (!canMove(board, from, to)) {
      setSelected(null);
      nope(`c${card}`, `${cardName(card)} can’t go to ${dstName(to)}`);
      return false;
    }
    play({ t: 'move', from, to });
    setAnnounce(`${cardName(card)} to ${dstName(to)}`);
    return true;
  };

  /** Tap on a face-up card: smart move, cycling through alternatives on repeat taps. */
  const tapCard = (src: Src) => {
    if (!board || !game || game.won) return;
    const run = cardsAt(board, src);
    if (!run) return;
    const card = run[0];
    if (selected) {
      if (sameSrc(selected, src)) {
        setSelected(null);
        setAnnounce('Put down');
        return;
      }
      const sel = cardsAt(board, selected);
      const to = dstOf(src);
      if (sel && to) {
        moveTo(selected, to, sel[0]);
        return;
      }
      setSelected(null);
    }
    focusCard.current = card;
    const ls = lastSmart.current;
    if (ls && ls.card === card && ls.histLen === game.history.length && game.history.length > 0) {
      const prev = game.history[game.history.length - 1].b;
      const targets = smartTargets(prev, ls.src);
      if (targets.length > 1) {
        const k = (ls.k + 1) % targets.length;
        if (play({ t: 'move', from: ls.src, to: targets[k] }, { replaceLast: true })) {
          lastSmart.current = { ...ls, k };
          setAnnounce(`${cardName(card)} to ${dstName(targets[k])}`);
        }
        return;
      }
    }
    const targets = smartTargets(board, src);
    if (targets.length === 0) {
      lastSmart.current = null;
      nope(`c${card}`, `No move for ${cardName(card)}`);
      return;
    }
    if (play({ t: 'move', from: src, to: targets[0] })) {
      lastSmart.current = { card, src, k: 0, histLen: Math.min(game.history.length + 1, HISTORY_CAP) };
      setAnnounce(`${cardName(card)} to ${dstName(targets[0])}`);
    }
  };

  /** Tap on an empty column or foundation slot. */
  const tapSlot = (to: Dst) => {
    if (!board || !selected) return;
    const sel = cardsAt(board, selected);
    if (sel) moveTo(selected, to, sel[0]);
  };

  const pickUp = (src: Src) => {
    if (!board || game?.won) return;
    const run = cardsAt(board, src);
    if (!run) return;
    if (sameSrc(selected, src)) {
      setSelected(null);
      setAnnounce('Put down');
      return;
    }
    setSelected(src);
    setAnnounce(`Picked up ${cardName(run[0])}${run.length > 1 ? ` and ${run.length - 1} more` : ''}. Choose where it goes.`);
  };

  // ---- auto-finish -----------------------------------------------------------
  useEffect(() => {
    if (!autoRun) return;
    if (!board || isWon(board)) {
      setAutoRun(false);
      return;
    }
    const id = window.setTimeout(
      () => {
        const m = autoStep(board);
        if (!m || !play(m)) setAutoRun(false);
      },
      reducedMotion() ? 0 : 70,
    );
    return () => window.clearTimeout(id);
  }, [autoRun, board, play]);

  // ---- celebration -----------------------------------------------------------
  // Only a win that happens now gets the cascade, not a finished game reopened.
  const wasWon = useRef(game?.won ?? false);
  const justWon = !!game?.won && !wasWon.current;
  useEffect(() => {
    wasWon.current = !!game?.won;
    if (!justWon) return;
    setAnnounce(`Every card home in ${formatTime(game!.elapsed)}.`);
    if (!reducedMotion()) setCelebrate(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justWon]);
  useEffect(() => {
    if (!celebrate) return;
    const id = window.setTimeout(() => setCelebrate(false), 2000);
    return () => window.clearTimeout(id);
  }, [celebrate]);
  useEffect(() => {
    if (game?.won && !celebrate) endRef.current?.focus({ preventScroll: true });
  }, [game?.won, celebrate]);

  // ---- shake reset & focus follow -------------------------------------------
  useEffect(() => {
    if (!shake) return;
    const id = window.setTimeout(() => setShake(null), 380);
    return () => window.clearTimeout(id);
  }, [shake]);
  useEffect(() => {
    const c = focusCard.current;
    if (c === null) return;
    focusCard.current = null;
    // Keyboard players keep focus on the card they just moved.
    const active = document.activeElement as HTMLElement | null;
    if (active && active !== document.body && !active.dataset?.card) return;
    if (active?.dataset?.card === String(c)) return;
    playRef.current?.querySelector<HTMLElement>(`[data-card="${c}"]`)?.focus({ preventScroll: true });
  }, [board]);

  // ---- measuring -------------------------------------------------------------
  const hasBoard = !!board && !game?.won;
  useLayoutEffect(() => {
    const measure = () => {
      const el = playRef.current;
      if (!el) return;
      const W = el.clientWidth;
      if (!W) return;
      const gap = W < 420 ? 4 : 8;
      const w = Math.min(84, Math.floor((W - 6 * gap) / 7));
      const h = Math.round(w / 0.7);
      let avail = h * 4;
      const tab = tableauRef.current;
      if (tab) {
        const top = tab.getBoundingClientRect().top + window.scrollY;
        const toolsH = toolsRef.current?.offsetHeight ?? 48;
        avail = Math.floor(window.innerHeight - top - toolsH - 24);
      }
      avail = Math.max(avail, Math.round(h * 2.6));
      setDims((d) => (d.w === w && d.h === h && d.gap === gap && d.avail === avail ? d : { w, h, gap, avail }));
    };
    measure();
    window.addEventListener('resize', measure);
    const ro = typeof ResizeObserver !== 'undefined' && playRef.current ? new ResizeObserver(measure) : null;
    if (ro && playRef.current) ro.observe(playRef.current);
    return () => {
      window.removeEventListener('resize', measure);
      ro?.disconnect();
    };
  }, [hasBoard, dims.h]);

  // ---- pointer: tap, long-press to pick up, drag and drop ----------------------
  const endPointer = () => {
    const p = pointer.current;
    if (p) window.clearTimeout(p.timer);
    pointer.current = null;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    // A fresh press: whatever the last drag or hold suppressed is over.
    suppressClick.current = 0;
    if (!board || game?.won || autoRun || e.button > 0) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('[data-src]');
    const src = parseSrc(el?.dataset.src);
    if (!el || !src || !cardsAt(board, src)) return;
    const timer = window.setTimeout(() => {
      const p = pointer.current;
      if (!p || p.dragging) return;
      suppressClick.current = Date.now() + 600;
      pickUp(p.src);
      navigator.vibrate?.(8);
    }, LONG_PRESS_MS);
    pointer.current = { id: e.pointerId, src, x: e.clientX, y: e.clientY, rect: el.getBoundingClientRect(), timer, dragging: false, upOff: Number(el.dataset.up ?? 0) };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId || !board) return;
    if (!p.dragging) {
      if (Math.hypot(e.clientX - p.x, e.clientY - p.y) < DRAG_SLOP) return;
      const cards = cardsAt(board, p.src);
      if (!cards) return endPointer();
      window.clearTimeout(p.timer);
      p.dragging = true;
      try {
        playRef.current?.setPointerCapture?.(e.pointerId);
      } catch {
        /* ignore */
      }
      setSelected(null);
      lastSmart.current = null;
      setDrag({ src: p.src, cards, offX: p.x - p.rect.left, offY: p.y - p.rect.top, x: e.clientX, y: e.clientY, upOff: p.upOff || Math.round(dims.h * 0.31) });
    }
    const g = ghostRef.current;
    const offX = p.x - p.rect.left;
    const offY = p.y - p.rect.top;
    if (g) g.style.transform = `translate3d(${e.clientX - offX}px, ${e.clientY - offY}px, 0)`;
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    endPointer();
    if (!p.dragging) return; // a plain tap: the click handler takes it
    suppressClick.current = Date.now() + 400;
    setDrag(null);
    const hit = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    let to = parseDst(hit?.closest<HTMLElement>('[data-drop]')?.dataset.drop);
    // Between columns: take the nearest column under the finger.
    const tab = tableauRef.current?.getBoundingClientRect();
    if (!to && tab && e.clientY >= tab.top && e.clientX >= tab.left && e.clientX <= tab.right) {
      to = { pile: 'tableau', col: Math.max(0, Math.min(6, Math.floor(((e.clientX - tab.left) / tab.width) * 7))) };
    }
    const cards = board && cardsAt(board, p.src);
    if (!to || !cards) return;
    if (p.src.pile === 'tableau' && to.pile === 'tableau' && to.col === p.src.col) return;
    if (p.src.pile === 'foundation' && to.pile === 'foundation') return;
    moveTo(p.src, to, cards[0]);
  };

  const onPointerCancel = () => {
    endPointer();
    setDrag(null);
  };

  // While a press may become a drag, keep the page from scrolling under it.
  useEffect(() => {
    const el = playRef.current;
    if (!el) return;
    const onTouchMove = (ev: TouchEvent) => {
      if (pointer.current) ev.preventDefault();
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', onTouchMove);
  }, [hasBoard]);

  const onCardClick = (src: Src) => {
    if (Date.now() < suppressClick.current) return;
    if (autoRun) return;
    tapCard(src);
  };

  const onCardKey = (e: ReactKeyboardEvent<HTMLElement>, src: Src | null, slot: Dst | null) => {
    if (e.key === ' ') {
      e.preventDefault();
      if (selected && (slot || (src && !sameSrc(src, selected)))) {
        const sel = cardsAt(board!, selected);
        const to = slot ?? (src ? dstOf(src) : null);
        if (sel && to) moveTo(selected, to, sel[0]);
        else setSelected(null);
      } else if (src) pickUp(src);
    } else if (e.key === 'Escape' && selected) {
      e.preventDefault();
      setSelected(null);
      setAnnounce('Put down');
    }
  };

  // Global shortcuts.
  useEffect(() => {
    if (!game || game.won) return;
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
      if (e.key === 'u' || e.key === 'U') undo();
      else if (e.key === 'd' || e.key === 'D') document.querySelector<HTMLButtonElement>('.pt-stock')?.click();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [game, undo]);

  // ---- menu actions ------------------------------------------------------------
  const requestDeal = (draw: DrawMode) => {
    if (inProgress) setConfirm({ draw });
    else startDeal(draw, state.winnable);
  };
  const toggleWinnable = () => {
    const next = !state.winnable;
    setState((s) => ({ ...s, winnable: next }));
    toast.show(next ? 'Next deal: checked winnable first' : 'Next deal: any shuffle');
  };

  // ---- render --------------------------------------------------------------------
  const draw = game?.board.draw ?? state.draw;
  const rules = (
    <>
      <p>Bring all fifty-two cards home to the four foundations, building each suit up from ace to king.</p>
      <ul>
        <li>In the seven columns, build down in alternating colours: a red six on a black seven. Move any face-up run as one.</li>
        <li>Only a king, or a run headed by one, can fill an empty column. Face-down cards turn over when they’re uncovered.</li>
        <li>Tap the stock to turn {draw === 1 ? 'one card' : 'three cards'}. When it runs out, tap again to turn the waste over, as often as you like.</li>
        <li><strong>Tap a card</strong> to send it to its best spot; tap again to try the next spot. <strong>Drag</strong> for a precise move, or <strong>press and hold</strong> to pick a card up, then tap where it goes.</li>
        <li>With <strong>winnable deals</strong> on, idl solves each deal on your phone before dealing it. If none checks out in time, you get an ordinary shuffle and the label says so.</li>
        <li>Keyboard: Tab to a card and press Enter to move it, Space to pick it up and put it down. U undoes, D draws.</li>
      </ul>
    </>
  );

  const kicker = game ? `Draw ${draw} · ${game.verified ? 'winnable deal' : state.winnable ? 'random deal' : 'any shuffle'}` : `Draw ${state.draw}`;

  const { w, h, gap, avail } = dims;
  const layouts = board ? board.tableau.map((c) => fanLayout(c.hidden, c.cards.length - c.hidden, h, avail)) : [];
  const tableauH = Math.max(avail, ...layouts.map((l) => l.height));
  const lifted = (k: string) => {
    if (!drag) return false;
    if (drag.src.pile !== 'tableau') return srcKey(drag.src) === k;
    const s = parseSrc(k);
    return s?.pile === 'tableau' && s.col === drag.src.col && s.index >= drag.src.index;
  };
  const isSelected = (s: Src) => {
    if (!selected) return false;
    if (selected.pile !== 'tableau' || s.pile !== 'tableau') return sameSrc(selected, s);
    return s.col === selected.col && s.index >= selected.index;
  };

  const faceButton = (card: Card, src: Src, label: string, style?: CSSProperties, extra?: { up?: number; className?: string }) => {
    const k = srcKey(src);
    const cls = ['pt-card', 'is-up', extra?.className, isSelected(src) && 'is-selected', lifted(k) && 'is-lifted', shake === `c${card}` && 'anim-shake']
      .filter(Boolean)
      .join(' ');
    return (
      <button
        key={card}
        type="button"
        className={cls}
        style={style}
        data-card={card}
        data-src={k}
        data-up={extra?.up}
        aria-label={label}
        aria-pressed={selected ? isSelected(src) : undefined}
        onClick={() => onCardClick(src)}
        onKeyDown={(e) => onCardKey(e, src, null)}
        onKeyUp={(e) => e.key === ' ' && e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
      >
        <CardFace card={card} />
      </button>
    );
  };

  const wasteShown = board ? board.waste.slice(-(board.draw === 3 ? 3 : 1)) : [];
  const autoOk = !!board && canAutoComplete(board) && !autoRun;

  return (
    <GameScreen
      title="Patience"
      kicker={kicker}
      backTo="/play"
      className="pt-body"
      rules={rules}
      menu={[
        { label: 'New deal', onSelect: () => requestDeal(state.draw), disabled: dealing },
        { label: draw === 1 ? 'Switch to Draw 3' : 'Switch to Draw 1', onSelect: () => requestDeal(draw === 1 ? 3 : 1), disabled: dealing },
        { label: state.winnable ? 'Winnable deals: on (turn off)' : 'Winnable deals: off (turn on)', onSelect: toggleWinnable },
      ]}
    >
      {!game || dealing ? (
        <div className="pt-dealing panel" aria-live="polite">
          <div className="pt-dealing__fan" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((i) => <span key={i} className="pt-card pt-back" style={{ animationDelay: `${i * 90}ms` }} />)}
          </div>
          <p className="display pt-dealing__title">Shuffling…</p>
          <p className="meta">{state.winnable ? 'Checking the deal can be won' : 'Any shuffle'}</p>
        </div>
      ) : (
        <>
          <div className="pt-stats">
            <span><span className="pt-stats__label">Moves</span> <span className="pt-stats__value">{game.moves}</span></span>
            <span><span className="pt-stats__label">Time</span> <span className="pt-stats__value">{formatTime(game.elapsed)}</span></span>
          </div>

          <div
            ref={playRef}
            className={`pt-play no-select${drag ? ' no-touch-scroll is-dragging' : ''}`}
            style={{ ['--pt-w' as string]: `${w}px`, ['--pt-h' as string]: `${h}px`, ['--pt-gap' as string]: `${gap}px` }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerCancel}
          >
            <div className="pt-top">
              <button
                type="button"
                className={`pt-slot pt-stock${board!.stock.length ? ' has-cards' : ''}`}
                onClick={drawFromStock}
                disabled={game.won || autoRun || (!board!.stock.length && !board!.waste.length)}
                aria-label={
                  board!.stock.length
                    ? `Stock, ${board!.stock.length} cards. Draw ${draw}`
                    : board!.waste.length
                      ? 'Stock empty. Turn the waste over'
                      : 'Stock empty'
                }
              >
                {board!.stock.length ? (
                  <span className="pt-card pt-back" aria-hidden="true">
                    <span className="pt-count">{board!.stock.length}</span>
                  </span>
                ) : board!.waste.length ? (
                  <IconRefresh size={22} />
                ) : null}
              </button>
              <div className="pt-waste" aria-label={board!.waste.length ? `Waste, ${board!.waste.length} cards` : 'Waste, empty'} role="group">
                {wasteShown.map((c, i) => {
                  const isTop = i === wasteShown.length - 1;
                  const style = { left: `calc(${i} * var(--pt-w) * 0.4)` };
                  return isTop ? (
                    faceButton(c, { pile: 'waste' }, `${cardName(c)}, top of the waste`, style)
                  ) : (
                    <span key={c} className="pt-card is-up is-under" style={style} aria-hidden="true">
                      <CardFace card={c} />
                    </span>
                  );
                })}
              </div>
              {[0, 1, 2, 3].map((s) => {
                const r = board!.foundations[s];
                return (
                  <div
                    key={s}
                    className={`pt-slot pt-foundation${selected ? ' is-target' : ''}`}
                    data-drop="f"
                    role="group"
                    aria-label={`${SUIT_NAMES[s]} foundation${r ? `, up to ${rankLabel(r)}` : ', empty'}`}
                  >
                    {r > 0 ? (
                      faceButton(cardOf(s, r), { pile: 'foundation', suit: s }, `${cardName(cardOf(s, r))}, on its foundation`)
                    ) : (
                      <button
                        type="button"
                        className="pt-empty"
                        aria-label={`Empty ${SUIT_NAMES[s]} foundation`}
                        tabIndex={selected ? 0 : -1}
                        onClick={() => tapSlot({ pile: 'foundation' })}
                        onKeyDown={(e) => onCardKey(e, null, { pile: 'foundation' })}
                      >
                        <span className={`pt-ghost ${s === 1 || s === 2 ? 'is-red' : ''}`} aria-hidden="true">{SUIT_GLYPHS[s]}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {game.won ? (
              <div className="end-card pt-end">
                <p className="eyebrow">{game.newBest ? 'New best' : `Draw ${draw}`}</p>
                <p className="end-card__title display">Every card home</p>
                <dl className="pt-endstats">
                  <div><dt>Time</dt><dd>{formatTime(game.elapsed)}</dd></div>
                  <div><dt>Moves</dt><dd>{game.moves}</dd></div>
                </dl>
                <Segmented
                  label="Next deal"
                  options={[{ value: '1', label: 'Draw 1' }, { value: '3', label: 'Draw 3' }]}
                  value={String(state.draw) as '1' | '3'}
                  onChange={(v) => setState((s) => ({ ...s, draw: Number(v) as DrawMode }))}
                />
                <div className="end-card__actions">
                  <Button ref={endRef} variant="primary" size="lg" onClick={() => startDeal(state.draw, state.winnable)}>
                    New deal
                  </Button>
                </div>
              </div>
            ) : (
              <div ref={tableauRef} className="pt-tableau" style={{ height: tableauH }}>
                {board!.tableau.map((col, ci) => {
                  const l = layouts[ci];
                  const upCount = col.cards.length - col.hidden;
                  return (
                    <div
                      key={ci}
                      className={`pt-col${selected ? ' is-target' : ''}`}
                      data-drop={`t${ci}`}
                      role="group"
                      aria-label={`Column ${ci + 1}${col.cards.length === 0 ? ', empty' : col.hidden ? `, ${col.hidden} face down` : ''}`}
                    >
                      {col.cards.length === 0 && (
                        <button
                          type="button"
                          className="pt-empty pt-empty--col"
                          aria-label={`Empty column ${ci + 1}`}
                          tabIndex={selected ? 0 : -1}
                          onClick={() => tapSlot({ pile: 'tableau', col: ci })}
                          onKeyDown={(e) => onCardKey(e, null, { pile: 'tableau', col: ci })}
                        >
                          <span aria-hidden="true">K</span>
                        </button>
                      )}
                      {col.cards.map((c, i) => {
                        const top = i < col.hidden ? i * l.down : col.hidden * l.down + (i - col.hidden) * l.up;
                        const style = { top: `${top}px`, zIndex: i + 1 };
                        if (i < col.hidden) return <span key={c} className="pt-card pt-back is-down" style={style} aria-hidden="true" />;
                        const k = i - col.hidden;
                        const label = `${cardName(c)}, column ${ci + 1}${i === col.cards.length - 1 ? '' : `, ${col.cards.length - 1 - i} on top`}`;
                        return faceButton(c, { pile: 'tableau', col: ci, index: i }, label, style, { up: upCount > 1 ? l.up : undefined, className: k === 0 ? undefined : 'is-fanned' });
                      })}
                    </div>
                  );
                })}
              </div>
            )}

            {celebrate && (
              <div className="pt-cascade" aria-hidden="true">
                <div className="pt-cascade-row">
                  {[0, 1, 2, 3, 4, 5, 6].map((cell) => (
                    <div key={cell} className="pt-col">
                      {cell >= 3 &&
                        [13, 12, 11, 10].map((r, i) => {
                          const s = cell - 3;
                          const dx = (s - 1.5) * 28 + (((r * 37 + s * 11) % 24) - 12);
                          return (
                            <span
                              key={r}
                              className="pt-card is-up pt-fall"
                              style={{
                                zIndex: 10 - i,
                                animationDelay: `${i * 160 + s * 60}ms`,
                                ['--dx' as string]: `${dx}px`,
                                ['--rot' as string]: `${dx * 0.5}deg`,
                              }}
                            >
                              <CardFace card={cardOf(s, r)} />
                            </span>
                          );
                        })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {drag && (
              <div
                ref={ghostRef}
                className="pt-ghost-stack"
                style={{ transform: `translate3d(${drag.x - drag.offX}px, ${drag.y - drag.offY}px, 0)` }}
                aria-hidden="true"
              >
                {drag.cards.map((c, i) => (
                  <span key={c} className="pt-card is-up" style={{ top: `${i * drag.upOff}px` }}>
                    <CardFace card={c} />
                  </span>
                ))}
              </div>
            )}
          </div>

          {!game.won && (
            <div ref={toolsRef} className="pt-tools">
              <button type="button" className="pt-tool" onClick={undo} disabled={game.history.length === 0 || autoRun}>
                <IconUndo size={20} />
                <span>Undo</span>
              </button>
              <button type="button" className={`pt-tool${autoOk ? ' is-ready' : ''}`} onClick={() => setAutoRun(true)} disabled={!autoOk}>
                <IconCheck size={20} />
                <span>{autoRun ? 'Finishing…' : 'Auto-finish'}</span>
              </button>
              <button type="button" className="pt-tool" onClick={() => requestDeal(state.draw)} disabled={autoRun}>
                <IconShuffle size={20} />
                <span>New deal</span>
              </button>
            </div>
          )}
        </>
      )}

      <p className="visually-hidden" aria-live="polite">{announce}</p>

      <Confirm
        open={confirm !== null}
        title="Deal again?"
        message={confirm && confirm.draw !== draw ? `This game ends and a fresh Draw ${confirm.draw} deal begins.` : 'This game ends and a fresh deal begins.'}
        confirmLabel="New deal"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const c = confirm;
          setConfirm(null);
          if (c) startDeal(c.draw, state.winnable);
        }}
      />
    </GameScreen>
  );
}
