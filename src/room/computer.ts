import { useEffect } from 'react';

/**
 * Runs the computer's move after a short, human-feeling pause whenever
 * `when` is true. The pause is skipped for players who prefer reduced motion
 * (the move still happens, just without the theatrical wait).
 */
export function useComputerMove(when: boolean, move: () => void, delayMs = 520) {
  useEffect(() => {
    if (!when) return;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const id = window.setTimeout(move, reduce ? 120 : delayMs);
    return () => window.clearTimeout(id);
  }, [when, move, delayMs]);
}

/** Display names when one side is the computer. */
export const COMPUTER_NAME = 'idl';
export const HUMAN_NAME = 'You';
