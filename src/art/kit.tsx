/**
 * idl's illustration kit: "paper hours".
 *
 * Every scene is a small cut-paper landscape, 320×240, lit by one light. The
 * daily puzzles live in morning light; the game room lives in lamp-lit
 * evening. The sun is the clay dot from the wordmark, so the brand is the
 * light source in every picture.
 *
 * Rules the scenes follow (so new ones belong to the set):
 * - Flat fills, no outlines. Depth comes from value steps: far layers are pale
 *   and hazy, near layers are darker and warmer.
 * - Foreground layers are cut paper: each casts a short soft shadow.
 * - One landmark per scene, built from the game's own mechanic, inside the
 *   centre 200×180 so it survives a square crop.
 * - One fine ink line per scene at most (a path, a rail, a fence).
 * - Gradients only in the sky.
 */
import { createContext, useId, type ReactNode } from 'react';

export const W = 320;
export const H = 240;

export type Light = 'dawn' | 'day' | 'dusk' | 'night';

/** Palettes per light. `land` runs far → near. */
export const LIGHT: Record<Light, { sky: [string, string, string]; land: [string, string, string, string]; sun: string; halo: string; ink: string; shadow: string; path: string }> = {
  dawn: { sky: ['#efe4d6', '#f3dcc4', '#f2c9a6'], land: ['#d9c7b4', '#b8ad94', '#8f9775', '#5f7653'], sun: '#c45a35', halo: '#f1c3a6', ink: '#1c2420', shadow: 'rgba(70, 48, 30, 0.18)', path: '#ecd3a0' },
  day: { sky: ['#f6efe2', '#f3e5cc', '#eed2ab'], land: ['#d8c6a4', '#aead84', '#7f8f62', '#4f6a47'], sun: '#b9512f', halo: '#f0d2b6', ink: '#1c2420', shadow: 'rgba(60, 50, 30, 0.17)', path: '#e9d3a2' },
  dusk: { sky: ['#d9c1c6', '#e3b8a6', '#e9a582'], land: ['#a98c93', '#866f7b', '#5c5262', '#3b3a47'], sun: '#a8402a', halo: '#f0b39a', ink: '#241c22', shadow: 'rgba(40, 20, 30, 0.22)', path: '#e5b98c' },
  night: { sky: ['#1b2638', '#2b3a52', '#5d5a72'], land: ['#3b4a5e', '#2b3a49', '#1e2a33', '#141c22'], sun: '#f2e4c2', halo: '#5c6178', ink: '#e8dfcc', shadow: 'rgba(0, 0, 0, 0.32)', path: '#8f8a7a' },
};

/** Warm window light for evening scenes. */
export const LAMP = '#f0c36a';

export const LightContext = createContext<Light>('day');

/** The art's frame: sky, sun or moon, and grain. Children draw the land. */
export function Scene({
  light,
  sun = [228, 92],
  sunR = 17,
  stars = light === 'night',
  label,
  children,
  className = '',
  crop = 'slice',
}: {
  light: Light;
  /** Sun (or moon) centre. */
  sun?: [number, number] | null;
  sunR?: number;
  stars?: boolean;
  /** Accessible name; omit for decorative art. */
  label?: string;
  children: ReactNode;
  className?: string;
  crop?: 'slice' | 'meet';
}) {
  const uid = light + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const p = LIGHT[light];
  return (
    <svg
      className={`art-svg ${className}`.trim()}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio={`xMidYMid ${crop}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      data-light={light}
    >
      <defs>
        <linearGradient id={`${uid}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset="0.55" stopColor={p.sky[1]} />
          <stop offset="0.85" stopColor={p.sky[2]} />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill={`url(#${uid}s)`} />
      {stars && <Stars />}
      {sun && (
        <g className="art-sun">
          <circle cx={sun[0]} cy={sun[1]} r={sunR * 2.6} fill={p.halo} opacity={light === 'night' ? 0.16 : 0.28} />
          <circle cx={sun[0]} cy={sun[1]} r={sunR * 1.6} fill={p.halo} opacity={light === 'night' ? 0.2 : 0.32} />
          <circle cx={sun[0]} cy={sun[1]} r={sunR} fill={p.sun} />
        </g>
      )}
      <LightContext.Provider value={light}>{children}</LightContext.Provider>
    </svg>
  );
}

const STAR_POINTS: [number, number, number][] = [
  [22, 24, 1.1], [58, 52, 0.8], [96, 18, 1], [138, 40, 0.7], [176, 22, 1.2], [214, 50, 0.8], [262, 20, 1], [298, 46, 0.9], [40, 84, 0.7], [118, 72, 0.9], [282, 86, 0.7], [196, 80, 0.6],
];

function Stars() {
  return (
    <g className="art-stars" fill="#f2e4c2">
      {STAR_POINTS.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} opacity={0.5 + (i % 3) * 0.2} />
      ))}
    </g>
  );
}

/**
 * A cut-paper layer: the shape, with a short soft shadow beneath it so it
 * sits on the layer behind.
 */
export function Cut({ d, fill, shadow, lift = 2.5, className }: { d: string; fill: string; shadow: string; lift?: number; className?: string }) {
  return (
    <g className={className}>
      <path d={d} fill={shadow} transform={`translate(0 ${lift})`} />
      <path d={d} fill={fill} />
    </g>
  );
}

/** Rolling ground bands, far to near, for the bottom of a scene. */
export function Hills({ light, far = true, horizon = 150 }: { light: Light; far?: boolean; horizon?: number }) {
  const p = LIGHT[light];
  const y = horizon;
  return (
    <>
      {far && <path d={`M0 ${y - 8} Q60 ${y - 26} 120 ${y - 12} T240 ${y - 16} T320 ${y - 10} V${H} H0Z`} fill={p.land[0]} />}
      <Cut d={`M0 ${y + 10} Q80 ${y - 6} 160 ${y + 6} T320 ${y + 2} V${H} H0Z`} fill={p.land[1]} shadow={p.shadow} />
    </>
  );
}

/** The nearest ground band, drawn last so it overlaps landmarks' feet. */
export function Foreground({ light, y = 206 }: { light: Light; y?: number }) {
  const p = LIGHT[light];
  return <Cut d={`M0 ${y} Q70 ${y - 12} 150 ${y - 2} T320 ${y - 6} V${H} H0Z`} fill={p.land[3]} shadow={p.shadow} lift={-3} />;
}

/** Grain overlay is applied in CSS (.art::after) so it's one texture for all art. */
export function Art({ children, className = '', ratio }: { children: ReactNode; className?: string; ratio?: string }) {
  return (
    <span className={`art ${className}`.trim()} style={ratio ? { aspectRatio: ratio } : undefined}>
      {children}
    </span>
  );
}
