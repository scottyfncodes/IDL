import { editionNumber, type EditionDate } from '../lib/date';
import type { DailyResult } from './types';

/** Spoiler-free share message. Contains only the score and glyph grid. */
export function buildShareText(gameName: string, date: EditionDate, result: DailyResult, url?: string): string {
  const lines = [`idl ${gameName} · No. ${editionNumber(date)}`, result.score];
  if (result.grid?.length) lines.push('', ...result.grid);
  if (url) lines.push('', url);
  return lines.join('\n');
}

export function shareUrl(): string | undefined {
  if (typeof location === 'undefined') return undefined;
  if (/^(localhost|127\.|0\.0\.0\.0)/.test(location.hostname)) return undefined;
  return `${location.origin}${location.pathname}`;
}
