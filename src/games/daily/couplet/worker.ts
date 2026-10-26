/// <reference lib="webworker" />
/** Builds Couplet boards off the main thread. */
import { boardFor, type Tier } from './logic';

self.onmessage = (e: MessageEvent<{ date: string; tier: Tier }>) => {
  const { date, tier } = e.data;
  try {
    (self as unknown as Worker).postMessage({ date, tier, board: boardFor(date, tier) });
  } catch {
    (self as unknown as Worker).postMessage({ date, tier, board: null });
  }
};
