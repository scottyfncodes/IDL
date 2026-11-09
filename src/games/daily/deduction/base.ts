/**
 * Shared building blocks for every Deduction generator: the attribute sets,
 * suspects and lineup sampling. Changing anything here changes past
 * editions, so treat it as frozen.
 */
import type { Rng } from '../../../lib/rng';
import { NAMES } from './content';

export const HATS = ['none', 'cap', 'beret', 'bobble'] as const;
export const COATS = ['red', 'green', 'blue', 'yellow'] as const;
export const HOLDINGS = ['umbrella', 'book', 'basket', 'nothing'] as const;

export type Hat = (typeof HATS)[number];
export type Coat = (typeof COATS)[number];
export type Holding = (typeof HOLDINGS)[number];
export type Category = 'hat' | 'coat' | 'holding';
export const CATEGORIES: readonly Category[] = ['hat', 'coat', 'holding'];

export const CATEGORY_VALUES: { hat: readonly Hat[]; coat: readonly Coat[]; holding: readonly Holding[] } = {
  hat: HATS,
  coat: COATS,
  holding: HOLDINGS,
};

export interface Suspect {
  name: string;
  hat: Hat;
  coat: Coat;
  holding: Holding;
}

export const attr = (s: Suspect, cat: Category): string => s[cat];
export const countWith = (lineup: readonly Suspect[], cat: Category, value: string) => lineup.filter((s) => attr(s, cat) === value).length;
export const neighbours = (lineup: readonly Suspect[], i: number) => [i - 1, i + 1].filter((j) => j >= 0 && j < lineup.length);

export const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
export const WEAR: Record<Hat, string> = { none: 'no hat', cap: 'a cap', beret: 'a beret', bobble: 'a bobble hat' };
export const HOLD: Record<Holding, string> = { umbrella: 'an umbrella', book: 'a book', basket: 'a basket', nothing: 'nothing at all' };

/** "someone wearing a cap" style phrase, after "someone"/"anyone". */
export function withPhrase(cat: Category, value: string): string {
  if (cat === 'hat') return value === 'none' ? 'without a hat' : `wearing ${WEAR[value as Hat]}`;
  if (cat === 'coat') return `in a ${value} coat`;
  return value === 'nothing' ? 'with empty hands' : `holding ${HOLD[value as Holding]}`;
}

/** `n` suspects with distinct names, no two dressed identically. */
export function randomLineup(rng: Rng, n: number): Suspect[] {
  const names = rng.shuffle(NAMES).slice(0, n);
  const seen = new Set<string>();
  const out: Suspect[] = [];
  while (out.length < n) {
    const s: Suspect = { name: names[out.length], hat: rng.pick(HATS), coat: rng.pick(COATS), holding: rng.pick(HOLDINGS) };
    const key = `${s.hat}|${s.coat}|${s.holding}`;
    if (seen.has(key)) continue; // no two suspects look identical
    seen.add(key);
    out.push(s);
  }
  return out;
}
