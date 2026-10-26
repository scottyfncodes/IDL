import type { Board } from './logic';

/**
 * The first-play board, authored by hand to teach the three ideas that matter:
 * an "=" region, a sum that runs across two dominoes, and a "<" rule. It has
 * exactly one solution (tested).
 *
 *   [ = ][ = ][ 8 ]
 *   [<3 ][<3 ][ 8 ]
 */
export const TUTORIAL: Board = {
  w: 3,
  h: 2,
  cells: [0, 1, 2, 3, 4, 5],
  regions: [
    { cells: [0, 1], rule: { kind: 'eq' } },
    { cells: [2, 5], rule: { kind: 'sum', n: 8 } },
    { cells: [3, 4], rule: { kind: 'lt', n: 3 } },
  ],
  dominoes: [
    [1, 4],
    [4, 5],
    [0, 3],
  ],
  solution: [
    { d: 0, a: 3, b: 0 },
    { d: 1, a: 1, b: 2 },
    { d: 2, a: 4, b: 5 },
  ],
};
