/**
 * Patience (Klondike solitaire) — pure rules, dealing, smart moves and a
 * bounded solver. No React in here.
 *
 * Cards are numbers 0..51: suit = floor(c / 13) (0 spades, 1 hearts,
 * 2 diamonds, 3 clubs), rank = c % 13 + 1 (1 = ace … 13 = king).
 */
import { createRng } from '../../../lib/rng';

export type Card = number;
export type DrawMode = 1 | 3;

export interface Column {
  /** Bottom (index 0) to top. The first `hidden` cards are face down. */
  cards: Card[];
  hidden: number;
}

export interface Board {
  tableau: Column[];
  /** Face-down stock; the top (next to draw) is the LAST element. */
  stock: Card[];
  /** Face-up waste; the playable top is the LAST element. */
  waste: Card[];
  /** Top rank on each suit's foundation (0 = empty, 13 = complete). */
  foundations: number[];
  draw: DrawMode;
}

export type Src =
  | { pile: 'waste' }
  | { pile: 'tableau'; col: number; index: number }
  | { pile: 'foundation'; suit: number };
export type Dst = { pile: 'tableau'; col: number } | { pile: 'foundation' };
export type Move = { t: 'draw' } | { t: 'recycle' } | { t: 'move'; from: Src; to: Dst };

// ---- cards ------------------------------------------------------------------

export const suitOf = (c: Card) => Math.floor(c / 13);
export const rankOf = (c: Card) => (c % 13) + 1;
export const cardOf = (suit: number, rank: number): Card => suit * 13 + rank - 1;
export const isRed = (c: Card) => {
  const s = suitOf(c);
  return s === 1 || s === 2;
};
export const SUIT_NAMES = ['spades', 'hearts', 'diamonds', 'clubs'] as const;
/** Text-presentation suit glyphs (U+FE0E keeps them out of emoji fonts). */
export const SUIT_GLYPHS = ['♠︎', '♥︎', '♦︎', '♣︎'] as const;
const RANK_LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_NAMES = ['', 'Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King'];
export const rankLabel = (r: number) => RANK_LABELS[r];
export const cardName = (c: Card) => `${RANK_NAMES[rankOf(c)]} of ${SUIT_NAMES[suitOf(c)]}`;

/** May `card` sit on `onto` in the tableau? Descending, alternating colour. */
export const canStack = (card: Card, onto: Card) => rankOf(onto) === rankOf(card) + 1 && isRed(onto) !== isRed(card);

// ---- dealing ----------------------------------------------------------------

export const fullDeck = (): Card[] => Array.from({ length: 52 }, (_, i) => i);

export function shuffledDeck(seed: number | string): Card[] {
  return createRng(seed).shuffle(fullDeck());
}

/** Standard Klondike deal: column i gets i + 1 cards, top one face up; the rest is the stock. */
export function deal(deck: Card[], draw: DrawMode): Board {
  if (deck.length !== 52 || new Set(deck).size !== 52) throw new Error('A deal needs 52 distinct cards');
  const tableau: Column[] = [];
  let p = 0;
  for (let i = 0; i < 7; i++) {
    tableau.push({ cards: deck.slice(p, p + i + 1), hidden: i });
    p += i + 1;
  }
  return { tableau, stock: deck.slice(p), waste: [], foundations: [0, 0, 0, 0], draw };
}

/** Every card on the board, for sanity checks. */
export function allCards(b: Board): Card[] {
  const out: Card[] = [...b.stock, ...b.waste];
  for (const col of b.tableau) out.push(...col.cards);
  b.foundations.forEach((top, s) => {
    for (let r = 1; r <= top; r++) out.push(cardOf(s, r));
  });
  return out;
}

// ---- reading the board ------------------------------------------------------

const top = <T,>(a: T[]): T | undefined => a[a.length - 1];

/** The cards a source would move (a face-up run for the tableau), or null. */
export function cardsAt(b: Board, src: Src): Card[] | null {
  if (src.pile === 'waste') {
    const c = top(b.waste);
    return c === undefined ? null : [c];
  }
  if (src.pile === 'foundation') {
    const r = b.foundations[src.suit];
    return r > 0 ? [cardOf(src.suit, r)] : null;
  }
  const col = b.tableau[src.col];
  if (!col || src.index < col.hidden || src.index >= col.cards.length) return null;
  const run = col.cards.slice(src.index);
  for (let i = 1; i < run.length; i++) if (!canStack(run[i], run[i - 1])) return null;
  return run;
}

export function canMove(b: Board, from: Src, to: Dst): boolean {
  const run = cardsAt(b, from);
  if (!run) return false;
  if (to.pile === 'foundation') {
    if (run.length !== 1 || from.pile === 'foundation') return false;
    const c = run[0];
    return b.foundations[suitOf(c)] === rankOf(c) - 1;
  }
  if (from.pile === 'tableau' && from.col === to.col) return false;
  const dest = b.tableau[to.col];
  if (!dest) return false;
  const onto = top(dest.cards);
  if (onto === undefined) return rankOf(run[0]) === 13;
  return canStack(run[0], onto);
}

function withColumn(t: Column[], i: number, col: Column): Column[] {
  const out = t.slice();
  out[i] = col;
  return out;
}

/** Apply a move. Returns the new board, or null if the move is illegal. */
export function applyMove(b: Board, m: Move): Board | null {
  if (m.t === 'draw') {
    if (b.stock.length === 0) return null;
    const n = Math.min(b.draw, b.stock.length);
    const drawn = b.stock.slice(b.stock.length - n).reverse();
    return { ...b, stock: b.stock.slice(0, b.stock.length - n), waste: [...b.waste, ...drawn] };
  }
  if (m.t === 'recycle') {
    if (b.stock.length > 0 || b.waste.length === 0) return null;
    return { ...b, stock: b.waste.slice().reverse(), waste: [] };
  }
  const { from, to } = m;
  if (!canMove(b, from, to)) return null;
  const run = cardsAt(b, from)!;
  let next: Board = { ...b };
  // Remove from the source.
  if (from.pile === 'waste') next.waste = b.waste.slice(0, -1);
  else if (from.pile === 'foundation') {
    next.foundations = b.foundations.slice();
    next.foundations[from.suit]--;
  } else {
    const col = b.tableau[from.col];
    const cards = col.cards.slice(0, from.index);
    // Auto-flip the newly exposed card.
    const hidden = cards.length > 0 && cards.length === col.hidden ? col.hidden - 1 : Math.min(col.hidden, cards.length);
    next.tableau = withColumn(b.tableau, from.col, { cards, hidden });
  }
  // Add to the destination.
  if (to.pile === 'foundation') {
    next.foundations = (next.foundations === b.foundations ? b.foundations.slice() : next.foundations);
    next.foundations[suitOf(run[0])] = rankOf(run[0]);
  } else {
    const t = next.tableau;
    const dest = t[to.col];
    next = { ...next, tableau: withColumn(t, to.col, { cards: [...dest.cards, ...run], hidden: dest.hidden }) };
  }
  return next;
}

export const isWon = (b: Board) => b.foundations.every((r) => r === 13);

/** Stock tap: draw, or turn the waste over when the stock is empty. */
export function stockMove(b: Board): Move | null {
  if (b.stock.length > 0) return { t: 'draw' };
  if (b.waste.length > 0) return { t: 'recycle' };
  return null;
}

// ---- smart (tap) moves ------------------------------------------------------

/**
 * Legal destinations for a tap, best first: the foundation (single cards
 * only), then columns it builds on (left to right), then one empty column
 * for a king. Moving a whole column into another empty column is pointless
 * and never offered.
 */
export function smartTargets(b: Board, src: Src): Dst[] {
  const run = cardsAt(b, src);
  if (!run) return [];
  const out: Dst[] = [];
  if (canMove(b, src, { pile: 'foundation' })) out.push({ pile: 'foundation' });
  const empties: Dst[] = [];
  for (let c = 0; c < 7; c++) {
    const to: Dst = { pile: 'tableau', col: c };
    if (!canMove(b, src, to)) continue;
    if (b.tableau[c].cards.length === 0) {
      const wholeColumn = src.pile === 'tableau' && src.index === 0;
      if (!wholeColumn && empties.length === 0) empties.push(to);
    } else out.push(to);
  }
  return [...out, ...empties];
}

// ---- auto-complete ----------------------------------------------------------

export const hiddenCount = (b: Board) => b.tableau.reduce((n, c) => n + c.hidden, 0);

/**
 * Auto-finish is offered once nothing is face down. With Draw 3 the stock
 * and waste must also be empty (cycling three at a time can stall).
 */
export const canAutoComplete = (b: Board) =>
  !isWon(b) && hiddenCount(b) === 0 && (b.draw === 1 || b.stock.length + b.waste.length === 0);

/** The next auto-finish step: a foundation move if any, else turn the stock. */
export function autoStep(b: Board): Move | null {
  if (isWon(b)) return null;
  let best: { m: Move; r: number } | null = null;
  const consider = (from: Src) => {
    const run = cardsAt(b, from);
    if (!run || run.length !== 1) return;
    const m: Move = { t: 'move', from, to: { pile: 'foundation' } };
    if (canMove(b, from, m.to) && (!best || rankOf(run[0]) < best.r)) best = { m, r: rankOf(run[0]) };
  };
  if (b.waste.length) consider({ pile: 'waste' });
  b.tableau.forEach((col, i) => {
    if (col.cards.length) consider({ pile: 'tableau', col: i, index: col.cards.length - 1 });
  });
  if (best) return (best as { m: Move }).m;
  return stockMove(b);
}

// ---- layout -----------------------------------------------------------------

/**
 * Vertical fan offsets for a tableau column so it fits in `avail` px.
 * Face-down cards squeeze first, then face-up ones, never below what keeps
 * the corner index readable. `height` is what the column then needs.
 */
export function fanLayout(hidden: number, up: number, cardH: number, avail: number) {
  const idealDown = Math.round(cardH * 0.13);
  const idealUp = Math.round(cardH * 0.31);
  const minDown = Math.max(3, Math.round(cardH * 0.06));
  const minUp = Math.max(13, Math.round(cardH * 0.22));
  const gaps = Math.max(0, up - 1);
  const need = (d: number, u: number) => cardH + hidden * d + gaps * u;
  let down = idealDown;
  let upOff = idealUp;
  if (need(down, upOff) > avail) {
    // Squeeze face-down cards first.
    down = hidden > 0 ? Math.max(minDown, Math.min(idealDown, (avail - cardH - gaps * upOff) / hidden)) : idealDown;
    if (need(down, upOff) > avail && gaps > 0) {
      upOff = Math.max(minUp, Math.min(idealUp, (avail - cardH - hidden * down) / gaps));
    }
  }
  down = Math.floor(down * 10) / 10;
  upOff = Math.floor(upOff * 10) / 10;
  return { down, up: upOff, height: Math.ceil(need(down, upOff)) };
}

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}

// ---- solver -----------------------------------------------------------------

export type SolveStatus = 'solved' | 'exhausted' | 'budget';
export interface SolveResult {
  status: SolveStatus;
  nodes: number;
  /** Replayable with applyMove when solved. */
  solution?: Move[];
}

function boardKey(b: Board): string {
  const cols = b.tableau.map((c) => String.fromCharCode(48 + c.hidden) + String.fromCharCode(...c.cards.map((x) => x + 60)));
  cols.sort();
  return `${cols.join('|')}/${String.fromCharCode(...b.stock.map((x) => x + 60))}/${String.fromCharCode(...b.waste.map((x) => x + 60))}/${b.foundations.join(',')}`;
}

/** Talon positions reachable by drawing (and turning over), each with the moves to get there. */
function talonPositions(b: Board): { board: Board; pre: Move[] }[] {
  const out: { board: Board; pre: Move[] }[] = [];
  const seen = new Set<string>();
  let stock = b.stock;
  let waste = b.waste;
  const pre: Move[] = [];
  let recycles = 0;
  for (let guard = 0; guard < 200; guard++) {
    if (waste.length) {
      const k = `${waste.length}:${stock.length}`;
      if (!seen.has(k)) {
        seen.add(k);
        out.push({ board: pre.length ? { ...b, stock, waste } : b, pre: pre.slice() });
      }
    }
    if (stock.length) {
      const n = Math.min(b.draw, stock.length);
      waste = [...waste, ...stock.slice(stock.length - n).reverse()];
      stock = stock.slice(0, stock.length - n);
      pre.push({ t: 'draw' });
    } else if (waste.length) {
      if (++recycles > 1) break;
      stock = waste.slice().reverse();
      waste = [];
      pre.push({ t: 'recycle' });
    } else break;
  }
  return out;
}

/** A foundation move that can never hurt: nothing could still need to sit on this card. */
function safeFoundationMove(b: Board): Move | null {
  const safe = (c: Card) => {
    const r = rankOf(c);
    if (b.foundations[suitOf(c)] !== r - 1) return false;
    if (r <= 2) return true;
    const red = isRed(c);
    return [0, 1, 2, 3].every((s) => (s === 1 || s === 2) === red || b.foundations[s] >= r - 1);
  };
  for (let i = 0; i < 7; i++) {
    const col = b.tableau[i];
    const c = top(col.cards);
    if (c !== undefined && safe(c)) return { t: 'move', from: { pile: 'tableau', col: i, index: col.cards.length - 1 }, to: { pile: 'foundation' } };
  }
  const w = top(b.waste);
  if (w !== undefined && safe(w)) return { t: 'move', from: { pile: 'waste' }, to: { pile: 'foundation' } };
  return null;
}

/** Candidate move sequences, most promising first. */
function candidates(b: Board): Move[][] {
  const found: Move[][] = [];
  const reveal: { seq: Move[]; score: number }[] = [];
  const talonToCol: Move[][] = [];
  const toEmpty: Move[][] = [];
  const partial: Move[][] = [];

  const emptyCol = b.tableau.findIndex((c) => c.cards.length === 0);
  const kingWaiting =
    b.tableau.some((c) => c.cards.slice(1).some((x, i) => i + 1 >= c.hidden && rankOf(x) === 13)) ||
    [...b.stock, ...b.waste].some((x) => rankOf(x) === 13);

  for (let i = 0; i < 7; i++) {
    const col = b.tableau[i];
    const n = col.cards.length;
    if (n === 0) continue;
    // Top card to foundation.
    const tm: Move = { t: 'move', from: { pile: 'tableau', col: i, index: n - 1 }, to: { pile: 'foundation' } };
    if (canMove(b, tm.from, tm.to)) found.push([tm]);
    // Whole face-up run (from the base) to another column.
    const base: Src = { pile: 'tableau', col: i, index: col.hidden };
    for (let j = 0; j < 7; j++) {
      if (j === i) continue;
      const to: Dst = { pile: 'tableau', col: j };
      if (!canMove(b, base, to)) continue;
      const destEmpty = b.tableau[j].cards.length === 0;
      if (destEmpty) {
        if (col.hidden > 0 && j === emptyCol) reveal.push({ seq: [{ t: 'move', from: base, to }], score: col.hidden - 0.5 });
      } else if (col.hidden > 0) reveal.push({ seq: [{ t: 'move', from: base, to }], score: col.hidden });
      else if (kingWaiting) toEmpty.push([{ t: 'move', from: base, to }]);
    }
    // Partial runs that free a card for the foundation.
    for (let k = col.hidden + 1; k < n; k++) {
      const under = col.cards[k - 1];
      if (b.foundations[suitOf(under)] !== rankOf(under) - 1) continue;
      const from: Src = { pile: 'tableau', col: i, index: k };
      for (let j = 0; j < 7; j++) {
        if (j === i || b.tableau[j].cards.length === 0) continue;
        if (canMove(b, from, { pile: 'tableau', col: j })) partial.push([{ t: 'move', from, to: { pile: 'tableau', col: j } }]);
      }
    }
  }
  // Talon cards, at every reachable position.
  for (const { board, pre } of talonPositions(b)) {
    const from: Src = { pile: 'waste' };
    if (canMove(board, from, { pile: 'foundation' })) found.push([...pre, { t: 'move', from, to: { pile: 'foundation' } }]);
    let emptyDone = false;
    for (let j = 0; j < 7; j++) {
      const to: Dst = { pile: 'tableau', col: j };
      if (!canMove(board, from, to)) continue;
      if (board.tableau[j].cards.length === 0) {
        if (emptyDone) continue;
        emptyDone = true;
      }
      talonToCol.push([...pre, { t: 'move', from, to }]);
    }
  }
  found.sort((a, c) => a.length - c.length);
  reveal.sort((a, c) => c.score - a.score);
  return [...found, ...reveal.map((r) => r.seq), ...talonToCol, ...partial, ...toEmpty];
}

class BudgetSpent extends Error {}

/**
 * Depth-first search with move ordering, safe auto-plays and visited-state
 * hashing, bounded by `budget` nodes. 'solved' comes with a replayable
 * solution. 'exhausted' means no win exists among the moves it considers
 * (it skips a few rarely-useful ones, so this isn't a proof for full deals).
 */
export function solve(start: Board, opts: { budget?: number } = {}): SolveResult {
  const budget = opts.budget ?? 20000;
  const visited = new Set<string>();
  const path: Move[] = [];
  let nodes = 0;

  const dfs = (b0: Board): boolean => {
    if (++nodes > budget) throw new BudgetSpent();
    let b = b0;
    const mark = path.length;
    for (let m = safeFoundationMove(b); m; m = safeFoundationMove(b)) {
      b = applyMove(b, m)!;
      path.push(m);
    }
    if (isWon(b)) return true;
    const key = boardKey(b);
    if (visited.has(key)) {
      path.length = mark;
      return false;
    }
    visited.add(key);
    for (const seq of candidates(b)) {
      let nb: Board | null = b;
      for (const m of seq) {
        nb = applyMove(nb, m);
        if (!nb) break;
      }
      if (!nb) continue;
      const before = path.length;
      path.push(...seq);
      if (dfs(nb)) return true;
      path.length = before;
    }
    path.length = mark;
    return false;
  };

  try {
    return dfs(start) ? { status: 'solved', nodes, solution: path.slice() } : { status: 'exhausted', nodes };
  } catch (e) {
    if (e instanceof BudgetSpent) return { status: 'budget', nodes: budget };
    throw e;
  }
}

// ---- deal generation --------------------------------------------------------

export interface DealResult {
  board: Board;
  /** Which shuffle of this seed was used. */
  attempt: number;
  /** True only when the solver actually found a win for this deal. */
  verified: boolean;
}

export const dealFor = (seed: number, attempt: number, draw: DrawMode) => deal(shuffledDeck(`patience:${seed}:${attempt}`), draw);

/**
 * Deal for a seed. With `winnable`, try successive shuffles until the solver
 * finds a win, within a per-deal node budget and an overall time cap. If none
 * is verified in time, fall back to the first shuffle (verified: false).
 */
export function generateDeal(
  seed: number,
  draw: DrawMode,
  winnable: boolean,
  opts: { budget?: number; maxAttempts?: number; maxMs?: number; now?: () => number } = {},
): DealResult {
  const first = dealFor(seed, 0, draw);
  if (!winnable) return { board: first, attempt: 0, verified: false };
  const now = opts.now ?? (() => Date.now());
  const maxAttempts = opts.maxAttempts ?? 40;
  const maxMs = opts.maxMs ?? 1500;
  const t0 = now();
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const board = attempt === 0 ? first : dealFor(seed, attempt, draw);
    if (solve(board, { budget: opts.budget ?? DEFAULT_BUDGET[draw] }).status === 'solved') return { board, attempt, verified: true };
    if (now() - t0 > maxMs) break;
  }
  return { board: first, attempt: 0, verified: false };
}

export const DEFAULT_BUDGET: Record<DrawMode, number> = { 1: 3000, 3: 3000 };
