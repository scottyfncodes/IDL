import { addDays, LAUNCH_DATE, type EditionDate } from '../../../lib/date';
import { hashString } from '../../../lib/rng';
import {
  adjacent,
  boardFor,
  boardProblems,
  generateBoard,
  isSolved,
  ruleHolds,
  solutionProblems,
  solve,
  TIERS,
  type Board,
  type Placement,
  type Rule,
  type Tier,
} from './logic';
import { TUTORIAL } from './tutorial';

/**
 * Brute force that shares no code with the solver: enumerate every domino
 * tiling of the board, then every assignment of tray dominoes (each way round)
 * to that tiling, and count distinct cell-value answers that meet every rule.
 * Only practical for small boards.
 */
function bruteForceAnswers(board: Board, cap = 5): number {
  const cells = new Set(board.cells);
  const tilings: [number, number][][] = [];
  const tile = (left: Set<number>, acc: [number, number][]) => {
    if (!left.size) return void tilings.push(acc.slice());
    const c = Math.min(...left);
    for (const n of [c + 1, c + board.w]) {
      if (!left.has(n) || !adjacent(board.w, c, n)) continue;
      const next = new Set(left);
      next.delete(c);
      next.delete(n);
      acc.push([c, n]);
      tile(next, acc);
      acc.pop();
    }
  };
  tile(cells, []);
  const answers = new Set<string>();
  const n = board.dominoes.length;
  for (const pairs of tilings) {
    const used = new Array<boolean>(n).fill(false);
    const vals = new Map<number, number>();
    const assign = (k: number) => {
      if (answers.size >= cap) return;
      if (k === pairs.length) {
        const ok = board.regions.every((r) => ruleHolds(r.rule, r.cells.map((c) => vals.get(c)!)));
        if (ok) answers.add(board.cells.map((c) => vals.get(c)).join(''));
        return;
      }
      const [a, b] = pairs[k];
      for (let d = 0; d < n; d++) {
        if (used[d]) continue;
        used[d] = true;
        const [x, y] = board.dominoes[d];
        for (const [va, vb] of x === y ? [[x, y]] : [[x, y], [y, x]]) {
          vals.set(a, va);
          vals.set(b, vb);
          assign(k + 1);
        }
        used[d] = false;
      }
    };
    assign(0);
  }
  return answers.size;
}

const days = (n: number, from: EditionDate = LAUNCH_DATE) => Array.from({ length: n }, (_, i) => addDays(from, i));
const singles = (b: Board) => b.regions.filter((r) => r.cells.length === 1).length;

describe('rules', () => {
  const cases: [Rule, number[], boolean][] = [
    [{ kind: 'sum', n: 7 }, [3, 4], true],
    [{ kind: 'sum', n: 7 }, [3, 3], false],
    [{ kind: 'lt', n: 4 }, [1, 2], true],
    [{ kind: 'lt', n: 3 }, [1, 2], false],
    [{ kind: 'gt', n: 9 }, [5, 5], true],
    [{ kind: 'gt', n: 10 }, [5, 5], false],
    [{ kind: 'eq' }, [2, 2, 2], true],
    [{ kind: 'eq' }, [2, 2, 3], false],
    [{ kind: 'ne' }, [0, 1, 6], true],
    [{ kind: 'ne' }, [0, 1, 0], false],
  ];
  it.each(cases)('%j over %j → %s', (rule, values, expected) => {
    expect(ruleHolds(rule, values)).toBe(expected);
  });
});

describe('tutorial board', () => {
  it('is well formed with exactly one answer, by solver and by brute force', () => {
    expect(boardProblems(TUTORIAL)).toEqual([]);
    expect(solve(TUTORIAL, 5).count).toBe(1);
    expect(bruteForceAnswers(TUTORIAL)).toBe(1);
  });
});

describe('solution checker', () => {
  const board = TUTORIAL;
  const good = board.solution;

  it('accepts the solution, in any order', () => {
    expect(isSolved(board, good)).toBe(true);
    expect(isSolved(board, good.slice().reverse())).toBe(true);
  });

  it('rejects missing, duplicated, overlapping, detached and off-board dominoes', () => {
    expect(solutionProblems(board, good.slice(1))).toContain('1 dominoes not placed');
    expect(isSolved(board, [...good.slice(1), { ...good[1] }])).toBe(false); // domino 1 twice, 0 missing
    expect(isSolved(board, [good[0], good[1], { d: 2, a: 1, b: 2 }])).toBe(false); // overlap
    expect(solutionProblems(board, [good[0], good[1], { d: 2, a: 4, b: 2 }])).toContain('domino 2 halves not adjacent');
    expect(solutionProblems(board, [good[0], good[1], { d: 2, a: 5, b: 6 }])).toContain('domino 2 off the board');
  });

  it('rejects a full board that breaks a rule', () => {
    // Swap the 8 domino end for end: 4 and 5 trade places.
    const flipped: Placement[] = [good[0], { d: 1, a: 2, b: 1 }, good[2]];
    expect(solutionProblems(board, flipped).some((p) => p.includes('not met'))).toBe(true);
  });

  it('accepts a double laid either way round', () => {
    const b: Board = { w: 2, h: 1, cells: [0, 1], regions: [{ cells: [0, 1], rule: { kind: 'eq' } }], dominoes: [[3, 3]], solution: [{ d: 0, a: 0, b: 1 }] };
    expect(isSolved(b, [{ d: 0, a: 1, b: 0 }])).toBe(true);
  });
});

describe('solver', () => {
  it('counts every distinct answer when rules are loose', () => {
    // Two free cells, one domino: both ways round are answers.
    const b: Board = { w: 2, h: 1, cells: [0, 1], regions: [], dominoes: [[1, 2]], solution: [{ d: 0, a: 0, b: 1 }] };
    expect(solve(b, 5).count).toBe(2);
    expect(bruteForceAnswers(b)).toBe(2);
  });

  it('treats different pairings with the same numbers as one answer', () => {
    // 2×2 square with values 1 2 / 2 3: across or down gives the same dominoes and numbers.
    const b: Board = {
      w: 2,
      h: 2,
      cells: [0, 1, 2, 3],
      regions: [
        { cells: [0], rule: { kind: 'sum', n: 1 } },
        { cells: [3], rule: { kind: 'sum', n: 3 } },
      ],
      dominoes: [[1, 2], [2, 3]],
      solution: [{ d: 0, a: 0, b: 1 }, { d: 1, a: 2, b: 3 }],
    };
    expect(solve(b, 5).count).toBe(1);
  });

  it('agrees with brute force on generated easy boards', () => {
    for (const date of days(20)) {
      const b = boardFor(date, 'easy');
      expect(bruteForceAnswers(b)).toBe(1);
    }
  });
});

describe('generated boards', () => {
  const RANGE: Record<Tier, { dominoes: [number, number]; days: number }> = {
    easy: { dominoes: [5, 6], days: 240 },
    medium: { dominoes: [8, 9], days: 160 },
    hard: { dominoes: [11, 12], days: 60 },
  };

  for (const tier of TIERS) {
    it(`${tier}: ${RANGE[tier].days} consecutive days are valid, unique and on tier`, () => {
      for (const date of days(RANGE[tier].days)) {
        const b = boardFor(date, tier);
        const where = `${tier} ${date}`;
        expect(boardProblems(b), where).toEqual([]);
        const s = solve(b, 2);
        expect(s.aborted, where).toBe(false);
        expect(s.count, where).toBe(1);
        expect(b.dominoes.length, where).toBeGreaterThanOrEqual(RANGE[tier].dominoes[0]);
        expect(b.dominoes.length, where).toBeLessThanOrEqual(RANGE[tier].dominoes[1]);
        // Never a page of givens.
        expect(singles(b), where).toBeLessThanOrEqual(tier === 'hard' ? 6 : tier === 'medium' ? 4 : 3);
        if (tier === 'easy') expect(s.branches, where).toBe(0);
        if (tier === 'medium') expect(s.branches, where).toBeLessThanOrEqual(6);
        if (tier === 'hard') expect(s.branches, where).toBeGreaterThanOrEqual(12);
      }
    });
  }

  it('gets harder by tier on the same day', () => {
    for (const date of days(30)) {
      const [e, m, h] = TIERS.map((t) => solve(boardFor(date, t), 2).branches);
      expect(e).toBeLessThan(m);
      expect(m).toBeLessThan(h);
    }
  });

  it('is deterministic: the same date always gives the same board', () => {
    const a = boardFor('2026-10-14', 'medium');
    const b = generateBoard('couplet:v1:2026-10-14:medium', 'medium');
    expect(b).toEqual(a);
  });

  const PINS: Record<string, number> = {
    '2026-09-01:easy': 1306835171,
    '2026-10-14:medium': 3438322547,
    '2026-10-26:hard': 284707005,
  };
  // Pinned so a generator change can't silently rewrite published puzzles.
  // Changing the generator means bumping GENERATOR_VERSION (see README).
  it.each([
    ['2026-09-01', 'easy'],
    ['2026-10-14', 'medium'],
    ['2026-10-26', 'hard'],
  ] as const)('pins %s %s', (date, tier) => {
    expect(hashString(JSON.stringify(boardFor(date, tier)))).toBe(PINS[`${date}:${tier}`]);
  });
});
