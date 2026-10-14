import type { ReactElement } from 'react';
import { motifTone, type MotifId } from './content';

/** Original line drawings on a 48×48 grid. `.mm-fill` shapes get a soft tint of the motif tone. */
const DRAW: Record<MotifId, ReactElement> = {
  leaf: (
    <>
      <path className="mm-fill" d="M9 39C8 22 20 9 40 8c1 19-11 32-31 31z" />
      <path d="M9 39L31 17M17 31h8M22 26v-7" />
    </>
  ),
  moon: <path className="mm-fill" d="M29 6a18 18 0 1 0 13 27A14 14 0 0 1 29 6z" />,
  wave: (
    <>
      <path className="mm-fill" d="M4 40V30c4-10 12-14 18-10 4 3 2 9-2 8 6 6 16 2 24-6v18z" />
      <path d="M4 22c6-8 12-8 16-4M28 14c4-4 9-5 14-2" />
    </>
  ),
  mountain: (
    <>
      <path className="mm-fill" d="M3 40L18 13l8 13 5-7 14 21z" />
      <path d="M13 22l5 3 4-3M18 13l4 7" />
    </>
  ),
  kite: (
    <>
      <path className="mm-fill" d="M24 3l13 15-13 18-13-18z" />
      <path d="M24 3v33M11 18h26M24 36c-5 3 4 5-1 8M20 41l-3 1M27 44l3-1" />
    </>
  ),
  shell: (
    <>
      <path className="mm-fill" d="M6 30a18 18 0 0 1 36 0l-12 11H18z" />
      <path d="M24 41V13M18 41L13 17M30 41l5-24M18 41L7 26M30 41l11-15" />
    </>
  ),
  star: <path className="mm-fill" d="M24 4l5.9 12.6 13.6 1.6-10.1 9.3 2.7 13.5L24 34.3l-12.1 6.7 2.7-13.5-10.1-9.3 13.6-1.6z" />,
  acorn: (
    <>
      <path className="mm-fill" d="M13 21c0 11 4 18 11 21 7-3 11-10 11-21z" />
      <path d="M9 21c1-7 8-11 15-11s14 4 15 11zM24 10V5M20 15l2 3M28 15l-2 3" />
    </>
  ),
  sun: (
    <>
      <circle className="mm-fill" cx="24" cy="24" r="9" />
      <path d="M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M10 38l4-4M34 14l4-4" />
    </>
  ),
  fish: (
    <>
      <path className="mm-fill" d="M5 24c7-11 21-13 31 0-10 13-24 11-31 0zM36 24l8-8v16z" />
      <circle cx="14" cy="22" r="1.6" fill="currentColor" />
      <path d="M22 18c2 4 2 8 0 12" />
    </>
  ),
  mushroom: (
    <>
      <path className="mm-fill" d="M5 25C5 14 13 7 24 7s19 7 19 18z" />
      <path d="M18 25v12c0 3 2 5 6 5s6-2 6-5V25" />
      <circle cx="16" cy="17" r="2.2" fill="currentColor" />
      <circle cx="29" cy="14" r="2" fill="currentColor" />
      <circle cx="34" cy="20" r="1.6" fill="currentColor" />
    </>
  ),
  pine: (
    <>
      <path className="mm-fill" d="M24 3l10 13h-5l9 12h-6l8 10H8l8-10h-6l9-12h-5z" />
      <path d="M24 38v7" />
    </>
  ),
};

export function Motif({ id }: { id: MotifId }) {
  return (
    <svg viewBox="0 0 48 48" className={`mm-motif mm-tone--${motifTone(id)}`} aria-hidden="true" focusable="false">
      {DRAW[id]}
    </svg>
  );
}
