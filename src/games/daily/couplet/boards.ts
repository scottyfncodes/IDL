/**
 * Where the UI gets boards from. Generation is deterministic, so a board can
 * come from memory, from a small on-device cache, from a background worker, or
 * be built on the spot, and it is always the same board. A cached board is
 * checked before use and rebuilt if it doesn't hold up.
 */
import { load, keys, remove, save } from '../../../lib/storage';
import { boardFor, boardProblems, GENERATOR_VERSION, primeBoard, TIERS, type Board, type Tier } from './logic';
import type { EditionDate } from '../../../lib/date';

const PREFIX = `couplet:board:${GENERATOR_VERSION}:`;
const KEEP = 9;
const keyFor = (date: EditionDate, tier: Tier) => `${PREFIX}${date}:${tier}`;

function remember(date: EditionDate, tier: Tier, board: Board) {
  primeBoard(date, tier, board);
  save(keyFor(date, tier), board);
  // Keep only the most recent few.
  const all = keys(PREFIX).sort();
  for (const k of all.slice(0, Math.max(0, all.length - KEEP))) remove(k);
}

/** The board for a tier, as fast as possible. */
export function getBoard(date: EditionDate, tier: Tier): Board {
  const cached = load<Board | undefined>(keyFor(date, tier), undefined);
  if (cached && boardProblems(cached).length === 0) {
    primeBoard(date, tier, cached);
    return cached;
  }
  const b = boardFor(date, tier);
  remember(date, tier, b);
  return b;
}

/** Build the day's other boards in the background. Returns a cancel function. */
export function warmBoards(date: EditionDate): () => void {
  const missing = TIERS.filter((t) => !load<Board | undefined>(keyFor(date, t), undefined));
  if (!missing.length || typeof Worker === 'undefined') return () => {};
  let worker: Worker | null = null;
  try {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return () => {};
  }
  worker.onmessage = (e: MessageEvent<{ date: EditionDate; tier: Tier; board: Board | null }>) => {
    if (e.data.board && boardProblems(e.data.board).length === 0) remember(e.data.date, e.data.tier, e.data.board);
  };
  for (const t of missing) worker.postMessage({ date, tier: t });
  return () => worker?.terminate();
}
