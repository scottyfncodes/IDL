import { act, renderHook } from '@testing-library/react';
import { clearAll, keys, load, remove, save, STORAGE_PREFIX, usePersistentState } from './storage';

describe('storage', () => {
  it('round-trips data with a versioned envelope', () => {
    save('room:test', { a: 1 }, 2);
    expect(load('room:test', null, 2)).toEqual({ a: 1 });
    const raw = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}room:test`)!);
    expect(raw.v).toBe(2);
  });

  it('falls back on version mismatch and corrupt data', () => {
    save('k', 5, 1);
    expect(load('k', 'fallback', 2)).toBe('fallback');
    localStorage.setItem(`${STORAGE_PREFIX}bad`, '{not json');
    expect(load('bad', 'fallback')).toBe('fallback');
  });

  it('lists and clears by prefix without touching other sites’ keys', () => {
    localStorage.setItem('other-app', 'keep');
    save('daily:linkup:2026-10-14', 1);
    save('daily:wordcraft:2026-10-14', 1);
    save('room:sudoku', 1);
    expect(keys('daily:').sort()).toEqual(['daily:linkup:2026-10-14', 'daily:wordcraft:2026-10-14']);
    clearAll('daily:');
    expect(keys('daily:')).toEqual([]);
    expect(keys('room:')).toEqual(['room:sudoku']);
    clearAll();
    expect(keys()).toEqual([]);
    expect(localStorage.getItem('other-app')).toBe('keep');
    remove('nothing');
  });

  it('recovers persisted state in a fresh hook (simulated reload)', () => {
    const first = renderHook(() => usePersistentState('room:demo', { n: 0 }));
    act(() => first.result.current[1]((s) => ({ n: s.n + 2 })));
    first.unmount();
    const second = renderHook(() => usePersistentState('room:demo', { n: 0 }));
    expect(second.result.current[0]).toEqual({ n: 2 });
    act(() => second.result.current[2]());
    expect(second.result.current[0]).toEqual({ n: 0 });
    expect(load('room:demo', null)).toBeNull();
  });
});
