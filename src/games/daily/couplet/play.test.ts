import type { Board } from './logic';
import { emptyTier, fits, hint, place, placeAt, remove, rotate, view } from './play';
import { TUTORIAL } from './tutorial';

// Tutorial grid:  0 1 2
//                 3 4 5
const B = TUTORIAL;

describe('placing', () => {
  it('places a domino on two adjacent free cells and refuses anything else', () => {
    const p = place(B, [], 0, 3, 0)!;
    expect(p).toEqual([{ d: 0, a: 3, b: 0 }]);
    expect(place(B, p, 1, 0, 1)).toBeNull(); // overlaps
    expect(place(B, p, 1, 1, 5)).toBeNull(); // not adjacent
    expect(place(B, p, 1, 2, 3)).toBeNull(); // wraps a row: not adjacent
    expect(place(B, p, 1, 5, 6)).toBeNull(); // off the board
  });

  it('moves a placed domino rather than duplicating it', () => {
    let p = place(B, [], 0, 3, 0)!;
    p = place(B, p, 0, 4, 5)!;
    expect(p).toEqual([{ d: 0, a: 4, b: 5 }]);
    // Moving onto a spot that overlaps its own old cells is fine.
    expect(fits(B, p, 0, 5, 2)).toBe(true);
  });

  it('remove returns a domino to the tray', () => {
    expect(remove([{ d: 0, a: 3, b: 0 }, { d: 1, a: 1, b: 2 }], 0)).toEqual([{ d: 1, a: 1, b: 2 }]);
  });
});

describe('tap to place', () => {
  it('uses the chosen direction with the tapped cell leading', () => {
    expect(placeAt(B, [], 0, 1, 0, false)).toEqual([{ d: 0, a: 1, b: 2 }]);
    expect(placeAt(B, [], 0, 1, 1, false)).toEqual([{ d: 0, a: 1, b: 4 }]);
  });

  it('falls back to the tapped cell trailing, then other turns, when blocked', () => {
    // Right edge: cell 2 can't lead rightwards, so the domino ends on 2.
    expect(placeAt(B, [], 0, 2, 0, false)).toEqual([{ d: 0, a: 1, b: 2 }]);
    // Cell 5 with 2 and 4 taken: only upward... both blocked, so nothing fits.
    const taken = [{ d: 1, a: 1, b: 2 }, { d: 2, a: 3, b: 4 }];
    expect(placeAt(B, taken, 0, 5, 0, false)).toBeNull();
    // Cell 0 with 1 taken: right is blocked, so it turns downward.
    expect(placeAt(B, [{ d: 1, a: 1, b: 2 }], 0, 0, 0, false)).toEqual([{ d: 1, a: 1, b: 2 }, { d: 0, a: 0, b: 3 }]);
  });
});

describe('rotate', () => {
  it('turns a quarter clockwise around the tapped half, skipping blocked spots', () => {
    // Domino 0 on 3→4 (across). Pivot on 3: next clockwise is down (off board), left (off), up (0).
    expect(rotate(B, [{ d: 0, a: 3, b: 4 }], 0, 3)).toEqual([{ d: 0, a: 3, b: 0 }]);
    // Pivot on 4 (the second half): from 4, the first half sits left; clockwise next is up (1).
    expect(rotate(B, [{ d: 0, a: 3, b: 4 }], 0, 4)).toEqual([{ d: 0, a: 1, b: 4 }]);
  });

  it('flips end for end when it has nowhere to turn', () => {
    const p = [{ d: 0, a: 0, b: 1 }, { d: 1, a: 3, b: 4 }, { d: 2, a: 2, b: 5 }];
    expect(rotate(B, p, 0, 0)).toContainEqual({ d: 0, a: 1, b: 0 });
  });

  it('cycles back to the start after four turns on an open board', () => {
    const open: Board = { w: 3, h: 3, cells: [0, 1, 2, 3, 4, 5, 6, 7, 8], regions: [], dominoes: [[1, 2]], solution: [{ d: 0, a: 4, b: 5 }] };
    let p = [{ d: 0, a: 4, b: 5 }];
    const seen: number[] = [];
    for (let i = 0; i < 4; i++) {
      p = rotate(open, p, 0, 4)!;
      seen.push(p[0].b);
    }
    expect(seen).toEqual([7, 3, 1, 5]); // down, left, up, right
  });
});

describe('view and hints', () => {
  it('reports full/solved and per-region status', () => {
    expect(view(B, []).full).toBe(false);
    const v = view(B, B.solution);
    expect(v.full).toBe(true);
    expect(v.solved).toBe(true);
    expect(v.statuses).toEqual(['met', 'met', 'met']);
    const wrong = view(B, [{ d: 0, a: 3, b: 4 }, { d: 1, a: 1, b: 2 }, { d: 2, a: 0, b: 5 }].slice(0, 2));
    expect(wrong.statuses[2]).toBe('broken'); // 1 + 4 isn't under 3
  });

  it('a hint lays one solution domino, clearing whatever is in its way', () => {
    const state = { ...emptyTier(), placements: [{ d: 2, a: 0, b: 3 }] };
    const h = hint(B, state)!;
    expect(h.hinted).toHaveLength(1);
    const s = B.solution.find((x) => x.d === h.d)!;
    expect(h.placements).toContainEqual(s);
    // No two dominoes share a cell.
    const cells = h.placements.flatMap((p) => [p.a, p.b]);
    expect(new Set(cells).size).toBe(cells.length);
  });

  it('three hints solve the tutorial, then there are none left', () => {
    let state = emptyTier();
    for (let i = 0; i < 3; i++) {
      const h = hint(B, state)!;
      state = { ...state, placements: h.placements, hinted: h.hinted };
    }
    expect(view(B, state.placements).solved).toBe(true);
    expect(hint(B, state)).toBeNull();
  });
});
