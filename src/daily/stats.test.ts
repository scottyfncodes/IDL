import { saveDaily } from './progress';
import { dailyStats, STAT_SPECS } from './stats';
import { resultFor as linkupResult } from '../games/daily/linkup/logic';
import linkup from '../games/daily/linkup';
import { resultFor as wordcraftResult } from '../games/daily/wordcraft/logic';
import { resultFor as sumwiseResult } from '../games/daily/sumwise/logic';
import { scoreText as deductionScore, type Puzzle as DPuzzle } from '../games/daily/deduction/logic';
import { resultFor as patternResult } from '../games/daily/pattern/logic';
import pattern from '../games/daily/pattern';
import { scoreText as wordstepsScore, type Puzzle as WPuzzle } from '../games/daily/wordsteps/logic';

const D = '2026-10-14';

describe('daily stat buckets follow each game’s real score text', () => {
  it('Linkup', () => {
    const p = linkup.getPuzzle(D);
    const won = (mistakes: number) => linkupResult(p, { order: [], solved: [0, 1, 2, 3], guesses: [], mistakes }).score;
    expect(STAT_SPECS.linkup.bucketOf(won(0), 'won')).toBe('0');
    expect(STAT_SPECS.linkup.bucketOf(won(1), 'won')).toBe('1');
    expect(STAT_SPECS.linkup.bucketOf(won(3), 'won')).toBe('3');
    const lost = linkupResult(p, { order: [], solved: [0], guesses: [], mistakes: 4 }).score;
    expect(STAT_SPECS.linkup.bucketOf(lost, 'lost')).toBe('Missed');
  });

  it('Wordcraft', () => {
    expect(STAT_SPECS.wordcraft.bucketOf(wordcraftResult(['crane', 'world'], 'world').score, 'won')).toBe('2');
    const six = ['crane', 'slate', 'pious', 'dumpy', 'fight', 'bloke'];
    expect(STAT_SPECS.wordcraft.bucketOf(wordcraftResult(six, 'world').score, 'lost')).toBe('X');
  });

  it('Sumwise', () => {
    const score = sumwiseResult({ round: 3, exprs: [[], [], []], outcomes: ['hit', 'skipped', 'hit'] as never }).score;
    expect(STAT_SPECS.sumwise.bucketOf(score, 'won')).toBe('2');
  });

  it('Deduction', () => {
    const p = { culprit: 2 } as DPuzzle;
    expect(STAT_SPECS.deduction.bucketOf(deductionScore(p, { ruledOut: [], accusations: [0, 2] }), 'won')).toBe('2nd');
    expect(STAT_SPECS.deduction.bucketOf(deductionScore(p, { ruledOut: [], accusations: [0, 1, 3] }), 'lost')).toBe('Unsolved');
  });

  it('Pattern', () => {
    const p = pattern.getPuzzle(D) as Parameters<typeof patternResult>[1];
    const picks = p.sequences.map((s) => s.choices.indexOf(s.answer));
    expect(STAT_SPECS.pattern.bucketOf(patternResult({ picks }, p).score, 'won')).toBe('3');
  });

  it('Wordsteps', () => {
    const p = { start: 'cold', end: 'warm', par: 4, solution: ['cold', 'cord', 'card', 'ward', 'warm'] } as WPuzzle;
    expect(STAT_SPECS.wordsteps.bucketOf(wordstepsScore(p, { ladder: ['cord', 'card', 'ward', 'warm'] }), 'won')).toBe('Par');
    expect(STAT_SPECS.wordsteps.bucketOf(wordstepsScore(p, { ladder: ['cord'] }), 'lost')).toBe('Unsolved');
    expect(STAT_SPECS.wordsteps.bucketOf('Solved in 7 · par 5', 'won')).toBe('+2');
    expect(STAT_SPECS.wordsteps.bucketOf('Solved in 3 · par 5', 'won')).toBe('Under');
  });
});

describe('dailyStats', () => {
  it('derives played, solved and a distribution from saved records only', () => {
    saveDaily('wordcraft', '2026-10-10', { status: 'won', state: null, result: { score: '3/6' } });
    saveDaily('wordcraft', '2026-10-11', { status: 'won', state: null, result: { score: '3/6' } });
    saveDaily('wordcraft', '2026-10-12', { status: 'lost', state: null, result: { score: 'X/6' } });
    saveDaily('wordcraft', '2026-10-13', { status: 'playing', state: null });
    saveDaily('linkup', '2026-10-12', { status: 'won', state: null, result: { score: 'Solved · no mistakes' } });
    const s = dailyStats('wordcraft');
    expect(s.played).toBe(3);
    expect(s.won).toBe(2);
    expect(s.distribution.find((d) => d.bucket === '3')?.count).toBe(2);
    expect(s.distribution.find((d) => d.bucket === 'X')?.count).toBe(1);
    expect(s.bucketFor('2026-10-12')).toBe('X');
    expect(s.bucketFor('2026-10-13')).toBeNull();
  });
});
