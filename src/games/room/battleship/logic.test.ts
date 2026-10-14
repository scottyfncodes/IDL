import { createRng } from '../../../lib/rng';
import {
  CELLS,
  FLEET,
  FLEET_CELLS,
  SIZE,
  canPlace,
  cellsFor,
  confirmFleet,
  fire,
  indexOf,
  isFleetComplete,
  isValidGame,
  newGame,
  occupied,
  placeShip,
  previewCells,
  randomFleet,
  removeShip,
  setFleet,
  shipAt,
  stats,
  sunkPlacements,
  targetMarks,
  type Fleet,
  type Game,
} from './logic';

/** A fixed legal fleet: every boat horizontal on its own row, starting at column 0. */
const rowsFleet = (): Fleet => FLEET.map((s, r) => ({ id: s.id, row: r, col: 0, orient: 'h' as const }));

/** Both fleets placed and confirmed; battle begins with `starter` to fire. */
function battleReady(starter: 0 | 1 = 0, a: Fleet = rowsFleet(), b: Fleet = rowsFleet()): Game {
  let g = newGame(starter);
  g = confirmFleet(setFleet(g, starter === 0 ? a : b));
  g = confirmFleet(setFleet(g, starter === 0 ? b : a));
  return g;
}

describe('placement geometry', () => {
  it('covers cells horizontally and vertically', () => {
    expect(cellsFor({ id: 'schooner', row: 0, col: 0, orient: 'h' })).toEqual([0, 1, 2, 3]);
    expect(cellsFor({ id: 'schooner', row: 0, col: 0, orient: 'v' })).toEqual([0, 7, 14, 21]);
    expect(cellsFor({ id: 'tug', row: 6, col: 5, orient: 'h' })).toEqual([47, 48]);
    expect(cellsFor({ id: 'tug', row: 5, col: 6, orient: 'v' })).toEqual([41, 48]);
  });

  it('rejects out-of-bounds placements in both orientations', () => {
    expect(cellsFor({ id: 'schooner', row: 0, col: 4, orient: 'h' })).toBeNull();
    expect(cellsFor({ id: 'schooner', row: 4, col: 0, orient: 'v' })).toBeNull();
    expect(cellsFor({ id: 'tug', row: 6, col: 6, orient: 'h' })).toBeNull();
    expect(cellsFor({ id: 'tug', row: 6, col: 6, orient: 'v' })).toBeNull();
    expect(cellsFor({ id: 'tug', row: -1, col: 0, orient: 'h' })).toBeNull();
    expect(cellsFor({ id: 'tug', row: 0, col: 7, orient: 'v' })).toBeNull();
    expect(canPlace([], { id: 'schooner', row: 0, col: 3, orient: 'h' })).toBe(true);
    expect(canPlace([], { id: 'schooner', row: 0, col: 4, orient: 'h' })).toBe(false);
    expect(canPlace([], { id: 'schooner', row: 3, col: 0, orient: 'v' })).toBe(true);
    expect(canPlace([], { id: 'schooner', row: 4, col: 0, orient: 'v' })).toBe(false);
  });

  it('clips the preview to the board for invalid spots', () => {
    expect(previewCells({ id: 'schooner', row: 0, col: 5, orient: 'h' })).toEqual([5, 6]);
    expect(previewCells({ id: 'ferry', row: 5, col: 0, orient: 'v' })).toEqual([35, 42]);
  });

  it('rejects overlaps but allows touching', () => {
    const fleet = placeShip([], { id: 'schooner', row: 2, col: 1, orient: 'h' }); // 15..18
    expect(canPlace(fleet, { id: 'ferry', row: 0, col: 3, orient: 'v' })).toBe(false); // crosses 17
    expect(canPlace(fleet, { id: 'ferry', row: 2, col: 4, orient: 'h' })).toBe(false); // shares 18
    expect(canPlace(fleet, { id: 'ferry', row: 3, col: 1, orient: 'h' })).toBe(true); // touches below
    expect(canPlace(fleet, { id: 'ferry', row: 2, col: 5, orient: 'h' }) ).toBe(false); // off edge (5,6,7)
    expect(canPlace(fleet, { id: 'tug', row: 2, col: 5, orient: 'h' })).toBe(true); // touches end
  });

  it('placeShip returns the same fleet on illegal moves and moves a boat when re-placed', () => {
    const a = placeShip([], { id: 'tug', row: 0, col: 0, orient: 'h' });
    expect(placeShip(a, { id: 'skiff', row: 0, col: 1, orient: 'v' })).toBe(a);
    expect(placeShip(a, { id: 'skiff', row: 6, col: 6, orient: 'h' })).toBe(a);
    // Moving the same boat ignores its own old cells.
    const moved = placeShip(a, { id: 'tug', row: 0, col: 1, orient: 'h' });
    expect(moved).toHaveLength(1);
    expect(cellsFor(moved[0])).toEqual([1, 2]);
  });

  it('finds, removes and counts boats', () => {
    const f = rowsFleet();
    expect(shipAt(f, indexOf(1, 2))?.id).toBe('ferry');
    expect(shipAt(f, indexOf(6, 6))).toBeUndefined();
    expect(occupied(f).size).toBe(FLEET_CELLS);
    expect(removeShip(f, 'ferry').map((p) => p.id)).not.toContain('ferry');
  });

  it('only calls a fleet complete when every boat is placed once and legally', () => {
    const f = rowsFleet();
    expect(isFleetComplete(f)).toBe(true);
    expect(isFleetComplete(f.slice(1))).toBe(false);
    expect(isFleetComplete([...f.slice(1), { ...f[1] }])).toBe(false); // duplicate ferry, no schooner
    const overlapping = f.map((p) => (p.id === 'tug' ? { ...p, row: 0 } : p));
    expect(isFleetComplete(overlapping)).toBe(false);
    const offBoard = f.map((p) => (p.id === 'schooner' ? { ...p, col: 5 } : p));
    expect(isFleetComplete(offBoard)).toBe(false);
  });
});

describe('random fleet', () => {
  it('is always complete and legal across many seeds', () => {
    for (let seed = 0; seed < 500; seed++) {
      const f = randomFleet(createRng(seed));
      expect(isFleetComplete(f)).toBe(true);
      expect(occupied(f).size).toBe(FLEET_CELLS);
      for (const p of f) expect(cellsFor(p)).not.toBeNull();
    }
  });

  it('is reproducible for a seed and varies between seeds', () => {
    expect(randomFleet(createRng('a'))).toEqual(randomFleet(createRng('a')));
    const shapes = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(randomFleet(createRng(i)))));
    expect(shapes.size).toBeGreaterThan(15);
  });

  it('uses both orientations', () => {
    const orients = new Set<string>();
    for (let seed = 0; seed < 30; seed++) for (const p of randomFleet(createRng(seed))) orients.add(p.orient);
    expect(orients).toEqual(new Set(['h', 'v']));
  });
});

describe('setup flow', () => {
  it('starter places first, then the other player, then the starter fires', () => {
    let g = newGame(0);
    expect(g.phase).toBe('setup');
    expect(g.turn).toBe(0);
    expect(confirmFleet(g)).toBe(g); // empty fleet cannot be confirmed
    g = setFleet(g, rowsFleet().slice(0, 4));
    expect(confirmFleet(g)).toBe(g); // incomplete
    g = confirmFleet(setFleet(g, rowsFleet()));
    expect(g.turn).toBe(1);
    expect(g.phase).toBe('setup');
    expect(g.fleets[1]).toEqual([]);
    g = confirmFleet(setFleet(g, randomFleet(createRng(3))));
    expect(g.phase).toBe('battle');
    expect(g.turn).toBe(0);
  });

  it('a rematch with player 2 starting has them place and fire first', () => {
    let g = newGame(1);
    expect(g.turn).toBe(1);
    g = confirmFleet(setFleet(g, rowsFleet()));
    expect(g.turn).toBe(0);
    g = confirmFleet(setFleet(g, rowsFleet()));
    expect(g).toMatchObject({ phase: 'battle', turn: 1 });
  });

  it('setFleet does nothing once battle has started', () => {
    const g = battleReady();
    expect(setFleet(g, [])).toBe(g);
  });
});

describe('battle', () => {
  it('detects hits and misses and alternates turns', () => {
    let g = battleReady(0);
    let r = fire(g, indexOf(0, 0)); // P1 hits P2's schooner
    expect(r.outcome).toEqual({ kind: 'hit', sunk: null, won: false });
    g = r.game;
    expect(g.turn).toBe(1);
    r = fire(g, indexOf(6, 6)); // P2 misses (row 6 empty)
    expect(r.outcome).toEqual({ kind: 'miss' });
    g = r.game;
    expect(g.turn).toBe(0);
    expect(targetMarks(g, 0)[0]).toBe('hit');
    expect(targetMarks(g, 1)[48]).toBe('miss');
    expect(targetMarks(g, 0)[48]).toBeNull();
  });

  it('rejects repeat and out-of-range shots without changing state or turn', () => {
    let g = battleReady(0);
    g = fire(g, 10).game; // P1
    g = fire(g, 20).game; // P2
    const before = g;
    const rep = fire(g, 10);
    expect(rep.outcome.kind).toBe('repeat');
    expect(rep.game).toBe(before);
    expect(rep.game.turn).toBe(0);
    expect(fire(g, -1).outcome.kind).toBe('invalid');
    expect(fire(g, CELLS).outcome.kind).toBe('invalid');
    expect(fire(g, 1.5).game).toBe(before);
    // P1 may fire at a cell P2 already shot at on the other board.
    expect(fire(g, 20).outcome.kind).not.toBe('repeat');
  });

  it('cannot fire during setup or after the game', () => {
    const g = newGame();
    expect(fire(g, 0)).toEqual({ game: g, outcome: { kind: 'invalid' } });
  });

  it('reports a sunk boat exactly once, on the finishing shot', () => {
    let g = battleReady(0);
    // Tug is on row 3 (cells 21, 22).
    g = fire(g, 21).game;
    g = fire(g, 48).game; // P2 misses
    const r = fire(g, 22);
    expect(r.outcome).toEqual({ kind: 'hit', sunk: 'tug', won: false });
    expect(r.game.shots[0].at(-1)).toEqual({ cell: 22, hit: true, sunk: 'tug' });
    expect(sunkPlacements(r.game, 0).map((p) => p.id)).toEqual(['tug']);
    expect(sunkPlacements(r.game, 1)).toEqual([]);
  });

  it('declares victory when every opposing boat is sunk and blocks further shots', () => {
    let g = battleReady(0);
    const targets = [...occupied(rowsFleet())];
    let p2Miss = indexOf(5, 0); // rows 5–6 are open water
    let last = fire(g, targets[0]);
    for (let k = 0; k < targets.length; k++) {
      last = fire(g, targets[k]);
      g = last.game;
      if (k < targets.length - 1) {
        expect(g.phase).toBe('battle');
        g = fire(g, p2Miss++).game; // P2 wastes a shot
      }
    }
    expect(last.outcome).toMatchObject({ kind: 'hit', won: true });
    expect(g.phase).toBe('over');
    expect(g.winner).toBe(0);
    expect(fire(g, 48).outcome.kind).toBe('invalid');
    const s = stats(g, 0);
    expect(s).toEqual({ shots: FLEET_CELLS, hits: FLEET_CELLS, accuracy: 100, sunk: FLEET.length });
    const s2 = stats(g, 1);
    expect(s2.shots).toBe(FLEET_CELLS - 1);
    expect(s2.hits).toBe(0);
    expect(s2.accuracy).toBe(0);
  });

  it('player 2 can win too', () => {
    let g = battleReady(0);
    const targets = [...occupied(rowsFleet())];
    let miss = indexOf(5, 0);
    for (const t of targets) {
      g = fire(g, miss++).game; // P1 misses
      g = fire(g, t).game;
    }
    expect(g.phase).toBe('over');
    expect(g.winner).toBe(1);
  });

  it('computes accuracy', () => {
    let g = battleReady(0);
    g = fire(g, 0).game; // hit
    g = fire(g, 48).game;
    g = fire(g, 47).game; // miss
    g = fire(g, 46).game;
    g = fire(g, 1).game; // hit
    expect(stats(g, 0)).toEqual({ shots: 3, hits: 2, accuracy: 67, sunk: 0 });
    expect(stats(g, 1)).toEqual({ shots: 2, hits: 0, accuracy: 0, sunk: 0 });
  });
});

describe('restored state validation', () => {
  it('accepts a real game and rejects junk', () => {
    expect(isValidGame(newGame())).toBe(true);
    expect(isValidGame(battleReady())).toBe(true);
    expect(isValidGame(null)).toBe(false);
    expect(isValidGame({ phase: 'nope' })).toBe(false);
    expect(isValidGame({ ...newGame(), fleets: [[]] })).toBe(false);
  });
});

it('board constants fit the fleet', () => {
  expect(SIZE).toBe(7);
  expect(FLEET_CELLS).toBe(14);
});
