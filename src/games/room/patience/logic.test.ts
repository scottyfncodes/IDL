import {
  allCards,
  applyMove,
  autoStep,
  canAutoComplete,
  canMove,
  canStack,
  cardName,
  cardOf,
  cardsAt,
  deal,
  dealFor,
  fanLayout,
  formatTime,
  fullDeck,
  generateDeal,
  isRed,
  isWon,
  rankOf,
  shuffledDeck,
  smartTargets,
  solve,
  stockMove,
  suitOf,
  SUIT_GLYPHS,
  type Board,
  type Column,
  type Move,
} from './logic';

// Suits: 0 spades, 1 hearts, 2 diamonds, 3 clubs.
const S = (r: number) => cardOf(0, r);
const H = (r: number) => cardOf(1, r);
const D = (r: number) => cardOf(2, r);
const C = (r: number) => cardOf(3, r);
const col = (cards: number[], hidden = 0): Column => ({ cards, hidden });
const emptyCols = () => Array.from({ length: 7 }, () => col([]));

function board(p: Partial<Board> & { cols?: Column[] }): Board {
  const tableau = emptyCols();
  (p.cols ?? []).forEach((c, i) => (tableau[i] = c));
  return { tableau, stock: p.stock ?? [], waste: p.waste ?? [], foundations: p.foundations ?? [0, 0, 0, 0], draw: p.draw ?? 1 };
}
const mv = (b: Board, m: Move) => applyMove(b, m);
const t = (c: number, index: number) => ({ pile: 'tableau' as const, col: c, index });
const toCol = (c: number) => ({ pile: 'tableau' as const, col: c });
const toF = { pile: 'foundation' as const };

function replay(b: Board, moves: Move[]): Board {
  let x = b;
  for (const m of moves) {
    const n = applyMove(x, m);
    if (!n) throw new Error(`illegal move in solution: ${JSON.stringify(m)}`);
    x = n;
  }
  return x;
}

describe('cards', () => {
  it('encodes suit, rank and colour', () => {
    expect(suitOf(H(7))).toBe(1);
    expect(rankOf(H(7))).toBe(7);
    expect(isRed(H(1))).toBe(true);
    expect(isRed(D(13))).toBe(true);
    expect(isRed(S(5))).toBe(false);
    expect(isRed(C(5))).toBe(false);
    expect(cardName(C(12))).toBe('Queen of clubs');
    expect(cardName(H(1))).toBe('Ace of hearts');
  });

  it('uses text-presentation suit glyphs', () => {
    for (const g of SUIT_GLYPHS) expect(g.endsWith('︎')).toBe(true);
  });

  it('stacks descending in alternating colours only', () => {
    expect(canStack(H(6), S(7))).toBe(true);
    expect(canStack(S(6), H(7))).toBe(true);
    expect(canStack(C(6), S(7))).toBe(false); // same colour
    expect(canStack(D(6), H(7))).toBe(false); // same colour
    expect(canStack(H(5), S(7))).toBe(false); // not descending by one
    expect(canStack(H(8), S(7))).toBe(false); // ascending
  });
});

describe('dealing', () => {
  it('deals 52 unique cards into the Klondike layout', () => {
    for (const seed of [0, 1, 42, 123456789]) {
      const b = dealFor(seed, 0, 1);
      const cards = allCards(b);
      expect(cards).toHaveLength(52);
      expect(new Set(cards).size).toBe(52);
      b.tableau.forEach((c, i) => {
        expect(c.cards).toHaveLength(i + 1);
        expect(c.hidden).toBe(i); // only the top card face up
      });
      expect(b.stock).toHaveLength(24);
      expect(b.waste).toHaveLength(0);
      expect(b.foundations).toEqual([0, 0, 0, 0]);
    }
  });

  it('is reproducible from its seed and differs between seeds', () => {
    expect(shuffledDeck('x')).toEqual(shuffledDeck('x'));
    expect(dealFor(7, 0, 1)).toEqual(dealFor(7, 0, 1));
    expect(dealFor(7, 0, 1)).not.toEqual(dealFor(8, 0, 1));
    expect([...shuffledDeck(5)].sort((a, b) => a - b)).toEqual(fullDeck());
  });

  it('rejects a deck that is not 52 distinct cards', () => {
    expect(() => deal(fullDeck().slice(1), 1)).toThrow();
    expect(() => deal([...fullDeck().slice(1), 0].map((c, i) => (i === 51 ? 1 : c)), 1)).toThrow();
  });
});

describe('legal moves', () => {
  it('builds down in alternating colours', () => {
    const b = board({ cols: [col([S(7)]), col([H(6)]), col([D(6)]), col([C(6)]), col([H(5)])] });
    expect(canMove(b, t(1, 0), toCol(0))).toBe(true); // red 6 on black 7
    expect(canMove(b, t(2, 0), toCol(0))).toBe(true);
    expect(canMove(b, t(3, 0), toCol(0))).toBe(false); // black on black
    expect(canMove(b, t(4, 0), toCol(0))).toBe(false); // 5 on 7
    expect(canMove(b, t(0, 0), toCol(1))).toBe(false); // ascending
  });

  it('only kings (or runs headed by a king) go to an empty column', () => {
    const b = board({ cols: [col([H(12)]), col([S(13), H(12)]), col([]), col([C(13)], 0)] });
    expect(canMove(b, t(0, 0), toCol(2))).toBe(false);
    expect(canMove(b, t(1, 0), toCol(2))).toBe(true);
    expect(canMove(b, t(3, 0), toCol(2))).toBe(true);
    const wasteKing = board({ waste: [D(13)], cols: [col([S(1)])] });
    expect(canMove(wasteKing, { pile: 'waste' }, toCol(1))).toBe(true);
    const wasteQueen = board({ waste: [D(12)], cols: [col([S(1)])] });
    expect(canMove(wasteQueen, { pile: 'waste' }, toCol(1))).toBe(false);
  });

  it('builds foundations up from the ace in one suit', () => {
    const b = board({ cols: [col([H(1)]), col([H(2)]), col([S(2)]), col([H(3)])] });
    expect(canMove(b, t(1, 0), toF)).toBe(false); // 2 before ace
    const b1 = mv(b, { t: 'move', from: t(0, 0), to: toF })!;
    expect(b1.foundations).toEqual([0, 1, 0, 0]);
    expect(canMove(b1, t(2, 0), toF)).toBe(false); // wrong suit
    expect(canMove(b1, t(3, 0), toF)).toBe(false); // skips the 2
    const b2 = mv(b1, { t: 'move', from: t(1, 0), to: toF })!;
    expect(b2.foundations).toEqual([0, 2, 0, 0]);
    expect(canMove(b2, t(3, 0), toF)).toBe(true);
  });

  it('only sends single cards to a foundation', () => {
    const b = board({ cols: [col([S(2), H(1)])], foundations: [1, 0, 0, 0] });
    expect(canMove(b, t(0, 0), toF)).toBe(false);
    expect(canMove(b, t(0, 1), toF)).toBe(true);
  });

  it('can bring a foundation card back down to the tableau', () => {
    const b = board({ cols: [col([S(5)])], foundations: [0, 4, 0, 0] });
    const n = mv(b, { t: 'move', from: { pile: 'foundation', suit: 1 }, to: toCol(0) })!;
    expect(n.foundations[1]).toBe(3);
    expect(n.tableau[0].cards).toEqual([S(5), H(4)]);
    expect(canMove(b, { pile: 'foundation', suit: 1 }, toF)).toBe(false);
  });

  it('never moves face-down cards, or cards from an empty pile', () => {
    const b = board({ cols: [col([S(9), H(8)], 1), col([C(9)])] });
    expect(cardsAt(b, t(0, 0))).toBeNull();
    expect(canMove(b, t(0, 0), toCol(1))).toBe(false);
    expect(cardsAt(b, { pile: 'waste' })).toBeNull();
    expect(cardsAt(b, { pile: 'foundation', suit: 0 })).toBeNull();
    expect(mv(b, { t: 'move', from: t(0, 0), to: toCol(1) })).toBeNull();
  });
});

describe('sequence moves and auto-flip', () => {
  it('moves a face-up run together and flips the exposed card', () => {
    const b = board({ cols: [col([C(2), S(10), H(9), S(8)], 1), col([D(11)])] });
    const n = mv(b, { t: 'move', from: t(0, 1), to: toCol(1) })!;
    expect(n.tableau[1].cards).toEqual([D(11), S(10), H(9), S(8)]);
    expect(n.tableau[0]).toEqual({ cards: [C(2)], hidden: 0 }); // flipped
    // The original is untouched (moves are pure).
    expect(b.tableau[0].cards).toHaveLength(4);
  });

  it('moves part of a run', () => {
    const b = board({ cols: [col([S(10), H(9), S(8)]), col([D(9)])] });
    const n = mv(b, { t: 'move', from: t(0, 2), to: toCol(1) })!;
    expect(n.tableau[0].cards).toEqual([S(10), H(9)]);
    expect(n.tableau[1].cards).toEqual([D(9), S(8)]);
  });

  it('refuses a broken run', () => {
    const b = board({ cols: [col([S(10), C(9)]), col([H(11)])] });
    expect(cardsAt(b, t(0, 0))).toBeNull();
  });

  it('flips after a single card goes to the foundation', () => {
    const b = board({ cols: [col([C(7), D(6), H(1)], 2)] });
    const n = mv(b, { t: 'move', from: t(0, 2), to: toF })!;
    expect(n.tableau[0]).toEqual({ cards: [C(7), D(6)], hidden: 1 });
  });

  it('leaves an emptied column with nothing hidden', () => {
    const b = board({ cols: [col([S(13)]), col([])] });
    const n = mv(b, { t: 'move', from: t(0, 0), to: toCol(1) })!;
    expect(n.tableau[0]).toEqual({ cards: [], hidden: 0 });
  });
});

describe('stock and waste', () => {
  const stock = [S(1), S(2), S(3), S(4), S(5), S(6), S(7)]; // top is S(7)

  it('draw 1 turns one card', () => {
    const b = board({ stock, draw: 1 });
    const n = mv(b, { t: 'draw' })!;
    expect(n.waste).toEqual([S(7)]);
    expect(n.stock).toHaveLength(6);
  });

  it('draw 3 turns three, the last one turned on top', () => {
    const b = board({ stock, draw: 3 });
    const n = mv(b, { t: 'draw' })!;
    expect(n.waste).toEqual([S(7), S(6), S(5)]);
    expect(cardsAt(n, { pile: 'waste' })).toEqual([S(5)]);
    const n2 = mv(n, { t: 'draw' })!;
    expect(n2.waste).toEqual([S(7), S(6), S(5), S(4), S(3), S(2)]);
    const n3 = mv(n2, { t: 'draw' })!; // only one left
    expect(n3.waste).toHaveLength(7);
    expect(n3.stock).toHaveLength(0);
    expect(mv(n3, { t: 'draw' })).toBeNull();
  });

  it('recycles the waste back into the same stock order, unlimited times', () => {
    let b = board({ stock, draw: 3 });
    for (let pass = 0; pass < 4; pass++) {
      while (b.stock.length) b = mv(b, { t: 'draw' })!;
      expect(stockMove(b)).toEqual({ t: 'recycle' });
      b = mv(b, { t: 'recycle' })!;
      expect(b.stock).toEqual(stock);
      expect(b.waste).toEqual([]);
    }
  });

  it('cannot recycle while the stock has cards, or with nothing in the waste', () => {
    expect(mv(board({ stock, waste: [H(1)] }), { t: 'recycle' })).toBeNull();
    expect(mv(board({}), { t: 'recycle' })).toBeNull();
    expect(stockMove(board({}))).toBeNull();
  });

  it('draw 3 waste: after a play from the waste, the next card down is playable', () => {
    let b = board({ stock: [H(9), S(1), C(4)], draw: 3, cols: [col([S(10)])] });
    b = mv(b, { t: 'draw' })!; // waste: C4, S1, H9 (H9 on top)
    expect(cardsAt(b, { pile: 'waste' })).toEqual([H(9)]);
    b = mv(b, { t: 'move', from: { pile: 'waste' }, to: toCol(0) })!;
    expect(cardsAt(b, { pile: 'waste' })).toEqual([S(1)]);
    b = mv(b, { t: 'move', from: { pile: 'waste' }, to: toF })!;
    expect(cardsAt(b, { pile: 'waste' })).toEqual([C(4)]);
  });
});

describe('undo snapshots', () => {
  it('a stored snapshot restores the board exactly', () => {
    const b0 = dealFor(99, 0, 3);
    const history: string[] = [];
    let b = b0;
    // Play a mix of draws, recycles and any legal moves.
    for (let i = 0; i < 40; i++) {
      history.push(JSON.stringify(b));
      const src = b.tableau.findIndex((c, k) => c.cards.length && smartTargets(b, t(k, c.hidden)).length);
      const m: Move | null =
        src >= 0 ? { t: 'move', from: t(src, b.tableau[src].hidden), to: smartTargets(b, t(src, b.tableau[src].hidden))[0] } : stockMove(b);
      if (!m) break;
      b = applyMove(b, m)!;
    }
    // Undo all the way back, comparing every step.
    while (history.length) {
      const prev = JSON.parse(history.pop()!) as Board;
      b = prev;
    }
    expect(b).toEqual(b0);
  });
});

describe('smart moves', () => {
  it('prefers the foundation for a playable top card', () => {
    const b = board({ cols: [col([H(1)]), col([S(2)])] });
    expect(smartTargets(b, t(0, 0))).toEqual([toF, toCol(1)]);
  });

  it('lists building columns before an empty one, and only one empty column', () => {
    const b = board({ cols: [col([S(13), H(12)]), col([]), col([C(13)]), col([]), col([S(13)])] });
    expect(smartTargets(b, t(0, 1))).toEqual([toCol(2), toCol(4)]);
    // A king run (not a whole column) can go to the first empty column.
    const k = board({ cols: [col([D(4), S(13), H(12)], 1), col([]), col([]), col([C(9)])] });
    expect(smartTargets(k, t(0, 1))).toEqual([toCol(1)]);
  });

  it('never offers moving a whole column into another empty column', () => {
    const b = board({ cols: [col([S(13), H(12)]), col([])] });
    expect(smartTargets(b, t(0, 0))).toEqual([]);
  });

  it('works for the waste and foundation tops, and is empty for no move', () => {
    const b = board({ waste: [D(6)], cols: [col([C(7)]), col([S(7)])], foundations: [0, 0, 6, 0] });
    expect(smartTargets(b, { pile: 'waste' })).toEqual([toCol(0), toCol(1)]);
    expect(smartTargets(b, { pile: 'foundation', suit: 2 })).toEqual([toCol(0), toCol(1)]);
    expect(smartTargets(board({ cols: [col([S(4)])] }), t(0, 0))).toEqual([]);
  });

  it('moves the run from a tapped card in the middle of a column', () => {
    const b = board({ cols: [col([S(10), H(9), S(8)]), col([D(11)]), col([C(10)])] });
    expect(smartTargets(b, t(0, 0))).toEqual([toCol(1)]);
    expect(smartTargets(b, t(0, 1))).toEqual([toCol(2)]);
  });
});

describe('win and auto-finish', () => {
  it('detects a win only when all four foundations are complete', () => {
    expect(isWon(board({ foundations: [13, 13, 13, 13] }))).toBe(true);
    expect(isWon(board({ foundations: [13, 13, 13, 12], cols: [col([C(13)])] }))).toBe(false);
  });

  it('offers auto-finish only with nothing face down (and, on draw 3, an empty stock)', () => {
    const open = board({ cols: [col([S(2)]), col([H(2)])], foundations: [1, 1, 13, 13], draw: 1, stock: [S(3)] });
    expect(canAutoComplete(open)).toBe(true);
    expect(canAutoComplete({ ...open, draw: 3 })).toBe(false);
    expect(canAutoComplete({ ...open, tableau: open.tableau.map((c, i) => (i === 0 ? { ...c, hidden: 1 } : c)) })).toBe(false);
  });

  it('auto-finish steps play out to a win', () => {
    // Everything open: two columns of runs plus a stock (draw 1).
    const b0 = board({
      cols: [col([S(13), H(12), S(11), H(10)]), col([H(13), S(12), H(11), S(10)])],
      stock: [S(9), H(9), S(8), H(8), S(7), H(7), S(6), H(6), S(5), H(5), S(4), H(4), S(3), H(3), S(2), H(2), S(1), H(1)],
      foundations: [0, 0, 13, 13],
    });
    let b = b0;
    let steps = 0;
    while (canAutoComplete(b) && steps < 500) {
      b = applyMove(b, autoStep(b)!)!;
      steps++;
    }
    expect(isWon(b)).toBe(true);
    expect(autoStep(b)).toBeNull();
  });
});

describe('fan layout', () => {
  it('uses the ideal fan when there is room', () => {
    const l = fanLayout(2, 3, 70, 400);
    expect(l.down).toBeGreaterThan(l.up / 3);
    expect(l.height).toBeLessThanOrEqual(400);
  });

  it('compresses long columns to fit, keeping the corner readable', () => {
    const l = fanLayout(6, 12, 68, 330);
    expect(l.height).toBeLessThanOrEqual(330);
    expect(l.up).toBeGreaterThanOrEqual(13);
  });

  it('grows past the space only when it cannot fit at minimum spacing', () => {
    const l = fanLayout(6, 13, 68, 150);
    expect(l.up).toBeGreaterThanOrEqual(13);
    expect(l.height).toBeGreaterThan(150);
  });
});

describe('formatTime', () => {
  it('formats minutes and hours', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(102_000)).toBe('1:42');
    expect(formatTime(3_725_000)).toBe('1:02:05');
  });
});

describe('solver', () => {
  /** A deal that unwinds itself: high cards in tidy columns, low cards in the stock. */
  function easyDeal(draw: 1 | 3): Board {
    const cols: Column[] = [
      col([H(7)], 0),
      col([D(8), D(7)], 1),
      col([C(9), C(8), C(7)], 2),
      col([C(13), C(12), C(11), C(10)], 3),
      col([D(13), D(12), D(11), D(10), D(9)], 4),
      col([H(13), H(12), H(11), H(10), H(9), H(8)], 5),
      col([S(13), S(12), S(11), S(10), S(9), S(8), S(7)], 6),
    ];
    const stock: number[] = [];
    for (let r = 1; r <= 6; r++) for (const s of [0, 1, 2, 3]) stock.push(cardOf(s, r));
    stock.reverse(); // top of stock (last) is the ace of spades
    return board({ cols, stock, draw });
  }

  it('the constructed easy deal is a real 52-card deal', () => {
    const b = easyDeal(1);
    expect(new Set(allCards(b)).size).toBe(52);
  });

  for (const draw of [1, 3] as const) {
    it(`solves a constructed easy deal (draw ${draw}) with a replayable solution`, () => {
      const b = easyDeal(draw);
      const r = solve(b, { budget: 5000 });
      expect(r.status).toBe('solved');
      expect(isWon(replay(b, r.solution!))).toBe(true);
    });
  }

  it('reports a constructed dead position as exhausted, quickly', () => {
    // Ace of spades buried under the two of spades; every other column holds
    // a lone black card with nowhere to go. Everything else is home.
    const b = board({
      cols: [col([S(1), S(2)], 1), col([S(3)]), col([S(4)]), col([S(5)]), col([S(6)]), col([S(7)]), col([S(8)])],
      foundations: [0, 13, 13, 13],
    });
    // Spades 9..K wait in the stock; none of them can move either.
    const full = { ...b, stock: [S(9), S(10), S(11), S(12), S(13)] };
    expect(new Set(allCards(full)).size).toBe(52);
    const t0 = performance.now();
    const r = solve(full, { budget: 5000 });
    expect(r.status).toBe('exhausted');
    expect(performance.now() - t0).toBeLessThan(200);
  });

  it('respects its node budget on a full deal', () => {
    const r = solve(dealFor(3, 0, 3), { budget: 50 });
    expect(['budget', 'solved', 'exhausted']).toContain(r.status);
    expect(r.nodes).toBeLessThanOrEqual(50);
  });
});

describe('winnable deal generation', () => {
  for (const draw of [1, 3] as const) {
    it(`every verified draw-${draw} deal really is won by replaying the solver's moves`, () => {
      let verified = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const d = generateDeal(seed, draw, true, { maxMs: 10_000 });
        expect(new Set(allCards(d.board)).size).toBe(52);
        expect(d.board.draw).toBe(draw);
        if (!d.verified) continue;
        verified++;
        expect(d.board).toEqual(dealFor(seed, d.attempt, draw));
        const r = solve(d.board);
        expect(r.status).toBe('solved');
        expect(isWon(replay(d.board, r.solution!))).toBe(true);
      }
      expect(verified).toBeGreaterThanOrEqual(10);
    }, 60_000);
  }

  it('is deterministic for a seed', () => {
    expect(generateDeal(77, 1, true, { maxMs: 1e9 })).toEqual(generateDeal(77, 1, true, { maxMs: 1e9 }));
  });

  it('without winnable, deals the first shuffle unverified', () => {
    const d = generateDeal(5, 1, false);
    expect(d).toEqual({ board: dealFor(5, 0, 1), attempt: 0, verified: false });
  });

  it('falls back to an unverified random deal when time runs out', () => {
    let clock = 0;
    const d = generateDeal(5, 3, true, { budget: 1, now: () => (clock += 1000), maxMs: 500 });
    expect(d.verified).toBe(false);
    expect(d.board).toEqual(dealFor(5, 0, 3));
  });
});
