/** Small hand-drawn-feeling marks that stand in for each game. */
import type { ReactElement } from 'react';

const S = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {children}
  </svg>
);
const A = 'var(--glyph-accent, var(--clay))';

export const glyphs: Record<string, () => ReactElement> = {
  linkup: () => (
    <S>
      {[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => (
        <rect key={`${r}${c}`} x={7 + c * 9} y={7 + r * 9} width="7" height="7" rx="2" fill={r === 1 ? A : 'none'} stroke={r === 1 ? A : 'currentColor'} strokeWidth="1.6" />
      )))}
    </S>
  ),
  wordcraft: () => (
    <S>
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={4 + i * 8.2} y="18" width="7" height="12" rx="1.6" fill={i === 1 ? A : i === 3 ? 'var(--ochre)' : 'none'} stroke={i === 1 ? A : i === 3 ? 'var(--ochre)' : 'currentColor'} strokeWidth="1.6" />
      ))}
    </S>
  ),
  sumwise: () => (
    <S>
      <circle cx="16" cy="16" r="8" />
      <circle cx="32" cy="32" r="8" stroke={A} />
      <path d="M13 16h6M16 13v6" />
      <path d="M29 30h6M29 34h6" stroke={A} />
    </S>
  ),
  deduction: () => (
    <S>
      <circle cx="21" cy="21" r="10" />
      <path d="M28.5 28.5L38 38" strokeWidth="3" />
      <path d="M17 21h8M21 17v8" stroke={A} />
    </S>
  ),
  pattern: () => (
    <S>
      <circle cx="9" cy="30" r="2.5" fill="currentColor" />
      <circle cx="19" cy="26" r="4" fill="currentColor" />
      <circle cx="31" cy="21" r="5.5" fill="currentColor" />
      <circle cx="41" cy="14" r="5" strokeDasharray="3 3" stroke={A} />
    </S>
  ),
  wordsteps: () => (
    <S>
      <path d="M15 6v36M33 6v36" />
      <path d="M15 13h18M15 24h18M15 35h18" stroke={A} />
    </S>
  ),
  'dots-boxes': () => (
    <S>
      {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <circle key={`${r}${c}`} cx={10 + c * 14} cy={10 + r * 14} r="2" fill="currentColor" stroke="none" />))}
      <rect x="10" y="10" width="14" height="14" fill={A} stroke={A} opacity="0.85" />
      <path d="M24 24h14M38 24v14" />
    </S>
  ),
  'connect-four': () => (
    <S>
      <rect x="6" y="9" width="36" height="30" rx="5" />
      {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => (
        <circle key={`${r}${c}`} cx={13 + c * 7.3} cy={16 + r * 8} r="2.6" fill={(r === 2 && c < 3) || (r === 1 && c === 1) ? (c % 2 ? 'var(--tide)' : A) : 'none'} stroke="currentColor" strokeWidth="1.2" />
      )))}
    </S>
  ),
  battleship: () => (
    <S>
      <path d="M8 27h32l-5 8H13z" />
      <path d="M18 27v-7h12v7M24 20v-6" />
      <path d="M5 40c3 0 3-2 6-2s3 2 6 2 3-2 6-2 3 2 6 2 3-2 6-2 3 2 6 2" stroke={A} />
    </S>
  ),
  sudoku: () => (
    <S>
      <rect x="7" y="7" width="34" height="34" rx="3" />
      <path d="M18.3 7v34M29.6 7v34M7 18.3h34M7 29.6h34" strokeWidth="1.2" />
      <text x="12.6" y="16.4" fontSize="8" fill="currentColor" stroke="none" textAnchor="middle" fontFamily="var(--font-ui)" fontWeight="700">4</text>
      <text x="24" y="27.6" fontSize="8" fill={A} stroke="none" textAnchor="middle" fontFamily="var(--font-ui)" fontWeight="700">7</text>
      <text x="35.3" y="38.9" fontSize="8" fill="currentColor" stroke="none" textAnchor="middle" fontFamily="var(--font-ui)" fontWeight="700">2</text>
    </S>
  ),
  'mystery-grid': () => (
    <S>
      <rect x="7" y="7" width="34" height="34" rx="3" />
      <path d="M18 7v34M29.5 7v34M7 18h34M7 29.5h34" strokeWidth="1.2" />
      <circle cx="24" cy="24" r="3.4" fill={A} stroke="none" />
      <path d="M10 10l5 5M15 10l-5 5M33 33l5 5M38 33l-5 5" strokeWidth="1.5" />
    </S>
  ),
  'tic-tac-toe': () => (
    <S>
      <path d="M18 7v34M30 7v34M7 18h34M7 30h34" strokeWidth="1.6" />
      <path d="M9.5 9.5l5.5 5.5M15 9.5l-5.5 5.5" stroke={A} strokeWidth="2.4" />
      <circle cx="24" cy="24" r="3.3" stroke="var(--tide)" strokeWidth="2.4" />
      <path d="M33 33l5.5 5.5M38.5 33L33 38.5" stroke={A} strokeWidth="2.4" />
    </S>
  ),
  reversi: () => (
    <S>
      <rect x="7" y="7" width="34" height="34" rx="4" />
      <circle cx="18.5" cy="18.5" r="5.5" fill="currentColor" />
      <circle cx="29.5" cy="29.5" r="5.5" fill="currentColor" />
      <circle cx="29.5" cy="18.5" r="5.5" fill={A} stroke={A} />
      <circle cx="18.5" cy="29.5" r="5.5" fill={A} stroke={A} />
    </S>
  ),
  mancala: () => (
    <S>
      <rect x="4" y="14" width="40" height="20" rx="10" />
      {[14, 21, 28].map((x) => <circle key={`t${x}`} cx={x + 3} cy="20" r="2.6" />)}
      {[14, 21, 28].map((x) => <circle key={`b${x}`} cx={x + 3} cy="28" r="2.6" />)}
      <circle cx="17" cy="20" r="1.1" fill={A} stroke="none" />
      <circle cx="31" cy="28" r="1.1" fill={A} stroke="none" />
      <circle cx="30" cy="27" r="1.1" fill={A} stroke="none" />
    </S>
  ),
  mines: () => (
    <S>
      {[0, 1, 2].map((r) => [0, 1, 2].map((c) => (
        <rect key={`${r}${c}`} x={7 + c * 12} y={7 + r * 12} width="10" height="10" rx="2" strokeWidth="1.5" fill={r === 0 || (r === 1 && c === 0) ? 'none' : 'color-mix(in srgb, currentColor 14%, transparent)'} />
      )))}
      <text x="12" y="15.5" fontSize="8" fill={A} stroke="none" textAnchor="middle" fontFamily="var(--font-ui)" fontWeight="700">1</text>
      <text x="24" y="15.5" fontSize="8" fill="currentColor" stroke="none" textAnchor="middle" fontFamily="var(--font-ui)" fontWeight="700">2</text>
      <path d="M33 33v-7l4 2-4 2" stroke={A} />
    </S>
  ),
  'picture-logic': () => (
    <S>
      {[0, 1, 2, 3].map((r) => [0, 1, 2, 3].map((c) => {
        const on = [[0, 1, 1, 0], [1, 1, 1, 1], [0, 1, 1, 0], [0, 1, 1, 0]][r][c];
        return <rect key={`${r}${c}`} x={14 + c * 7.5} y={14 + r * 7.5} width="6.5" height="6.5" rx="1" strokeWidth="1.2" fill={on ? A : 'none'} stroke={on ? A : 'currentColor'} />;
      }))}
      <path d="M5 17.5h5M5 25h5M5 32.5h5M5 40h5M17.5 5v5M25 5v5M32.5 5v5M40 5v5" strokeWidth="1.6" />
    </S>
  ),
  patience: () => (
    <S>
      <rect x="8" y="12" width="17" height="24" rx="2.5" transform="rotate(-8 16 24)" />
      <rect x="20" y="10" width="17" height="24" rx="2.5" fill="var(--card)" />
      <path d="M28.5 16.5c-2.2-2.6-5.5-.4-3.6 2.3l3.6 4 3.6-4c1.9-2.7-1.4-4.9-3.6-2.3z" fill={A} stroke={A} strokeWidth="1" />
    </S>
  ),
  'memory-match': () => (
    <S>
      <rect x="7" y="10" width="15" height="21" rx="3" />
      <rect x="26" y="17" width="15" height="21" rx="3" fill={A} stroke={A} transform="rotate(6 33 27)" />
      <circle cx="14.5" cy="20.5" r="3" />
    </S>
  ),
};

export function Glyph({ id, accent }: { id: string; accent?: string }) {
  const G = glyphs[id];
  return (
    <span className="glyph" style={accent ? ({ '--glyph-accent': `var(--${accent})` } as React.CSSProperties) : undefined}>
      {G ? <G /> : null}
    </span>
  );
}
