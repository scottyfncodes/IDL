import type { ComponentType, ReactNode } from 'react';
import type { EditionDate } from '../lib/date';

export type DailyGameId = 'linkup' | 'wordcraft' | 'sumwise' | 'deduction' | 'pattern' | 'wordsteps';

export type DailyStatus = 'playing' | 'won' | 'lost';

/** Spoiler-free result, used for the completion panel and share text. */
export interface DailyResult {
  /** Short headline, e.g. "4/6", "Solved with 1 mistake", "3 of 3". */
  score: string;
  /** Optional emoji/glyph grid lines. Must never contain answer text. */
  grid?: string[];
}

export interface DailyRecord<S = unknown> {
  status: DailyStatus;
  state: S;
  result?: DailyResult;
  updatedAt: number;
}

export interface DailyGameProps<P, S> {
  date: EditionDate;
  puzzle: P;
  /** Saved progress for this date, if any. */
  record: DailyRecord<S> | undefined;
  /**
   * Persist progress. Call on every meaningful move. When the game ends call
   * with status 'won' | 'lost' and a `result`. Records in a finished state are
   * final — the shell will not let the player replay over them.
   */
  save: (record: Omit<DailyRecord<S>, 'updatedAt'>) => void;
}

export interface DailyModule<P = unknown, S = unknown> {
  /** Deterministic: same date → same puzzle, on every device. */
  getPuzzle: (date: EditionDate) => P;
  Component: ComponentType<DailyGameProps<P, S>>;
  /** Short how-to-play content for the rules sheet. */
  rules: ReactNode;
  /**
   * Shown under the result once the game is finished (answers, group
   * explanations, solution path). Only rendered after completion.
   */
  Reveal?: ComponentType<{ puzzle: P; record: DailyRecord<S> }>;
}
