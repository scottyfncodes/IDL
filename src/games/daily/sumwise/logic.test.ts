import { addDays, LAUNCH_DATE } from '../../../lib/date';
import {
  evaluate,
  frac,
  fToString,
  finishRound,
  generatePuzzle,
  hitsTarget,
  initialState,
  isDone,
  isWin,
  minTilesNeeded,
  popToken,
  pushToken,
  reachableWithAtMost,
  resultFor,
  ROUND_SPECS,
  setExpr,
  solve,
  tokensToString,
  usedTiles,
  type Op,
  type Token,
} from './logic';

/** Tiny helper: build tokens from a string like "0 + 1 * ( 2 - 3 )" where digits are tile indices. */
function toks(src: string): Token[] {
  return src
    .split(/\s+/)
    .filter(Boolean)
    .map((p): Token => {
      if (p === '(') return { t: 'lp' };
      if (p === ')') return { t: 'rp' };
      if ('+-*/'.includes(p)) return { t: 'op', op: p as Op };
      return { t: 'num', tile: Number(p) };
    });
}
const val = (src: string, values: number[]) => {
  const r = evaluate(toks(src), values);
  return r.ok ? fToString(r.value) : `!${r.error}`;
};

describe('sumwise fractions', () => {
  it('normalises sign and lowest terms', () => {
    expect(frac(6, -4)).toEqual({ n: -3n, d: 2n });
    expect(frac(0, 5)).toEqual({ n: 0n, d: 1n });
    expect(() => frac(1, 0)).toThrow();
  });
});

describe('sumwise parser and evaluator', () => {
  it('applies × before + (2 + 3 × 4 = 14)', () => {
    expect(val('0 + 1 * 2', [2, 3, 4])).toBe('14');
    expect(val('0 * 1 + 2', [2, 3, 4])).toBe('10');
  });

  it('evaluates equal precedence left to right', () => {
    expect(val('0 - 1 - 2', [10, 3, 2])).toBe('5');
    expect(val('0 / 1 / 2', [100, 5, 2])).toBe('10');
    expect(val('0 / 1 * 2', [8, 2, 4])).toBe('16');
    expect(val('0 - 1 + 2', [10, 3, 2])).toBe('9');
  });

  it('respects brackets, including nested ones', () => {
    expect(val('( 0 + 1 ) * 2', [2, 3, 4])).toBe('20');
    expect(val('0 - ( 1 - 2 )', [10, 3, 2])).toBe('9');
    expect(val('( ( 0 + 1 ) * ( 2 - 3 ) )', [1, 2, 9, 4])).toBe('15');
  });

  it('keeps exact fractions: (1 ÷ 3) × 3 = 1', () => {
    expect(val('( 0 / 1 ) * 2', [1, 3, 3])).toBe('1');
    expect(val('0 / 1', [1, 3])).toBe('1/3');
    expect(val('0 / 1 + 2 / 3', [1, 2, 1, 3])).toBe('5/6');
    expect(val('0 / ( 1 / 2 )', [6, 3, 4])).toBe('8');
    // A classic that needs fractions: 8 ÷ (3 − 8 ÷ 3) = 24
    expect(val('0 / ( 1 - 2 / 3 )', [8, 3, 8, 3])).toBe('24');
  });

  it('allows negative intermediates', () => {
    expect(val('0 - 1', [3, 5])).toBe('-2');
    expect(val('( 0 - 1 ) * ( 2 - 3 )', [3, 5, 1, 4])).toBe('6');
  });

  it('reports division by zero', () => {
    expect(val('0 / ( 1 - 2 )', [5, 3, 3])).toBe('!divzero');
    expect(val('0 / 1', [5, 0])).toBe('!divzero');
  });

  it('reports incomplete and malformed expressions', () => {
    expect(val('', [1])).toBe('!empty');
    expect(val('0 +', [1, 2])).toBe('!incomplete');
    expect(val('(', [1])).toBe('!incomplete');
    expect(val('( 0 + 1', [1, 2])).toBe('!unclosed');
    expect(val('0 )', [1])).toBe('!extra-close');
    expect(val('( 0 ) )', [1])).toBe('!extra-close');
    expect(val('0 1', [1, 2])).toBe('!missing-op');
    expect(val('0 ( 1 )', [1, 2])).toBe('!missing-op');
    expect(val('( 0 ) 1', [1, 2])).toBe('!missing-op');
    expect(val('( 0 1 )', [1, 2])).toBe('!missing-op');
    expect(val('0 + * 1', [1, 2])).toBe('!missing-number');
    expect(val('* 0', [1])).toBe('!missing-number');
    expect(val('( )', [1])).toBe('!missing-number');
    expect(val('- 0', [1])).toBe('!missing-number'); // no unary minus
  });

  it('rejects reusing a tile and unknown tiles', () => {
    expect(val('0 + 0', [5])).toBe('!reused');
    expect(val('0 + 3', [5, 6])).toBe('!bad-tile');
  });

  it('prevents reuse in the builder and returns tiles on backspace', () => {
    let t: Token[] = [];
    t = pushToken(t, { t: 'num', tile: 1 }, 3);
    const same = pushToken(t, { t: 'num', tile: 1 }, 3);
    expect(same).toBe(t);
    expect(pushToken(t, { t: 'num', tile: 9 }, 3)).toBe(t);
    t = pushToken(t, { t: 'op', op: '+' }, 3);
    t = pushToken(t, { t: 'num', tile: 2 }, 3);
    expect([...usedTiles(t)].sort()).toEqual([1, 2]);
    t = popToken(t);
    expect([...usedTiles(t)]).toEqual([1]);
    expect(pushToken(t, { t: 'num', tile: 2 }, 3)).toHaveLength(3);
  });

  it('formats expressions with real glyphs', () => {
    expect(tokensToString(toks('( 0 + 1 ) * 2 / 3 - 0'), [7, 8, 9, 3])).toBe('(7 + 8) × 9 ÷ 3 − 7');
  });

  it('checks hits exactly', () => {
    expect(hitsTarget(toks('0 * 1'), [6, 7], 42)).toBe(true);
    expect(hitsTarget(toks('0 / 1'), [7, 2], 3)).toBe(false); // 7/2 is not 3
    expect(hitsTarget(toks('0 *'), [6, 7], 42)).toBe(false);
  });
});

describe('sumwise solver', () => {
  const check = (values: number[], target: number) => {
    const sol = solve(values, target);
    expect(sol).not.toBeNull();
    expect(hitsTarget(sol!, values, target)).toBe(true);
    return sol!;
  };

  it('finds known solutions', () => {
    check([1, 2, 3], 9); // (1 + 2) × 3
    check([25, 50, 75, 100, 3, 6], 952); // famous hard countdown target
    check([8, 3, 8, 3], 24); // needs a fraction
    check([1, 5, 5, 5], 24); // (5 − 1 ÷ 5) × 5
    check([7], 7);
  });

  it('prefers the fewest tiles', () => {
    expect(usedTiles(check([2, 3, 100, 7], 6)).size).toBe(2);
  });

  it('reports unreachable targets', () => {
    expect(solve([1, 1], 5)).toBeNull();
    expect(solve([2, 2, 2], 100)).toBeNull();
  });

  it('measures the minimum tiles a target needs', () => {
    expect(minTilesNeeded([3, 4, 10], 12, 3)).toBe(2);
    expect(minTilesNeeded([3, 4, 10], 70, 3)).toBe(3);
    expect(minTilesNeeded([3, 4, 10], 999, 3)).toBe(4);
    expect(reachableWithAtMost([2, 3], 2)).toEqual(new Set(['2/1', '3/1', '5/1', '-1/1', '1/1', '6/1', '2/3', '3/2']));
  });
});

describe('sumwise daily puzzles', () => {
  it('is deterministic', () => {
    expect(generatePuzzle('2026-10-14')).toEqual(generatePuzzle('2026-10-14'));
    expect(generatePuzzle(LAUNCH_DATE)).toEqual(generatePuzzle(LAUNCH_DATE));
    expect(generatePuzzle('2026-10-14')).not.toEqual(generatePuzzle('2026-10-15'));
  });

  it('is pinned for launch day and 2026-10-14', () => {
    const pin = (d: string) => generatePuzzle(d).rounds.map((r) => `${r.tiles.join(' ')} -> ${r.target}`);
    expect(pin(LAUNCH_DATE)).toEqual(PINNED_LAUNCH);
    expect(pin('2026-10-14')).toEqual(PINNED_1014);
  });

  it('publishes 400 days of valid, solvable, non-trivial targets', () => {
    for (let i = 0; i < 400; i++) {
      const date = addDays(LAUNCH_DATE, i);
      const p = generatePuzzle(date);
      expect(p.rounds).toHaveLength(3);
      p.rounds.forEach((r, k) => {
        const spec = ROUND_SPECS[k];
        expect(r.label).toBe(spec.label);
        expect(r.tiles).toHaveLength(spec.small + spec.mid + spec.big);
        expect(r.tiles.every((t) => Number.isInteger(t) && t >= 1 && t <= 100)).toBe(true);
        expect(r.target).toBeGreaterThanOrEqual(spec.min);
        expect(r.target).toBeLessThanOrEqual(spec.max);
        // Stored solution is valid under the game's own evaluator.
        expect(hitsTarget(r.solution, r.tiles, r.target)).toBe(true);
        // Independent exhaustive solver agrees the target is reachable…
        const sol = solve(r.tiles, r.target);
        expect(sol && hitsTarget(sol, r.tiles, r.target)).toBe(true);
        // …and that it really needs at least spec.minTiles tiles.
        expect(usedTiles(sol!).size).toBeGreaterThanOrEqual(spec.minTiles);
      });
    }
  }, 60_000);
});

describe('sumwise play state', () => {
  it('advances through rounds and scores spoiler-free', () => {
    let s = initialState(3);
    s = setExpr(s, toks('0 + 1'));
    expect(s.exprs[0]).toHaveLength(3);
    s = finishRound(s, 'hit');
    s = finishRound(s, 'skipped');
    expect(isDone(s)).toBe(false);
    s = finishRound(s, 'hit');
    expect(isDone(s)).toBe(true);
    expect(finishRound(s, 'hit')).toBe(s);
    expect(setExpr(s, [])).toBe(s);
    expect(resultFor(s)).toEqual({ score: '2/3 targets', grid: ['🎯⬜🎯'] });
    expect(isWin(s)).toBe(true);
    expect(isWin({ ...s, outcomes: ['hit', 'skipped', 'skipped'] })).toBe(false);
  });
});

const PINNED_LAUNCH = ["1 1 4 10 14 -> 70", "1 4 7 8 9 100 -> 110", "2 4 10 10 25 75 -> 345"];
const PINNED_1014 = ["3 5 8 10 13 -> 55", "2 4 5 10 10 100 -> 148", "6 8 9 10 50 100 -> 306"];
