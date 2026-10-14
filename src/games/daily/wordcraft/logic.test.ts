import { addDays, LAUNCH_DATE } from '../../../lib/date';
import {
  ANSWERS,
  MAX_GUESSES,
  VALID_GUESSES,
  answerFor,
  answerOrder,
  checkGuess,
  evaluate,
  keyStates,
  resultFor,
  statusOf,
  type Mark,
} from './logic';
import mod from './index';

const C: Mark = 'correct';
const P: Mark = 'present';
const A: Mark = 'absent';

describe('wordcraft evaluate', () => {
  it('marks an exact match all correct', () => {
    expect(evaluate('crane', 'crane')).toEqual([C, C, C, C, C]);
  });

  it('marks letters not in the answer absent', () => {
    expect(evaluate('fghij', 'crane')).toEqual([A, A, A, A, A]);
  });

  it('marks misplaced letters present', () => {
    expect(evaluate('nacre', 'crane')).toEqual([P, P, P, P, C]);
  });

  it('is case and whitespace insensitive', () => {
    expect(evaluate(' CRANE', 'crane ')).toEqual([C, C, C, C, C]);
  });

  it('answer apple, guess paper', () => {
    expect(evaluate('paper', 'apple')).toEqual([P, P, C, P, A]);
  });

  it('answer abbey, guess babes', () => {
    expect(evaluate('babes', 'abbey')).toEqual([P, P, C, C, A]);
  });

  it('greens consume a letter before yellows are assigned', () => {
    // Only one E in CRANE and it is matched exactly, so earlier Es are absent.
    expect(evaluate('eerie', 'crane')).toEqual([A, A, P, A, C]);
  });

  it('yellows are limited to the remaining count, left to right', () => {
    // SPEED has two Es: the first two Es of EERIE are present, the third is absent.
    expect(evaluate('eerie', 'speed')).toEqual([P, P, A, A, A]);
  });

  it('handles repeated letters in guess where answer has one copy', () => {
    expect(evaluate('lllll', 'hello')).toEqual([A, A, C, C, A]);
    expect(evaluate('geese', 'those')).toEqual([A, A, A, C, C]);
    expect(evaluate('sassy', 'those')).toEqual([A, A, A, C, A]);
  });

  it('handles repeated letters in both', () => {
    expect(evaluate('boost', 'robot')).toEqual([P, C, P, A, C]);
    expect(evaluate('error', 'mirror'.slice(1))).toEqual([A, C, C, C, C]);
    expect(evaluate('allay', 'llama')).toEqual([P, C, P, P, A]);
  });

  it('never marks more of a letter than the answer contains', () => {
    for (const [g, a] of [['paper', 'apple'], ['babes', 'abbey'], ['eerie', 'speed'], ['lllll', 'hello'], ['mamma', 'llama']]) {
      const marks = evaluate(g, a);
      for (const letter of new Set(g)) {
        const shown = [...g].filter((l, i) => l === letter && marks[i] !== 'absent').length;
        const inAnswer = [...a].filter((l) => l === letter).length;
        expect(shown).toBe(Math.min(inAnswer, [...g].filter((l) => l === letter).length));
      }
    }
  });

  it('throws on mismatched lengths', () => {
    expect(() => evaluate('cat', 'crane')).toThrow();
  });
});

describe('wordcraft guess checking', () => {
  it('rejects wrong lengths and non-letters', () => {
    expect(checkGuess('cran')).toBe('length');
    expect(checkGuess('cranes')).toBe('length');
    expect(checkGuess('')).toBe('length');
    expect(checkGuess('cr4ne')).toBe('length');
  });

  it('rejects words not in the list', () => {
    expect(checkGuess('zzzzz')).toBe('unknown');
    expect(checkGuess('qwert')).toBe('unknown');
  });

  it('accepts listed guesses regardless of case', () => {
    expect(checkGuess('CRANE')).toBeNull();
    expect(checkGuess('abbey')).toBeNull();
  });

  it('accepts every answer as a guess', () => {
    for (const a of ANSWERS) expect(VALID_GUESSES.has(a)).toBe(true);
  });
});

describe('wordcraft answer lists', () => {
  it('answers are unique lowercase five-letter words', () => {
    expect(ANSWERS.length).toBeGreaterThan(800);
    expect(new Set(ANSWERS).size).toBe(ANSWERS.length);
    for (const a of ANSWERS) expect(a).toMatch(/^[a-z]{5}$/);
  });

  it('the order is a permutation of the answers', () => {
    const order = answerOrder();
    expect(order.length).toBe(ANSWERS.length);
    expect(new Set(order)).toEqual(new Set(ANSWERS));
  });

  it('does not repeat an answer within one full cycle', () => {
    const seen = new Set<string>();
    for (let i = 0; i < ANSWERS.length; i++) seen.add(answerFor(addDays(LAUNCH_DATE, i)));
    expect(seen.size).toBe(ANSWERS.length);
  });

  it('is stable for pinned dates', () => {
    expect(answerFor(LAUNCH_DATE)).toBe('motor');
    expect(answerFor('2026-10-14')).toBe('world');
  });

  it('getPuzzle is deterministic', () => {
    expect(mod.getPuzzle('2026-10-14')).toEqual(mod.getPuzzle('2026-10-14'));
    expect(mod.getPuzzle('2026-10-14').answer).toBe(answerFor('2026-10-14'));
  });
});

describe('wordcraft progress', () => {
  it('reports status', () => {
    expect(statusOf([], 'crane')).toBe('playing');
    expect(statusOf(['slate', 'crane'], 'crane')).toBe('won');
    expect(statusOf(Array(MAX_GUESSES).fill('slate'), 'crane')).toBe('lost');
    expect(statusOf(Array(5).fill('slate'), 'crane')).toBe('playing');
  });

  it('keeps the best state per key', () => {
    const ks = keyStates(['nacre', 'crane'], 'crane');
    expect(ks.c).toBe('correct');
    expect(ks.n).toBe('correct');
    const ks2 = keyStates(['eerie'], 'speed');
    expect(ks2.e).toBe('present');
    expect(ks2.r).toBe('absent');
    // a later present never downgrades an earlier correct
    const ks3 = keyStates(['crane', 'nacre'], 'crane');
    expect(ks3.n).toBe('correct');
    expect(ks3.a).toBe('correct');
  });

  it('builds a spoiler-free result', () => {
    const win = resultFor(['slate', 'crane'], 'crane');
    expect(win.score).toBe('2/6');
    expect(win.grid).toEqual(['⬜⬜🟩⬜🟩', '🟩🟩🟩🟩🟩']);
    const loss = resultFor(Array(6).fill('slate'), 'crane');
    expect(loss.score).toBe('X/6');
    expect(loss.grid).toHaveLength(6);
    for (const line of [...win.grid, ...loss.grid]) expect(line).not.toMatch(/[a-z]/i);
  });
});
