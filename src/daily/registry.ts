import type { DailyGameId, DailyModule } from './types';

export type Accent = 'clay' | 'moss' | 'ochre' | 'tide' | 'plum';

export interface DailyGameMeta {
  id: DailyGameId;
  name: string;
  /** One line, plain language. */
  tagline: string;
  minutes: number;
  accent: Accent;
  load: () => Promise<{ default: DailyModule<any, any> }>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** The daily lineup, in the order it appears in each edition. */
export const DAILY_GAMES: DailyGameMeta[] = [
  { id: 'linkup', name: 'Linkup', tagline: 'Sixteen words, four hidden groups.', minutes: 5, accent: 'clay', load: () => import('../games/daily/linkup') },
  { id: 'wordcraft', name: 'Wordcraft', tagline: 'Find the five-letter word in six tries.', minutes: 4, accent: 'moss', load: () => import('../games/daily/wordcraft') },
  { id: 'sumwise', name: 'Sumwise', tagline: 'Combine the numbers to hit the target.', minutes: 3, accent: 'ochre', load: () => import('../games/daily/sumwise') },
  { id: 'deduction', name: 'Deduction', tagline: 'Read the clues. Name the culprit.', minutes: 4, accent: 'plum', load: () => import('../games/daily/deduction') },
  { id: 'pattern', name: 'Pattern', tagline: 'Three sequences. What comes next?', minutes: 3, accent: 'tide', load: () => import('../games/daily/pattern') },
  { id: 'wordsteps', name: 'Wordsteps', tagline: 'Change one letter at a time.', minutes: 4, accent: 'clay', load: () => import('../games/daily/wordsteps') },
];

export const dailyMeta = (id: string) => DAILY_GAMES.find((g) => g.id === id);
