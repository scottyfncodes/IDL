import { createRng, hashString } from './rng';

describe('seeded rng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng('idl:2026-10-14');
    const b = createRng('idl:2026-10-14');
    const xs = Array.from({ length: 20 }, () => a.next());
    expect(Array.from({ length: 20 }, () => b.next())).toEqual(xs);
  });

  it('differs between seeds', () => {
    expect(createRng('a').next()).not.toBe(createRng('b').next());
    expect(hashString('linkup')).not.toBe(hashString('linkuq'));
  });

  it('produces values in range and full permutations', () => {
    const r = createRng(42);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 7);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(7);
    }
    const shuffled = r.shuffle([1, 2, 3, 4, 5, 6]);
    expect([...shuffled].sort()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('pins a known sequence so generators stay stable across releases', () => {
    const r = createRng('stability');
    expect(Array.from({ length: 3 }, () => r.int(0, 999))).toMatchInlineSnapshot(`
      [
        243,
        307,
        366,
      ]
    `);
  });
});
