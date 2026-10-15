import { createRng } from '../../../lib/rng';
import {
  applyMove,
  boxesGivenAway,
  boxesTouching,
  capturingEdges,
  chooseEdge,
  givesThirdSide,
  safeEdges,
  sameEdge,
  drawnCount,
  inBounds,
  isLegal,
  isOver,
  legalMoves,
  newGame,
  score,
  SIZES,
  totalEdges,
  winner,
  type Edge,
  type Player,
  type Size,
  type State,
} from './logic';

const H = (r: number, c: number): Edge => ({ kind: 'h', r, c });
const V = (r: number, c: number): Edge => ({ kind: 'v', r, c });

function play(s: State, edges: Edge[]): State {
  for (const e of edges) {
    const res = applyMove(s, e);
    if (!res) throw new Error(`illegal ${JSON.stringify(e)}`);
    s = res.state;
  }
  return s;
}

/** Every edge drawn except `leave`; boxes assigned per `owners` (row-major, 0 = unclaimed). */
function nearlyFull(size: Size, leave: Edge, owners: (0 | Player)[], turn: Player): State {
  const s = newGame(size, turn);
  s.h = s.h.map((row) => row.map(() => 1 as const));
  s.v = s.v.map((row) => row.map(() => 1 as const));
  if (leave.kind === 'h') s.h[leave.r][leave.c] = 0;
  else s.v[leave.r][leave.c] = 0;
  s.boxes = s.boxes.map((row, r) => row.map((_, c) => owners[r * size + c]));
  return s;
}

describe('dots & boxes: setup', () => {
  it.each(SIZES)('builds a %i×%i board with the right edge counts', (n) => {
    const s = newGame(n);
    expect(s.h).toHaveLength(n + 1);
    expect(s.h[0]).toHaveLength(n);
    expect(s.v).toHaveLength(n);
    expect(s.v[0]).toHaveLength(n + 1);
    expect(s.boxes.flat()).toHaveLength(n * n);
    expect(legalMoves(s)).toHaveLength(totalEdges(n));
    expect(totalEdges(n)).toBe(2 * n * (n + 1));
    expect(isOver(s)).toBe(false);
    expect(winner(s)).toBeNull();
    expect(s.turn).toBe(1);
  });

  it('respects who starts', () => {
    expect(newGame(3, 2).turn).toBe(2);
  });

  it('validates bounds', () => {
    expect(inBounds(3, H(3, 2))).toBe(true);
    expect(inBounds(3, H(4, 0))).toBe(false);
    expect(inBounds(3, H(0, 3))).toBe(false);
    expect(inBounds(3, V(2, 3))).toBe(true);
    expect(inBounds(3, V(3, 0))).toBe(false);
    expect(inBounds(3, V(-1, 0))).toBe(false);
    expect(inBounds(3, V(0.5, 0))).toBe(false);
    expect(applyMove(newGame(3), H(9, 9))).toBeNull();
  });

  it('knows which boxes an edge touches', () => {
    expect(boxesTouching(3, H(0, 1))).toEqual([[0, 1]]);
    expect(boxesTouching(3, H(3, 1))).toEqual([[2, 1]]);
    expect(boxesTouching(3, H(1, 1))).toEqual([[0, 1], [1, 1]]);
    expect(boxesTouching(3, V(1, 0))).toEqual([[1, 0]]);
    expect(boxesTouching(3, V(1, 3))).toEqual([[1, 2]]);
    expect(boxesTouching(3, V(1, 2))).toEqual([[1, 1], [1, 2]]);
  });
});

describe('dots & boxes: moves', () => {
  it('passes the turn when no box is completed', () => {
    const res = applyMove(newGame(3), H(0, 0))!;
    expect(res.completed).toEqual([]);
    expect(res.extraTurn).toBe(false);
    expect(res.state.turn).toBe(2);
    expect(res.state.h[0][0]).toBe(1);
    expect(res.state.last).toEqual(H(0, 0));
  });

  it('does not mutate the input state', () => {
    const s = newGame(3);
    applyMove(s, H(0, 0));
    expect(s.h[0][0]).toBe(0);
    expect(s.turn).toBe(1);
  });

  it('rejects a repeat edge', () => {
    const s = play(newGame(3), [H(0, 0)]);
    expect(isLegal(s, H(0, 0))).toBe(false);
    expect(applyMove(s, H(0, 0))).toBeNull();
    expect(legalMoves(s).some((e) => e.kind === 'h' && e.r === 0 && e.c === 0)).toBe(false);
  });

  it('scores a single box and grants another turn', () => {
    // P1 top, P2 bottom, P1 left — now P2 closes box (0,0) with the right side.
    const s = play(newGame(3), [H(0, 0), H(1, 0), V(0, 0)]);
    expect(s.turn).toBe(2);
    const res = applyMove(s, V(0, 1))!;
    expect(res.completed).toEqual([[0, 0]]);
    expect(res.extraTurn).toBe(true);
    expect(res.state.turn).toBe(2);
    expect(res.state.boxes[0][0]).toBe(2);
    expect(score(res.state)).toEqual({ 1: 0, 2: 1 });
  });

  it('scores two boxes with one edge, and grants only one extra turn', () => {
    // Boxes (0,0) and (0,1) each have three sides; the shared vertical V(0,1) closes both.
    const s = play(newGame(3), [H(0, 0), H(0, 1), H(1, 0), H(1, 1), V(0, 0), V(0, 2)]);
    expect(s.turn).toBe(1);
    const res = applyMove(s, V(0, 1))!;
    expect(res.completed).toHaveLength(2);
    expect(res.completed).toEqual(expect.arrayContaining([[0, 0], [0, 1]]));
    expect(score(res.state)).toEqual({ 1: 2, 2: 0 });
    expect(res.extraTurn).toBe(true);
    expect(res.state.turn).toBe(1);
    // After the extra turn, a non-scoring move passes to the other player.
    const after = applyMove(res.state, H(3, 2))!;
    expect(after.extraTurn).toBe(false);
    expect(after.state.turn).toBe(2);
  });

  it('never re-awards a box that is already owned', () => {
    const s = play(newGame(3), [H(0, 0), H(1, 0), V(0, 0), V(0, 1)]);
    expect(s.boxes[0][0]).toBe(2);
    // Drawing a neighbour edge later does not change it.
    const t = play(s, [H(0, 1), H(1, 1)]);
    expect(t.boxes[0][0]).toBe(2);
  });
});

describe('dots & boxes: endgame', () => {
  it('ends on the last edge and declares the winner', () => {
    // 3×3, last edge H(0,0) closes box (0,0). P1 has 4, P2 has 4, P1 to move → P1 wins 5–4.
    const owners: (0 | Player)[] = [0, 1, 1, 1, 1, 2, 2, 2, 2];
    const s = nearlyFull(3, H(0, 0), owners, 1);
    expect(isOver(s)).toBe(false);
    expect(winner(s)).toBeNull();
    expect(legalMoves(s)).toEqual([H(0, 0)]);
    const res = applyMove(s, H(0, 0))!;
    expect(res.completed).toEqual([[0, 0]]);
    expect(res.extraTurn).toBe(false); // nothing left to play
    expect(isOver(res.state)).toBe(true);
    expect(legalMoves(res.state)).toEqual([]);
    expect(score(res.state)).toEqual({ 1: 5, 2: 4 });
    expect(winner(res.state)).toBe(1);
    expect(applyMove(res.state, H(0, 0))).toBeNull();
  });

  it('declares a tie on an even board', () => {
    // 4×4: 15 boxes owned 7–8, P1 closes the last one → 8–8.
    const owners: (0 | Player)[] = [0, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2];
    const s = nearlyFull(4, V(0, 0), owners, 1);
    const res = applyMove(s, V(0, 0))!;
    expect(score(res.state)).toEqual({ 1: 8, 2: 8 });
    expect(winner(res.state)).toBe('tie');
  });

  it('can be won by player 2', () => {
    const owners: (0 | Player)[] = [0, 1, 1, 2, 2, 2, 2, 2, 2];
    const res = applyMove(nearlyFull(3, H(0, 0), owners, 1), H(0, 0))!;
    expect(winner(res.state)).toBe(2);
  });

  it.each(SIZES)('random full games on %i×%i keep every invariant', (n) => {
    for (let g = 0; g < 40; g++) {
      const rng = createRng(`dots:${n}:${g}`);
      let s = newGame(n, g % 2 === 0 ? 1 : 2);
      let moves = 0;
      while (!isOver(s)) {
        const legal = legalMoves(s);
        expect(legal.length).toBe(totalEdges(n) - moves);
        const mover = s.turn;
        const before = score(s);
        const res = applyMove(s, rng.pick(legal))!;
        expect(res).not.toBeNull();
        expect(res.completed.length).toBeLessThanOrEqual(2);
        const after = score(res.state);
        expect(after[mover] - before[mover]).toBe(res.completed.length);
        if (res.completed.length === 0) expect(res.state.turn).not.toBe(mover);
        else expect(res.state.turn).toBe(mover);
        s = res.state;
        moves++;
      }
      expect(moves).toBe(totalEdges(n));
      expect(drawnCount(s)).toBe(totalEdges(n));
      const sc = score(s);
      expect(sc[1] + sc[2]).toBe(n * n);
      expect(s.boxes.flat().every((o) => o === 1 || o === 2)).toBe(true);
      const w = winner(s);
      expect(w).toBe(sc[1] > sc[2] ? 1 : sc[2] > sc[1] ? 2 : 'tie');
      if (n % 2 === 1) expect(w).not.toBe('tie');
    }
  });
});

describe('dots & boxes: computer opponent', () => {
  /** All edges drawn except `open`; unlisted boxes get alternating owners if fully enclosed. */
  function position(size: Size, open: Edge[], turn: Player): State {
    const s = newGame(size, turn);
    s.h = s.h.map((row) => row.map(() => 1 as const));
    s.v = s.v.map((row) => row.map(() => 1 as const));
    for (const e of open) (e.kind === 'h' ? s.h : s.v)[e.r][e.c] = 0;
    let k = 0;
    s.boxes = s.boxes.map((row, r) => row.map((_, c) => (sidesDrawn4(s, r, c) ? ((k++ % 2) + 1) as Player : 0)));
    return s;
  }
  const sidesDrawn4 = (s: State, r: number, c: number) => !!(s.h[r][c] && s.h[r + 1][c] && s.v[r][c] && s.v[r][c + 1]);

  it('takes a box on offer (hard always, easy usually)', () => {
    // Box (0,0) has three sides; V(0,1) closes it.
    const s = play(newGame(3), [H(0, 0), H(1, 0), V(0, 0)]);
    expect(capturingEdges(s)).toEqual([V(0, 1)]);
    for (let k = 0; k < 10; k++) expect(chooseEdge(s, 'hard', createRng(k))).toEqual(V(0, 1));
    const easyTakes = Array.from({ length: 40 }, (_, k) => sameEdge(chooseEdge(s, 'easy', createRng(k)), V(0, 1))).filter(Boolean).length;
    expect(easyTakes).toBeGreaterThan(20);
    expect(easyTakes).toBeLessThan(40);
  });

  it('hard never gives a third side while a safe line exists', () => {
    for (const n of SIZES) {
      for (let g = 0; g < 15; g++) {
        const rng = createRng(`db-safe-${n}-${g}`);
        let s = newGame(n, g % 2 ? 1 : 2);
        while (!isOver(s)) {
          let e: Edge;
          if (s.turn === 2) {
            const hadSafe = safeEdges(s).length > 0;
            const hadCapture = capturingEdges(s).length > 0;
            e = chooseEdge(s, 'hard', rng)!;
            if (hadCapture) expect(capturingEdges(s)).toContainEqual(e);
            else if (hadSafe) expect(givesThirdSide(s, e)).toBe(false);
          } else e = rng.pick(legalMoves(s));
          s = applyMove(s, e)!.state;
        }
      }
    }
  });

  it('in the endgame, opens the shortest chain', () => {
    // 3×3: top row is an open chain of three; box (2,0) is a lone box with two
    // open sides on the border. Every line gives something away.
    const s = position(3, [V(0, 0), V(0, 1), V(0, 2), V(0, 3), V(2, 0), H(3, 0)], 2);
    expect(safeEdges(s)).toEqual([]);
    expect(capturingEdges(s)).toEqual([]);
    expect(boxesGivenAway(s, V(0, 1))).toBe(3);
    expect(boxesGivenAway(s, V(2, 0))).toBe(1);
    for (let k = 0; k < 10; k++) {
      const e = chooseEdge(s, 'hard', createRng(k))!;
      expect([V(2, 0), H(3, 0)]).toContainEqual(e);
    }
  });

  it('always returns a legal line, and nothing once the game is over', () => {
    for (const level of ['easy', 'hard'] as const) {
      const rng = createRng(`db-legal-${level}`);
      let s = newGame(4, 1);
      while (!isOver(s)) {
        const e = chooseEdge(s, level, rng)!;
        expect(isLegal(s, e)).toBe(true);
        s = applyMove(s, e)!.state;
      }
      expect(chooseEdge(s, level, rng)).toBeNull();
    }
  });

  it('hard beats a random player nearly always, and beats easy more often than not', () => {
    let vsRandom = 0;
    let vsEasy = 0;
    const games = 20;
    for (let g = 0; g < games; g++) {
      for (const opp of ['random', 'easy'] as const) {
        const rng = createRng(`db-strength-${opp}-${g}`);
        let s = newGame(4, g % 2 ? 1 : 2);
        while (!isOver(s)) {
          const e = s.turn === 2 ? chooseEdge(s, 'hard', rng)! : opp === 'random' ? rng.pick(legalMoves(s)) : chooseEdge(s, 'easy', rng)!;
          s = applyMove(s, e)!.state;
        }
        if (winner(s) === 2) {
          if (opp === 'random') vsRandom++;
          else vsEasy++;
        }
      }
    }
    expect(vsRandom).toBeGreaterThanOrEqual(games - 1);
    expect(vsEasy).toBeGreaterThan(games / 2);
  });

  it('is deterministic for a seed', () => {
    const s = play(newGame(4), [H(0, 0), V(1, 1), H(2, 2)]);
    for (const level of ['easy', 'hard'] as const) expect(chooseEdge(s, level, createRng(3))).toEqual(chooseEdge(s, level, createRng(3)));
  });

  it('answers quickly on the biggest board', () => {
    const rng = createRng('db-speed');
    let s = newGame(5, 1);
    let worst = 0;
    while (!isOver(s)) {
      const t = performance.now();
      const e = chooseEdge(s, 'hard', rng)!;
      worst = Math.max(worst, performance.now() - t);
      s = applyMove(s, e)!.state;
    }
    expect(worst).toBeLessThan(100);
  });
});
