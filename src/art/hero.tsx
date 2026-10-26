/**
 * The Today masthead scene. It keeps the reader's hour: dawn, day, dusk or
 * night, with someone on a bench taking a minute. Text sits on the sky, so
 * the land stays in the bottom band and the right-hand side.
 */
import { useId } from 'react';
import { LAMP, LIGHT, type Light } from './kit';

export function lightForHour(hour: number): Light {
  if (hour >= 5 && hour < 8) return 'dawn';
  if (hour >= 8 && hour < 17) return 'day';
  if (hour >= 17 && hour < 20) return 'dusk';
  return 'night';
}

const SUN: Record<Light, [number, number, number]> = {
  dawn: [62, 96, 15],
  day: [334, 22, 15],
  dusk: [376, 118, 16],
  night: [338, 20, 12],
};

const STARS: [number, number, number][] = [
  [212, -40, 1.1], [246, -14, 0.8], [282, -52, 1], [310, 2, 0.7], [372, -30, 1.2], [230, 30, 0.7], [380, 48, 0.8], [196, 4, 0.6], [260, 58, 0.7],
  [430, -20, 1], [470, 24, 0.8], [520, -46, 1.1], [560, 10, 0.7], [-60, -50, 0.8], [-120, 10, 1], [-170, -30, 0.7],
];

export function HeroScene({ light, sky = 96 }: { light: Light; sky?: number }) {
  const uid = `hero${light}${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const p = LIGHT[light];
  const [sx, sy, sr] = SUN[light];
  const lit = light === 'dusk' || light === 'night';
  return (
    <svg className="art-svg" viewBox={`-200 ${-sky} 800 ${200 + sky}`} preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false" data-light={light}>
      <defs>
        <linearGradient id={`${uid}s`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset="0.6" stopColor={p.sky[1]} />
          <stop offset="0.9" stopColor={p.sky[2]} />
        </linearGradient>
      </defs>
      <rect x="-200" y={-sky} width="800" height={200 + sky} fill={`url(#${uid}s)`} />
      {light === 'night' && (
        <g className="art-stars" fill="#f2e4c2">
          {STARS.map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} opacity={0.5 + (i % 3) * 0.2} />
          ))}
        </g>
      )}
      <g className="art-sun">
        <circle cx={sx} cy={sy} r={sr * 2.6} fill={p.halo} opacity={light === 'night' ? 0.16 : 0.28} />
        <circle cx={sx} cy={sy} r={sr * 1.6} fill={p.halo} opacity={light === 'night' ? 0.2 : 0.32} />
        <circle cx={sx} cy={sy} r={sr} fill={p.sun} />
      </g>
      {light === 'day' && (
        <path d="M250 60 q4 -4 8 0 q4 -4 8 0 M278 76 q3 -3 6 0 q3 -3 6 0" fill="none" stroke={p.ink} strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
      )}

      {/* Far hills */}
      <path d="M-200 116 Q-130 98 -60 112 T80 110 T220 104 T360 106 T500 112 T640 108 V200 H-200Z" fill={p.land[0]} />
      {/* Mid hills, cut paper */}
      <path d="M-200 140 Q-110 124 -20 138 T160 134 T340 128 T520 136 T700 132 V200 H-200Z" fill={p.shadow} transform="translate(0 2.5)" />
      <path d="M-200 140 Q-110 124 -20 138 T160 134 T340 128 T520 136 T700 132 V200 H-200Z" fill={p.land[1]} />

      {/* A tree */}
      <g>
        <rect x="320" y="104" width="5" height="44" rx="2" fill={light === 'night' ? '#141c22' : '#5a4a3c'} />
        <circle cx="322" cy="96" r="22" fill={p.shadow} transform="translate(0 2.5)" />
        <circle cx="322" cy="96" r="22" fill={p.land[2]} />
        <circle cx="308" cy="110" r="14" fill={p.land[2]} />
        <circle cx="338" cy="108" r="13" fill={p.land[2]} />
      </g>

      {/* The path, the only ink-weight line */}
      <path d="M150 200 Q190 176 236 168 Q262 164 276 158" fill="none" stroke={p.path} strokeWidth="7" strokeLinecap="round" opacity={light === 'night' ? 0.55 : 0.9} />

      {/* Lamppost */}
      <g>
        {lit && <circle cx="256" cy="116" r="20" fill={LAMP} opacity="0.22" />}
        <rect x="254.5" y="118" width="3" height="42" fill={light === 'night' ? '#0f151a' : '#3a3530'} />
        <rect x="251" y="110" width="10" height="9" rx="2" fill={lit ? LAMP : '#e8dcc6'} />
        <path d="M249 111 L256 105 L263 111Z" fill={light === 'night' ? '#0f151a' : '#3a3530'} />
      </g>

      {/* Bench, and someone taking a minute */}
      <g transform="translate(270 146)">
        <rect x="0" y="0" width="44" height="4" rx="1.5" fill="#8a6a4c" />
        <rect x="0" y="-9" width="44" height="3.5" rx="1.5" fill="#8a6a4c" />
        <rect x="4" y="4" width="3" height="9" fill="#5a4535" />
        <rect x="37" y="4" width="3" height="9" fill="#5a4535" />
        {/* the reader */}
        <path d="M16 0 L18 -16 Q22 -20 27 -16 L29 0Z" fill="#74465f" />
        <circle cx="22.5" cy="-21.5" r="4.6" fill="#e2bf9c" />
        <path d="M18 0 L28 0 L30 9 L26 9 L24 3 L20 3 L19 9 L15 9Z" fill="#2f2a26" />
        {/* phone, glowing after dark */}
        {lit && <circle cx="31" cy="-12" r="6" fill="#cfe3f0" opacity="0.35" />}
        <rect x="29" y="-15" width="4" height="6" rx="1" fill={lit ? '#dcebf3' : '#2f2a26'} />
        {/* a cup on the bench */}
        <rect x="36" y="-5" width="4" height="5" rx="1" fill="#efe2c9" />
      </g>

      {/* Foreground */}
      <path d="M-200 176 Q-120 166 -40 176 T120 174 T280 170 T440 176 T600 172 V200 H-200Z" fill={p.shadow} transform="translate(0 -3)" />
      <path d="M-200 176 Q-120 166 -40 176 T120 174 T280 170 T440 176 T600 172 V200 H-200Z" fill={p.land[3]} />
    </svg>
  );
}

/**
 * The game room's masthead: an evening window, two people at a table with a
 * board between them. Same paper and light rules as the covers.
 */
export function RoomScene() {
  const p = LIGHT.night;
  return (
    <svg className="art-svg" viewBox="-400 0 820 200" preserveAspectRatio="xMaxYMax slice" aria-hidden="true" focusable="false" data-light="night">
      <defs>
        <linearGradient id="roomsky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.sky[0]} />
          <stop offset="0.6" stopColor={p.sky[1]} />
          <stop offset="0.95" stopColor={p.sky[2]} />
        </linearGradient>
      </defs>
      <rect x="-400" y="0" width="820" height="200" fill="url(#roomsky)" />
      <g className="art-stars" fill="#f2e4c2">
        {[[-350, 40], [-260, 18], [-150, 30], [-90, 60], [-30, 22], [40, 44], [90, 16], [150, 36], [330, 58], [400, 70]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 ? 0.8 : 1.2} opacity={0.6 + (i % 2) * 0.3} />
        ))}
      </g>
      <g className="art-sun">
        <circle cx="386" cy="30" r="26" fill={p.halo} opacity="0.16" />
        <circle cx="386" cy="30" r="10" fill={p.sun} />
      </g>
      <path d="M-400 146 Q-300 136 -200 150 Q-110 134 -20 146 T160 142 T340 138 T520 146 T700 140 V200 H-400Z" fill={p.land[0]} />
      <g transform="translate(64 0)">
      {/* The cottage */}
      <path d="M150 200 V96 L240 52 L330 96 V200Z" fill={p.shadow} transform="translate(0 3)" />
      <path d="M150 200 V96 L240 52 L330 96 V200Z" fill="#3c4757" />
      <path d="M142 98 L240 48 L338 98" fill="none" stroke="#2a323e" strokeWidth="9" strokeLinejoin="round" />
      {/* The window: warm room, lamp, table, two players and a board */}
      <rect x="176" y="104" width="128" height="76" rx="3" fill="#2a323e" />
      <rect x="181" y="109" width="118" height="66" rx="2" fill="#f3cf86" />
      <circle cx="240" cy="116" r="26" fill="#fbe2a8" opacity="0.8" />
      <path d="M232 109 V114 M226 114 H254 L248 122 H232Z" fill="#c45a3c" stroke="#7a3a26" strokeWidth="1" />
      <path d="M186 175 Q192 146 204 140 Q216 146 218 175Z" fill="#74465f" />
      <circle cx="204" cy="133" r="7.5" fill="#e2bf9c" />
      <path d="M262 175 Q264 146 276 140 Q288 146 294 175Z" fill="#34587a" />
      <circle cx="276" cy="133" r="7.5" fill="#c99a74" />
      <path d="M196 164 H284 V175 H196Z" fill="#8d6a4e" />
      <rect x="226" y="157" width="28" height="7" rx="1.5" fill="#ece4d2" />
      {[231, 237, 243, 249].map((x, i) => (
        <circle key={x} cx={x} cy={160.5} r={1.8} fill={i % 2 ? '#34587a' : '#c45a3c'} />
      ))}
      <path d="M240 109 V175 M181 142 H299" stroke="#2a323e" strokeWidth="2.4" opacity="0.55" />
      <rect x="170" y="180" width="140" height="6" rx="2" fill="#2a323e" />
      {/* Light spilling onto the grass */}
      <path d="M176 200 L190 186 H290 L304 200Z" fill="#f3cf86" opacity="0.14" />
      </g>
      <path d="M-400 188 Q-300 180 -200 186 Q-100 178 0 186 T200 188 T400 184 T600 188 V200 H-400Z" fill={p.land[3]} />
      {/* A tree on either side */}
      <circle cx="176" cy="156" r="18" fill={p.land[2]} />
      <rect x="174" y="164" width="4" height="24" fill="#141c22" />
      <circle cx="444" cy="146" r="24" fill={p.land[2]} />
      <rect x="442" y="160" width="4" height="28" fill="#141c22" />
    </svg>
  );
}
