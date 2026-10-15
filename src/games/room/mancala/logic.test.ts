import { createRng } from '../../../lib/rng';
import {
  STORE,
  chooseMove,
  initialPits,
  isOver,
  legalMoves,
  newGame,
  opposite,
  ownerOf,
  pitNumber,
  rowOf,
  score,
  sow,
  winnerOf,
  type Player,
  type State,
} from './logic';

/** Build a position: player 1 pits (0–5), their store, player 2 pits (7–12), their store. */
const S = (p1: number[], s1: number, p2: number[], s2: number, turn: Player = 1): State => ({
  pits: [...p1, s1, ...p2, s2],
  turn,
});
const total = (s: State) => s.pits.reduce((a, b) => a + b, 0);

describe('board', () => {
  test('starts with four seeds in each of twelve pits, empty stores, player 1 first', () => {
    const g = newGame();
    expect(g.pits).toEqual([4, 4, 4, 4, 4, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
    expect(total(g)).toBe(48);
    expect(g.turn).toBe(1);
    expect(legalMoves(g)).toEqual([0, 1, 2, 3, 4, 5]);
  });

  test('geometry helpers', () => {
    expect(rowOf(1)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(rowOf(2)).toEqual([7, 8, 9, 10, 11, 12]);
    expect(opposite(0)).toBe(12);
    expect(opposite(5)).toBe(7);
    expect(ownerOf(6)).toBeNull();
    expect(ownerOf(13)).toBeNull();
    expect(pitNumber(0)).toBe(1);
    expect(pitNumber(12)).toBe(6);
    expect(initialPits(3)[0]).toBe(3);
  });
});

describe('sowing', () => {
  test('drops one seed per pit counter-clockwise', () => {
    const r = sow(newGame(), 0)!;
    expect(r.path).toEqual([1, 2, 3, 4]);
    expect(r.state.pits.slice(0, 7)).toEqual([0, 5, 5, 5, 5, 4, 0]);
    expect(r.state.turn).toBe(2);
    expect(r.extraTurn).toBe(false);
  });

  test('wraps round and skips the opponent’s store (player 1)', () => {
    const s = S([0, 0, 1, 0, 0, 10], 0, [1, 1, 1, 1, 1, 1], 5);
    const r = sow(s, 5)!;
    expect(r.path).toEqual([6, 7, 8, 9, 10, 11, 12, 0, 1, 2]);
    expect(r.path).not.toContain(STORE[2]);
    expect(r.state.pits[STORE[2]]).toBe(5);
    expect(r.state.pits[STORE[1]]).toBe(1);
    expect(total(r.state)).toBe(total(s));
  });

  test('wraps round and skips the opponent’s store (player 2)', () => {
    const s = S([1, 1, 1, 1, 1, 1], 3, [0, 0, 0, 0, 0, 9], 0, 2);
    const r = sow(s, 12)!;
    expect(r.path).toEqual([13, 0, 1, 2, 3, 4, 5, 7, 8]);
    expect(r.state.pits[STORE[1]]).toBe(3);
    expect(r.last).toBe(8);
  });

  test('last seed in your own store earns another turn', () => {
    const r = sow(newGame(), 2)!; // 4 seeds: 3, 4, 5, store
    expect(r.last).toBe(STORE[1]);
    expect(r.extraTurn).toBe(true);
    expect(r.state.turn).toBe(1);
    const r2 = sow(S([1, 1, 1, 1, 1, 1], 0, [4, 4, 4, 4, 4, 4], 0, 2), 9)!; // 4 seeds from pit 9 → 10, 11, 12, 13
    expect(r2.extraTurn).toBe(true);
    expect(r2.state.turn).toBe(2);
  });

  test('illegal sowings are rejected', () => {
    const g = newGame();
    expect(sow(g, 7)).toBeNull(); // opponent's pit
    expect(sow(g, 6)).toBeNull(); // a store
    expect(sow(g, 13)).toBeNull();
    expect(sow(S([0, 1, 1, 1, 1, 1], 0, [1, 1, 1, 1, 1, 1], 0), 0)).toBeNull(); // empty pit
  });
});

describe('captures', () => {
  test('last seed in your own empty pit takes the opposite pit too', () => {
    const s = S([0, 2, 1, 0, 1, 1], 0, [1, 1, 5, 1, 1, 1], 0);
    const r = sow(s, 1)!; // → 2, 3; pit 3 was empty, opposite (9) holds 5
    expect(r.last).toBe(3);
    expect(r.captured).toBe(5);
    expect(r.state.pits[3]).toBe(0);
    expect(r.state.pits[opposite(3)]).toBe(0);
    expect(r.state.pits[STORE[1]]).toBe(6);
    expect(r.state.turn).toBe(2);
    expect(total(r.state)).toBe(total(s));
  });

  test('no capture when the opposite pit is empty — the seed stays', () => {
    const s = S([0, 2, 1, 0, 1, 1], 0, [1, 1, 0, 1, 1, 1], 0);
    const r = sow(s, 1)!;
    expect(r.captured).toBe(0);
    expect(r.state.pits[3]).toBe(1);
    expect(r.state.pits[STORE[1]]).toBe(0);
  });

  test('no capture in an empty pit on the opponent’s side', () => {
    const s = S([1, 1, 1, 1, 1, 2], 0, [0, 1, 1, 1, 1, 1], 0);
    const r = sow(s, 5)!; // → store, 7 (empty, opponent's)
    expect(r.last).toBe(7);
    expect(r.captured).toBe(0);
    expect(r.state.pits[7]).toBe(1);
  });

  test('a full lap back into the starting pit can capture', () => {
    const s = S([13, 0, 0, 0, 0, 0], 0, [1, 1, 1, 1, 1, 1], 0);
    const r = sow(s, 0)!; // 13 seeds: 1–6, 7–12, skip 13, back to 0
    expect(r.last).toBe(0);
    expect(r.captured).toBe(2); // pit 12 had 1, plus 1 from the lap
    expect(r.state.pits[0]).toBe(0);
    expect(r.state.pits[12]).toBe(0);
    expect(total(r.state)).toBe(total(s));
  });

  test('player 2 captures into their own store', () => {
    const s = S([1, 1, 7, 1, 1, 1], 0, [1, 0, 1, 1, 1, 1], 0, 2);
    const r = sow(s, 7)!; // → 8 (empty, own); opposite 4 holds 1
    expect(r.captured).toBe(1);
    expect(r.state.pits[STORE[2]]).toBe(2);
  });
});

describe('the end', () => {
  test('when one row empties, the other side banks its own seeds', () => {
    const s = S([0, 0, 0, 0, 0, 1], 10, [2, 0, 3, 0, 0, 4], 12);
    const r = sow(s, 5)!; // last seed in store → row 1 empty → game over
    expect(r.sweep).toEqual({ 1: 0, 2: 9 });
    expect(isOver(r.state)).toBe(true);
    expect(score(r.state.pits)).toEqual({ 1: 11, 2: 21 });
    expect(rowOf(2).every((i) => r.state.pits[i] === 0)).toBe(true);
    expect(legalMoves(r.state)).toEqual([]);
    expect(winnerOf(r.state)).toBe(2);
  });

  test('emptying the opponent’s row also ends it (capture leaves them nothing)', () => {
    const s = S([1, 0, 0, 0, 0, 3], 20, [0, 0, 0, 0, 2, 0], 20);
    // pit 0 → 1 (empty, own); opposite 11 holds 2 → capture → player 2 has no seeds
    const r = sow(s, 0)!;
    expect(r.captured).toBe(2);
    expect(r.sweep).toEqual({ 1: 3, 2: 0 });
    expect(score(r.state.pits)).toEqual({ 1: 26, 2: 20 });
    expect(sow(r.state, 5)).toBeNull();
  });

  test('winner and draw', () => {
    expect(winnerOf(S([0, 0, 0, 0, 0, 0], 25, [0, 0, 0, 0, 0, 0], 23))).toBe(1);
    expect(winnerOf(S([0, 0, 0, 0, 0, 0], 24, [0, 0, 0, 0, 0, 0], 24))).toBe(0);
  });

  test('seeds are conserved through whole random games', () => {
    for (let k = 0; k < 30; k++) {
      const rng = createRng(`conserve-${k}`);
      let g = newGame();
      let guard = 0;
      while (!isOver(g) && guard++ < 500) {
        g = sow(g, rng.pick(legalMoves(g)))!.state;
        expect(total(g)).toBe(48);
      }
      expect(isOver(g)).toBe(true);
      expect(score(g.pits)[1] + score(g.pits)[2]).toBe(48);
    }
  });
});

describe('computer opponent', () => {
  test('always returns a legal pit, on both levels', () => {
    let checked = 0;
    for (let k = 0; k < 12; k++) {
      const rng = createRng(`walk-${k}`);
      let g = newGame();
      while (!isOver(g)) {
        for (const level of ['easy', 'hard'] as const) {
          const m = chooseMove(g, level, createRng(checked++));
          expect(legalMoves(g)).toContain(m);
        }
        g = sow(g, rng.pick(legalMoves(g)))!.state;
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  test('never moves once the game is over', () => {
    const over = S([0, 0, 0, 0, 0, 0], 30, [1, 2, 0, 0, 0, 0], 15, 2);
    expect(isOver(over)).toBe(true);
    expect(chooseMove(over, 'hard', createRng(1))).toBeNull();
    expect(chooseMove(over, 'easy', createRng(1))).toBeNull();
  });

  test('hard takes a big capture when it is on offer', () => {
    // Player 2: pit 8 (1 seed) → pit 9, empty, opposite pit 3 holds 9 seeds.
    const s = S([1, 1, 1, 9, 1, 1], 10, [4, 1, 0, 4, 4, 4], 10, 2);
    for (let k = 0; k < 5; k++) expect(chooseMove(s, 'hard', createRng(k))).toBe(8);
  });

  test('hard takes the free extra turn on offer', () => {
    // Only pit 6 (one seed) reaches the store; every other pit overshoots it.
    const s = S([7, 7, 7, 7, 7, 1], 0, [4, 4, 4, 4, 4, 4], 0);
    expect(legalMoves(s).filter((m) => sow(s, m)!.extraTurn)).toEqual([5]);
    for (let k = 0; k < 5; k++) expect(chooseMove(s, 'hard', createRng(k))).toBe(5);
  });

  test('deterministic for a given seed', () => {
    for (const level of ['easy', 'hard'] as const) {
      const run = (seed: number) => {
        const rng = createRng(seed);
        const moves: number[] = [];
        let g = newGame();
        while (!isOver(g)) {
          const m = chooseMove(g, level, rng)!;
          moves.push(m);
          g = sow(g, m)!.state;
        }
        return moves;
      };
      expect(run(9)).toEqual(run(9));
    }
  });

  test('hard beats easy nearly every time', () => {
    let hardWins = 0;
    for (let k = 0; k < 10; k++) {
      const rng = createRng(`match-${k}`);
      const hardSide: Player = k % 2 === 0 ? 1 : 2;
      let g = newGame();
      while (!isOver(g)) g = sow(g, chooseMove(g, g.turn === hardSide ? 'hard' : 'easy', rng)!)!.state;
      if (winnerOf(g) === hardSide) hardWins++;
    }
    expect(hardWins).toBeGreaterThanOrEqual(9);
  });

  test('hard stays quick (typical move well under 50 ms)', () => {
    const rng = createRng('speed');
    const times: number[] = [];
    let g = newGame();
    while (!isOver(g)) {
      const t = performance.now();
      const m = chooseMove(g, 'hard', rng)!;
      times.push(performance.now() - t);
      g = sow(g, m)!.state;
    }
    times.sort((a, b) => a - b);
    expect(times[times.length >> 1]).toBeLessThan(25);
  });
});
