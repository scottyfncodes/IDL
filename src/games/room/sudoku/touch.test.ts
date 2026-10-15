import { cellFromPoint } from './touch';

const rect = { left: 10, top: 100, width: 360, height: 360 }; // 40px per cell

describe('cellFromPoint', () => {
  it('maps points to row-major cell indexes', () => {
    expect(cellFromPoint(rect, 10 + 20, 100 + 20)).toBe(0);
    expect(cellFromPoint(rect, 10 + 359, 100 + 359)).toBe(80);
    expect(cellFromPoint(rect, 10 + 4 * 40 + 5, 100 + 2 * 40 + 5)).toBe(2 * 9 + 4);
  });

  it('has no dead zones: grid lines resolve to a neighbouring cell', () => {
    // Exactly on the line between columns 2 and 3 (and rows 5 and 6).
    expect(cellFromPoint(rect, 10 + 3 * 40, 100 + 6 * 40)).toBe(6 * 9 + 3);
    expect(cellFromPoint(rect, 10 + 3 * 40 - 0.5, 100 + 6 * 40 - 0.5)).toBe(5 * 9 + 2);
  });

  it('clamps the far edges and rejects points outside the board', () => {
    expect(cellFromPoint(rect, 370, 460)).toBe(80);
    expect(cellFromPoint(rect, 9, 200)).toBeNull();
    expect(cellFromPoint(rect, 200, 461)).toBeNull();
    expect(cellFromPoint({ left: 0, top: 0, width: 0, height: 0 }, 0, 0)).toBeNull();
  });
});
