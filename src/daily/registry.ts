import type { DailyGameId, DailyModule } from './types';

export type Accent = 'clay' | 'moss' | 'ochre' | 'tide' | 'plum';

export interface DailyGameMeta {
  id: DailyGameId;
  name: string;
  /** One line, plain language. */
  tagline: string;
  minutes: number;
  accent: Accent;
  /** Retired from new editions; still playable from the archive. */
  retired?: boolean;
  load: () => Promise<{ default: DailyModule<any, any> }>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/**
 * Every daily game that has ever been published, so old links and records
 * keep working. A retired game stays playable from its archive but is no
 * longer part of new editions.
 */
export const DAILY_GAMES: DailyGameMeta[] = [
  { id: 'linkup', name: 'Linkup', tagline: 'Sixteen words, four hidden groups.', minutes: 5, accent: 'clay', load: () => import('../games/daily/linkup') },
  { id: 'wordsteps', name: 'Wordsteps', tagline: 'Change one letter at a time.', minutes: 4, accent: 'clay', load: () => import('../games/daily/wordsteps') },
  { id: 'couplet', name: 'Couplet', tagline: 'Lay the dominoes so every region keeps its rule.', minutes: 8, accent: 'tide', load: () => import('../games/daily/couplet') },
  { id: 'deduction', name: 'Deduction', tagline: 'Read the clues. Name the culprit.', minutes: 4, accent: 'plum', load: () => import('../games/daily/deduction') },
  { id: 'sumwise', name: 'Sumwise', tagline: 'Combine the numbers to hit the target.', minutes: 3, accent: 'ochre', load: () => import('../games/daily/sumwise') },
  { id: 'wordcraft', name: 'Wordcraft', tagline: 'Find the five-letter word in six tries.', minutes: 4, accent: 'moss', load: () => import('../games/daily/wordcraft') },
  { id: 'pattern', name: 'Pattern', tagline: 'Three sequences. What comes next?', minutes: 3, accent: 'tide', retired: true, load: () => import('../games/daily/pattern') },
];

/** The games in each edition, in the order they appear. */
export const EDITION_GAMES: DailyGameMeta[] = DAILY_GAMES.filter((g) => !g.retired);

export const dailyMeta = (id: string) => DAILY_GAMES.find((g) => g.id === id);
