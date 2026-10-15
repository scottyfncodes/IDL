/**
 * Map a point to the Sudoku cell beneath it using the board's bounds.
 * Every point on the board — including the grid lines between squares —
 * resolves to a cell, so there are no dead zones for fingers. Returns null
 * only when the point is outside the board.
 */
export function cellFromPoint(rect: { left: number; top: number; width: number; height: number }, x: number, y: number): number | null {
  if (rect.width <= 0 || rect.height <= 0) return null;
  const fx = (x - rect.left) / rect.width;
  const fy = (y - rect.top) / rect.height;
  if (fx < 0 || fy < 0 || fx > 1 || fy > 1) return null;
  const col = Math.min(8, Math.floor(fx * 9));
  const row = Math.min(8, Math.floor(fy * 9));
  return row * 9 + col;
}
