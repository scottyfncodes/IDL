/**
 * Local-first persistence. Everything idl remembers lives in localStorage
 * under the `idl:` prefix, wrapped in a versioned envelope so the shape can be
 * migrated later. Reads never throw: private mode, quota errors and corrupt
 * JSON all degrade to the provided fallback.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

export const STORAGE_PREFIX = 'idl:';
/** Bump when the envelope format itself changes (not per-game state). */
export const STORAGE_SCHEMA = 1;

interface Envelope<T> {
  v: number; // per-key data version
  at: number; // last write, ms
  data: T;
}

function backend(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = `${STORAGE_PREFIX}__probe`;
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

const memory = new Map<string, string>();

function rawGet(key: string): string | null {
  const store = backend();
  if (store) return store.getItem(STORAGE_PREFIX + key);
  return memory.get(key) ?? null;
}

function rawSet(key: string, value: string): boolean {
  const store = backend();
  try {
    if (store) store.setItem(STORAGE_PREFIX + key, value);
    else memory.set(key, value);
    return true;
  } catch {
    memory.set(key, value);
    return false;
  }
}

export function load<T>(key: string, fallback: T, version = 1): T {
  try {
    const raw = rawGet(key);
    if (!raw) return fallback;
    const env = JSON.parse(raw) as Envelope<T>;
    if (!env || typeof env !== 'object' || env.v !== version) return fallback;
    return env.data;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, data: T, version = 1): boolean {
  const env: Envelope<T> = { v: version, at: Date.now(), data };
  const ok = rawSet(key, JSON.stringify(env));
  notify(key);
  return ok;
}

export function remove(key: string): void {
  const store = backend();
  try {
    store?.removeItem(STORAGE_PREFIX + key);
  } catch {
    /* ignore */
  }
  memory.delete(key);
  notify(key);
}

/** All idl keys (without prefix) that start with `prefix`. */
export function keys(prefix = ''): string[] {
  const store = backend();
  const out = new Set<string>();
  if (store) {
    for (let i = 0; i < store.length; i++) {
      const k = store.key(i);
      if (k && k.startsWith(STORAGE_PREFIX + prefix)) out.add(k.slice(STORAGE_PREFIX.length));
    }
  }
  for (const k of memory.keys()) if (k.startsWith(prefix)) out.add(k);
  return [...out];
}

/** Remove every idl key matching `prefix` ('' clears all idl data). */
export function clearAll(prefix = ''): void {
  for (const k of keys(prefix)) remove(k);
}

// ---- change notifications (same tab) -------------------------------------
type Listener = (key: string) => void;
const listeners = new Set<Listener>();
function notify(key: string) {
  for (const l of listeners) l(key);
}
export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Ask the browser not to evict our storage. Best effort; never prompts on
 * mainstream browsers. Safari may still evict after long inactivity. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) {
      if (await navigator.storage.persisted()) return true;
      return await navigator.storage.persist();
    }
  } catch {
    /* ignore */
  }
  return false;
}

/**
 * React state mirrored to localStorage. `key` may change (e.g. a different
 * edition date); state reloads from storage when it does.
 */
export function usePersistentState<T>(
  key: string,
  initial: T | (() => T),
  version = 1,
): [T, (next: T | ((prev: T) => T)) => void, () => void] {
  const init = () => load<T | undefined>(key, undefined, version) ?? (typeof initial === 'function' ? (initial as () => T)() : initial);
  const [state, setState] = useState<{ key: string; value: T }>(() => ({ key, value: init() }));
  const current = state.key === key ? state.value : init();
  const ref = useRef(current);
  ref.current = current;

  useEffect(() => {
    if (state.key !== key) setState({ key, value: current });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const value = typeof next === 'function' ? (next as (p: T) => T)(ref.current) : next;
      ref.current = value;
      save(key, value, version);
      setState({ key, value });
    },
    [key, version],
  );

  const reset = useCallback(() => {
    remove(key);
    const value = typeof initial === 'function' ? (initial as () => T)() : initial;
    ref.current = value;
    setState({ key, value });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  return [current, set, reset];
}

/** Re-render whenever any key with `prefix` changes. Returns a tick counter. */
export function useStorageVersion(prefix = ''): number {
  const [tick, setTick] = useState(0);
  useEffect(
    () =>
      subscribe((k) => {
        if (k.startsWith(prefix)) setTick((t) => t + 1);
      }),
    [prefix],
  );
  return tick;
}
