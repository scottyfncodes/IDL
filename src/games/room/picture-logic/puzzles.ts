import { PICTURES_10, PICTURES_5, type PictureDef } from './content';
import { deriveClues, parseBitmap, type Bitmap, type Clues } from './logic';

export type SizeId = '5x5' | '10x10';

export interface Puzzle {
  id: string;
  title: string;
  size: number;
  sizeId: SizeId;
  /** 1-based number within its size, for labels. */
  number: number;
  bitmap: Bitmap;
  clues: Clues;
}

const build = (defs: PictureDef[], size: number, sizeId: SizeId): Puzzle[] =>
  defs.map((d, k) => {
    const bitmap = parseBitmap(d.rows);
    return { id: d.id, title: d.title, size, sizeId, number: k + 1, bitmap, clues: deriveClues(bitmap, size) };
  });

export const PUZZLES_5 = build(PICTURES_5, 5, '5x5');
export const PUZZLES_10 = build(PICTURES_10, 10, '10x10');
export const ALL_PUZZLES: (Puzzle & { rows: string[] })[] = [...PUZZLES_5, ...PUZZLES_10].map((p) => ({
  ...p,
  rows: [...PICTURES_5, ...PICTURES_10].find((d) => d.id === p.id)!.rows,
}));
export const puzzleById = (id: string | null | undefined) => ALL_PUZZLES.find((p) => p.id === id);
export const SIZE_LABEL: Record<SizeId, string> = { '5x5': '5 × 5', '10x10': '10 × 10' };

/**
 * The next unsolved puzzle after `afterId` (wrapping), preferring the same
 * size, then any size. Null when everything is solved.
 */
export function nextUnsolved(solved: ReadonlySet<string>, afterId?: string | null): Puzzle | null {
  const list = ALL_PUZZLES;
  const at = afterId ? list.findIndex((p) => p.id === afterId) : -1;
  const size = at >= 0 ? list[at].size : null;
  const order = list.map((_, k) => list[(at + 1 + k) % list.length]);
  return order.find((p) => !solved.has(p.id) && (size === null || p.size === size)) ?? order.find((p) => !solved.has(p.id)) ?? null;
}
