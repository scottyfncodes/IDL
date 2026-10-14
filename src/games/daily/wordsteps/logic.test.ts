import { addDays, LAUNCH_DATE } from '../../../lib/date';
import {
  applyStep,
  bfs,
  buildGraph,
  changedIndex,
  COMMON_WORDS,
  DICTIONARY,
  EXCLUDED_FROM_PUZZLES,
  EXTRA_MOVES,
  generatePuzzle,
  isOneLetterApart,
  isWord,
  MAX_PAR,
  maxMoves,
  MIN_PAR,
  PUZZLE_WORDS,
  resultGrid,
  scoreText,
  shortestPath,
  status,
  undoStep,
  validateStep,
  type Puzzle,
  type State,
} from './logic';
import mod from './index';

const P: Puzzle = { date: '2026-01-01', start: 'cold', end: 'warm', par: 4, solution: ['cold', 'cord', 'card', 'ward', 'warm'] };

describe('one-letter difference', () => {
  it('finds the single changed index', () => {
    expect(changedIndex('cold', 'cord')).toBe(2);
    expect(changedIndex('cold', 'bold')).toBe(0);
    expect(changedIndex('cold', 'colt')).toBe(3);
  });
  it('rejects zero, two or more changes, rearrangements and length changes', () => {
    expect(changedIndex('cold', 'cold')).toBe(-1);
    expect(changedIndex('cold', 'card')).toBe(-1);
    expect(changedIndex('lead', 'deal')).toBe(-1);
    expect(changedIndex('cold', 'colds')).toBe(-1);
    expect(changedIndex('cold', 'old')).toBe(-1);
    expect(isOneLetterApart('mate', 'male')).toBe(true);
    expect(isOneLetterApart('mate', 'meat')).toBe(false);
  });
});

describe('dictionary', () => {
  it('accepts words from either list and rejects junk', () => {
    expect(isWord('cold')).toBe(true);
    expect(isWord('COLD')).toBe(true);
    expect(isWord('qzxv')).toBe(false);
    // a valid-but-not-common word is accepted
    const extra = [...DICTIONARY].find((w) => !COMMON_WORDS.includes(w));
    expect(extra).toBeDefined();
    expect(isWord(extra!)).toBe(true);
  });
  it('contains only lowercase four-letter words', () => {
    for (const w of DICTIONARY) expect(w).toMatch(/^[a-z]{4}$/);
  });
});

describe('validateStep', () => {
  it('accepts a legal step', () => {
    expect(validateStep('cold', 'cord', ['cold'])).toBeNull();
  });
  it('requires exactly one letter in place', () => {
    expect(validateStep('cold', 'card', ['cold'])).toBe('one-letter');
    expect(validateStep('cold', 'clod', ['cold'])).toBe('one-letter');
  });
  it('requires a dictionary word', () => {
    expect(validateStep('cold', 'cxld', ['cold'])).toBe('not-word');
  });
  it('prevents repeats, including the start word', () => {
    expect(validateStep('cord', 'cold', ['cold', 'cord'])).toBe('used');
    expect(validateStep('cold', 'cold', ['cold'])).toBe('used');
  });
  it('requires four letters', () => {
    expect(validateStep('cold', 'col', ['cold'])).toBe('length');
    expect(validateStep('cold', 'co1d', ['cold'])).toBe('length');
  });
});

describe('BFS on small graphs', () => {
  const words = ['aaaa', 'aaab', 'aabb', 'abbb', 'bbbb', 'aaac', 'zzzz'];
  const g = buildGraph(words);
  it('builds symmetric one-letter edges', () => {
    expect(new Set(g.get('aaaa'))).toEqual(new Set(['aaab', 'aaac']));
    expect(g.get('aaab')).toContain('aaaa');
    expect(new Set(g.get('aaab'))).toEqual(new Set(['aaaa', 'aaac', 'aabb']));
    expect(g.get('zzzz')).toEqual([]);
  });
  it('computes shortest distances', () => {
    const { dist } = bfs(g, 'aaaa');
    expect(dist.get('aaaa')).toBe(0);
    expect(dist.get('aaac')).toBe(1);
    expect(dist.get('aabb')).toBe(2);
    expect(dist.get('bbbb')).toBe(4);
    expect(dist.has('zzzz')).toBe(false);
  });
  it('returns a shortest path or null', () => {
    expect(shortestPath(g, 'aaaa', 'bbbb')).toEqual(['aaaa', 'aaab', 'aabb', 'abbb', 'bbbb']);
    expect(shortestPath(g, 'aaaa', 'zzzz')).toBeNull();
    expect(shortestPath(g, 'aaaa', 'aaaa')).toEqual(['aaaa']);
  });
  it('prefers the shortcut when one exists', () => {
    const g2 = buildGraph(['cold', 'cord', 'card', 'ward', 'warm', 'word', 'worm']);
    // cold-cord-word-worm-warm and cold-cord-card-ward-warm are both 4
    expect(shortestPath(g2, 'cold', 'warm')!.length - 1).toBe(4);
  });
});

describe('play', () => {
  it('applies steps, wins at the end word and blocks further moves', () => {
    let s: State = { ladder: [] };
    for (const w of ['cord', 'card', 'ward', 'warm']) {
      const r = applyStep(P, s, w);
      expect('state' in r).toBe(true);
      if ('state' in r) s = r.state;
    }
    expect(status(P, s)).toBe('won');
    expect(applyStep(P, s, 'farm')).toEqual({ error: 'over' });
    expect(scoreText(P, s)).toBe('Solved in 4 · par 4');
    expect(resultGrid(P, s)).toBe('🟩🟩🟩🟩');
  });
  it('reports step errors without changing state', () => {
    const s: State = { ladder: ['cord'] };
    expect(applyStep(P, s, 'cold')).toEqual({ error: 'used' });
    expect(applyStep(P, s, 'warm')).toEqual({ error: 'one-letter' });
  });
  it('undo removes the last rung but not after finishing', () => {
    expect(undoStep(P, { ladder: ['cord', 'card'] })).toEqual({ ladder: ['cord'] });
    const empty = { ladder: [] };
    expect(undoStep(P, empty)).toBe(empty);
    const won = { ladder: ['cord', 'card', 'ward', 'warm'] };
    expect(undoStep(P, won)).toBe(won);
  });
  it('loses after par + extra moves without reaching the end', () => {
    expect(maxMoves(P)).toBe(4 + EXTRA_MOVES);
    const ladder = ['bold', 'bolt', 'boot', 'boat', 'goat', 'moat', 'meat', 'heat'];
    expect(ladder.length).toBe(maxMoves(P));
    const s = { ladder };
    expect(status(P, s)).toBe('lost');
    expect(scoreText(P, s)).toBe('Unsolved · par 4');
    expect(resultGrid(P, s)).toBe('🟩🟩🟩🟩🟨🟨🟨🟨✖️');
    expect(status(P, { ladder: ladder.slice(0, -1) })).toBe('playing');
  });
  it('marks over-par moves in the grid', () => {
    const s = { ladder: ['bold', 'hold', 'hard', 'ward', 'warm'] };
    expect(resultGrid(P, s)).toBe('🟩🟩🟩🟩🟨');
  });
});

describe('daily generation', () => {
  const graph = buildGraph(PUZZLE_WORDS);
  const dates = Array.from({ length: 400 }, (_, i) => addDays(LAUNCH_DATE, i));
  const puzzles = dates.map((d) => mod.getPuzzle(d));

  it('produces valid puzzles for 400 consecutive days', () => {
    for (const p of puzzles) {
      expect(p.par).toBeGreaterThanOrEqual(MIN_PAR);
      expect(p.par).toBeLessThanOrEqual(MAX_PAR);
      expect(p.solution[0]).toBe(p.start);
      expect(p.solution[p.solution.length - 1]).toBe(p.end);
      expect(p.solution.length - 1).toBe(p.par);
      expect(new Set(p.solution).size).toBe(p.solution.length);
      for (const w of p.solution) {
        expect(COMMON_WORDS).toContain(w);
        expect(EXCLUDED_FROM_PUZZLES.has(w)).toBe(false);
      }
      // every step is legal under the player rules
      for (let i = 1; i < p.solution.length; i++) {
        expect(validateStep(p.solution[i - 1], p.solution[i], p.solution.slice(0, i))).toBeNull();
      }
      // par is truly the shortest common-word distance
      expect(bfs(graph, p.start).dist.get(p.end)).toBe(p.par);
      expect(p.start.endsWith('s') || p.end.endsWith('s')).toBe(false);
    }
  });

  it('the stored solution wins the game at par', () => {
    for (const p of puzzles.slice(0, 50)) {
      const s = { ladder: p.solution.slice(1) };
      expect(status(p, s)).toBe('won');
      expect(scoreText(p, s)).toBe(`Solved in ${p.par} · par ${p.par}`);
    }
  });

  it('varies from day to day', () => {
    expect(new Set(puzzles.map((p) => `${p.start}-${p.end}`)).size).toBeGreaterThan(390);
    const pars = new Set(puzzles.map((p) => p.par));
    expect(pars).toEqual(new Set([4, 5, 6]));
  });

  it('is fast', () => {
    const t = performance.now();
    generatePuzzle('2031-05-05');
    expect(performance.now() - t).toBeLessThan(100);
  });

  it('is deterministic', () => {
    expect(mod.getPuzzle('2026-10-14')).toEqual(mod.getPuzzle('2026-10-14'));
    expect(generatePuzzle('2027-02-03')).toEqual(generatePuzzle('2027-02-03'));
  });

  it('pins published puzzles', () => {
    const a = mod.getPuzzle(LAUNCH_DATE);
    expect([a.start, a.end, a.par]).toEqual(['tusk', 'wasp', 5]);
    const b = mod.getPuzzle('2026-10-14');
    expect([b.start, b.end, b.par]).toEqual(['doer', 'sell', 5]);
  });

  it('never leaks the answer path into the result', () => {
    const p = puzzles[0];
    const s = { ladder: p.solution.slice(1) };
    const text = `${scoreText(p, s)} ${resultGrid(p, s)}`;
    for (const w of p.solution) expect(text.toLowerCase()).not.toContain(w);
  });
});
