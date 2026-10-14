import { MOTIFS } from './content';
import {
  SIZES,
  canFlip,
  deal,
  flip,
  formatTime,
  isBetter,
  isFaceUp,
  isOver,
  isPending,
  newMatch,
  pairsFor,
  pairsFound,
  settle,
  winner,
  type MatchState,
  type SizeId,
} from './logic';

/** Index of the other card with the same motif. */
const partner = (s: MatchState, i: number) => s.deck.findIndex((m, j) => j !== i && m === s.deck[i]);
/** Some card that does NOT match card i and is still in play. */
const stranger = (s: MatchState, i: number) => s.deck.findIndex((m, j) => j !== i && m !== s.deck[i] && s.matchedBy[j] === null);

function solveAll(s: MatchState): MatchState {
  for (let i = 0; i < s.deck.length; i++) {
    if (s.matchedBy[i] !== null) continue;
    s = flip(flip(s, i), partner(s, i));
  }
  return s;
}

describe('dealing', () => {
  it('has motifs enough for the largest board, each unique', () => {
    expect(new Set(MOTIFS.map((m) => m.id)).size).toBe(MOTIFS.length);
    expect(MOTIFS.length).toBeGreaterThanOrEqual(Math.max(...Object.keys(SIZES).map((k) => pairsFor(k as SizeId))));
  });

  it.each(Object.keys(SIZES) as SizeId[])('deals exactly two of each motif for %s', (size) => {
    for (let seed = 0; seed < 100; seed++) {
      const deck = deal(size, seed);
      expect(deck).toHaveLength(SIZES[size].cols * SIZES[size].rows);
      const counts = new Map<string, number>();
      for (const m of deck) counts.set(m, (counts.get(m) ?? 0) + 1);
      expect(counts.size).toBe(pairsFor(size));
      for (const n of counts.values()) expect(n).toBe(2);
    }
  });

  it('is deterministic per seed and differs across seeds', () => {
    expect(deal('4x4', 42)).toEqual(deal('4x4', 42));
    const layouts = new Set(Array.from({ length: 20 }, (_, i) => deal('4x4', i).join(',')));
    expect(layouts.size).toBe(20);
  });

  it('starts face down with no score', () => {
    const s = newMatch('duo', '4x5', 1);
    expect(s.matchedBy.every((m) => m === null)).toBe(true);
    expect(s.open).toEqual([]);
    expect(s.scores).toEqual([0, 0]);
    expect(s.moves).toBe(0);
    expect(s.turn).toBe(0);
    expect(s.deck).toEqual(deal('4x5', 1));
  });
});

describe('flipping', () => {
  it('a match stays face up, scores and counts a move', () => {
    let s = newMatch('solo', '4x4', 7);
    s = flip(s, 0);
    expect(s.open).toEqual([0]);
    expect(isFaceUp(s, 0)).toBe(true);
    s = flip(s, partner(s, 0));
    expect(s.open).toEqual([]);
    expect(s.matchedBy[0]).toBe(0);
    expect(s.matchedBy[partner(s, 0)]).toBe(0);
    expect(s.scores).toEqual([1, 0]);
    expect(s.moves).toBe(1);
    expect(pairsFound(s)).toBe(1);
  });

  it('a mismatch stays visible until settled, then turns back', () => {
    let s = newMatch('solo', '4x4', 7);
    const j = stranger(s, 0);
    s = flip(flip(s, 0), j);
    expect(isPending(s)).toBe(true);
    expect(s.open).toEqual([0, j]);
    expect(s.moves).toBe(1);
    expect(s.scores).toEqual([0, 0]);
    s = settle(s);
    expect(s.open).toEqual([]);
    expect(isFaceUp(s, 0)).toBe(false);
    expect(settle(s)).toBe(s); // nothing to settle
  });

  it('a third tap during a mismatch turns the pair back and opens the new card', () => {
    let s = newMatch('solo', '4x4', 7);
    const j = stranger(s, 0);
    s = flip(flip(s, 0), j);
    const k = s.deck.findIndex((_, x) => x !== 0 && x !== j);
    s = flip(s, k);
    expect(s.open).toEqual([k]);
    expect(s.moves).toBe(1);
  });

  it('cannot flip the same card twice, a matched card, or out of range', () => {
    let s = newMatch('solo', '4x4', 3);
    s = flip(s, 0);
    expect(flip(s, 0)).toBe(s);
    s = flip(s, partner(s, 0));
    expect(canFlip(s, 0)).toBe(false);
    expect(flip(s, 0)).toBe(s);
    expect(flip(s, partner(s, 0))).toBe(s);
    expect(flip(s, -1)).toBe(s);
    expect(flip(s, 16)).toBe(s);
    expect(flip(s, 1.5)).toBe(s);
  });

  it('tapping one of the two showing mismatched cards is ignored', () => {
    let s = newMatch('solo', '4x4', 3);
    const j = stranger(s, 0);
    s = flip(flip(s, 0), j);
    expect(flip(s, 0)).toBe(s);
    expect(flip(s, j)).toBe(s);
  });
});

describe('two players', () => {
  it('a match earns another turn; a mismatch passes it once settled', () => {
    let s = newMatch('duo', '4x4', 11);
    s = flip(flip(s, 0), partner(s, 0));
    expect(s.turn).toBe(0);
    expect(s.scores).toEqual([1, 0]);
    const a = s.deck.findIndex((_, i) => s.matchedBy[i] === null);
    s = flip(flip(s, a), stranger(s, a));
    expect(s.turn).toBe(0); // still showing
    s = settle(s);
    expect(s.turn).toBe(1);
    const b = s.deck.findIndex((_, i) => s.matchedBy[i] === null);
    s = flip(flip(s, b), partner(s, b));
    expect(s.scores).toEqual([1, 1]);
    expect(s.matchedBy[b]).toBe(1);
    expect(s.turn).toBe(1);
  });

  it('an early third tap also passes the turn', () => {
    let s = newMatch('duo', '4x4', 11);
    const j = stranger(s, 0);
    s = flip(flip(s, 0), j);
    s = flip(s, s.deck.findIndex((_, x) => x !== 0 && x !== j));
    expect(s.turn).toBe(1);
  });

  it('solo never changes turn', () => {
    let s = newMatch('solo', '4x4', 11);
    s = settle(flip(flip(s, 0), stranger(s, 0)));
    expect(s.turn).toBe(0);
  });

  it('reports winner and tie', () => {
    let s = newMatch('duo', '4x4', 5);
    expect(winner(s)).toBeUndefined();
    s = solveAll(s); // player 1 never misses
    expect(isOver(s)).toBe(true);
    expect(s.scores).toEqual([8, 0]);
    expect(winner(s)).toBe(0);
    expect(winner({ ...s, scores: [4, 4] })).toBeNull();
    expect(winner({ ...s, scores: [3, 5] })).toBe(1);
  });
});

describe('game end', () => {
  it.each(Object.keys(SIZES) as SizeId[])('ends when every pair is found on %s, with no moves after', (size) => {
    let s = newMatch('solo', size, 99);
    s = solveAll(s);
    expect(isOver(s)).toBe(true);
    expect(s.moves).toBe(pairsFor(size));
    expect(pairsFound(s)).toBe(pairsFor(size));
    for (let i = 0; i < s.deck.length; i++) expect(flip(s, i)).toBe(s);
  });

  it('is not over with one pair left', () => {
    let s = newMatch('solo', '4x4', 99);
    const last = s.deck[15];
    for (let i = 0; i < 16; i++) if (s.deck[i] !== last && s.matchedBy[i] === null) s = flip(flip(s, i), partner(s, i));
    expect(isOver(s)).toBe(false);
    expect(pairsFound(s)).toBe(7);
  });
});

describe('scoring helpers', () => {
  it('prefers fewer moves, then less time', () => {
    expect(isBetter({ moves: 10, ms: 60000 }, null)).toBe(true);
    expect(isBetter({ moves: 9, ms: 99000 }, { moves: 10, ms: 1000 })).toBe(true);
    expect(isBetter({ moves: 10, ms: 900 }, { moves: 10, ms: 1000 })).toBe(true);
    expect(isBetter({ moves: 10, ms: 1000 }, { moves: 10, ms: 1000 })).toBe(false);
    expect(isBetter({ moves: 11, ms: 1 }, { moves: 10, ms: 1000 })).toBe(false);
  });

  it('formats time', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(65_400)).toBe('1:05');
    expect(formatTime(-5)).toBe('0:00');
  });
});
