/**
 * Cover art for every game: a small place built from the game's own
 * mechanic. Daily puzzles are drawn in morning light, game-room games in
 * lamp-lit evening (see kit.tsx for the rules every scene follows).
 */
import type { ReactElement } from 'react';
import { Art, Cut, Foreground, H, Hills, LAMP, LIGHT, Scene, W, type Light } from './kit';

type CoverFn = (light: Light) => ReactElement;

const DAY: Light = 'day';
const NIGHT: Light = 'night';

// ---------------------------------------------------------------------------
// Daily puzzles: morning
// ---------------------------------------------------------------------------

/** Linkup: a stone bridge of four arches. Four groups, linked. */
const linkup: CoverFn = (light) => {
  const p = LIGHT[light];
  const arches = [82, 134, 186, 238];
  const holes = arches.map((x) => `M${x - 19} 178 V160 A19 19 0 0 1 ${x + 19} 160 V178Z`).join(' ');
  return (
    <Scene light={light} sun={[236, 84]}>
      <Hills light={light} horizon={146} />
      <path d={`M0 166 H${W} V196 H0Z`} fill="#c9d4cf" />
      <path d="M24 176 H92 M150 184 H226 M250 172 H300" stroke="#eef1ea" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
      {arches.map((x) => (
        <ellipse key={x} cx={x} cy={184} rx={15} ry={4} fill="#a9b7b1" />
      ))}
      <g>
        <path d={`M48 ${128 + 2.5} H272 V180 H48Z ${holes}`} fill={p.shadow} fillRule="evenodd" transform="translate(0 0)" />
        <path d={`M48 128 H272 V178 H48Z ${holes}`} fill="#c9805e" fillRule="evenodd" />
        <path d="M48 128 H272 V135 H48Z" fill="#b5694a" />
        <path d={`M44 124 H276`} stroke={p.ink} strokeWidth="1.3" strokeLinecap="round" />
        {[60, 108, 160, 212, 260].map((x) => (
          <rect key={x} x={x - 3} y={118} width={6} height={10} rx={1.5} fill="#b5694a" />
        ))}
      </g>
      <Foreground light={light} y={208} />
    </Scene>
  );
};

/** Wordsteps: a ladder from the meadow up to the sun, one rung at a time. */
const wordsteps: CoverFn = (light) => {
  const p = LIGHT[light];
  const rungs = Array.from({ length: 8 }, (_, i) => -14 - i * 18);
  return (
    <Scene light={light} sun={[238, 62]} sunR={18}>
      <Hills light={light} horizon={156} />
      <Cut d="M52 206 L66 150 Q74 132 86 150 L96 206Z" fill={p.land[2]} shadow={p.shadow} />
      <g transform="translate(146 204) rotate(27)">
        <rect x={-14} y={-154} width={4.5} height={154} rx={2} fill={p.shadow} transform="translate(2 1)" />
        <rect x={10} y={-154} width={4.5} height={154} rx={2} fill={p.shadow} transform="translate(2 1)" />
        {rungs.map((y) => (
          <rect key={y} x={-12} y={y} width={24} height={3.4} rx={1.5} fill="#a34a2b" />
        ))}
        <rect x={-14} y={-154} width={4.5} height={154} rx={2} fill="#b9512f" />
        <rect x={10} y={-154} width={4.5} height={154} rx={2} fill="#b9512f" />
      </g>
      <Foreground light={light} y={206} />
    </Scene>
  );
};

function Domino({ x, y, angle, top, bottom }: { x: number; y: number; angle: number; top: number; bottom: number }) {
  const pips: Record<number, [number, number][]> = {
    1: [[0, 0]],
    2: [[-1, -1], [1, 1]],
    3: [[-1, -1], [0, 0], [1, 1]],
    4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
    5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]],
    6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
  };
  const half = (n: number, cy: number) => pips[n].map(([dx, dy], i) => <circle key={`${cy}${i}`} cx={dx * 11} cy={cy + dy * 11} r={3.6} fill="#1c2420" />);
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <rect x={-23} y={-98} width={46} height={98} rx={8} fill="rgba(60,50,30,0.2)" transform="translate(3 3)" />
      <rect x={-23} y={-98} width={46} height={98} rx={8} fill="#fbf6ea" />
      <rect x={-23} y={-6} width={46} height={6} rx={3} fill="#e6dcc6" />
      <path d="M-17 -49 H17" stroke="#c9bda4" strokeWidth="1.4" />
      {half(top, -73)}
      {half(bottom, -26)}
    </g>
  );
}

/** Couplet: two dominoes leaning into an arch over patchwork fields. */
const couplet: CoverFn = (light) => {
  const p = LIGHT[light];
  return (
    <Scene light={light} sun={[160, 141]} sunR={11}>
      <path d="M0 150 Q60 136 120 144 T240 140 T320 146 V240 H0Z" fill={p.land[0]} />
      {/* Fields as regions: tinted patches with inked borders, like the board. */}
      <Cut d="M0 168 L118 160 L134 200 L0 212Z" fill="#d4dfea" shadow={p.shadow} />
      <Cut d="M118 160 L214 158 L226 196 L134 200Z" fill="#c8cfae" shadow={p.shadow} />
      <Cut d="M214 158 L320 164 L320 208 L226 196Z" fill="#f1d9cb" shadow={p.shadow} />
      <path d="M118 160 L134 200 M214 158 L226 196" stroke={p.ink} strokeWidth="1" opacity="0.35" />
      <g transform="translate(160 192) scale(1.18) translate(-160 -192)">
        <Domino x={196} y={188} angle={-14} top={6} bottom={2} />
        <Domino x={124} y={188} angle={14} top={3} bottom={5} />
      </g>
      <Foreground light={light} y={212} />
    </Scene>
  );
};

function Figure({ x, y, coat, hat, skin = '#e5c3a0', s = 1 }: { x: number; y: number; coat: string; hat?: 'cap' | 'beret' | 'none'; skin?: string; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={11} ry={2.6} fill="rgba(60,50,30,0.18)" />
      <rect x={-5.5} y={-8} width={3.4} height={8} fill="#2f2a26" />
      <rect x={2.1} y={-8} width={3.4} height={8} fill="#2f2a26" />
      <path d="M-9 -8 L-6.5 -32 Q0 -36 6.5 -32 L9 -8Z" fill={coat} />
      <circle cx={0} cy={-39} r={6.4} fill={skin} />
      {hat === 'cap' && <path d="M-6.6 -41 Q0 -49 6.6 -41 Z M4 -42 H10 V-40.4 H4Z" fill="#2f2a26" />}
      {hat === 'beret' && <ellipse cx={0.5} cy={-44} rx={7.5} ry={3} fill="#2f2a26" />}
    </g>
  );
}

/** Deduction: a lineup on the ridge. One coat stands out. */
const deduction: CoverFn = (light) => {
  const p = LIGHT[light];
  return (
    <Scene light={light} sun={[198, 58]}>
      <path d="M0 150 Q60 138 120 146 T240 142 T320 148 V240 H0Z" fill={p.land[0]} />
      <Cut d="M0 196 Q90 162 160 170 Q240 162 320 190 V240 H0Z" fill={p.land[1]} shadow={p.shadow} />
      <Figure x={84} y={184} s={1.45} coat="#9a8a72" hat="none" />
      <Figure x={122} y={176} s={1.45} coat="#6f7c62" hat="cap" />
      <Figure x={160} y={172} s={1.45} coat="#8a7a68" hat="beret" />
      <Figure x={198} y={174} s={1.45} coat="#74465f" hat="cap" />
      <Figure x={236} y={182} s={1.45} coat="#5f6b70" hat="none" />
      <Foreground light={light} y={212} />
    </Scene>
  );
};

/** Sumwise: stones balanced into a cairn. The top one makes the total. */
const sumwise: CoverFn = (light) => {
  const p = LIGHT[light];
  const stones: [number, number, number, number, string][] = [
    [160, 196, 74, 24, '#9c9482'],
    [155, 174, 58, 22, '#b4ab96'],
    [163, 154, 44, 19, '#a69d88'],
    [158, 137, 30, 16, '#c9932f'],
  ];
  return (
    <Scene light={light} sun={[96, 78]}>
      <Hills light={light} horizon={160} />
      <path d="M236 204 V104" stroke={p.ink} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M236 105 L264 113 L236 121Z" fill="#efe2c9" />
      <g transform="translate(-48 -66) scale(1.3)">
      {stones.map(([x, y, w, h, c], i) => (
        <Cut key={i} d={`M${x - w / 2} ${y} Q${x - w / 2} ${y - h} ${x} ${y - h} Q${x + w / 2} ${y - h} ${x + w / 2} ${y} Q${x} ${y + 4} ${x - w / 2} ${y}Z`} fill={c} shadow={p.shadow} lift={2} />
      ))}
      </g>
      <Foreground light={light} y={210} />
    </Scene>
  );
};

/** Wordcraft: five little houses make a word. Two windows are lit. */
const wordcraft: CoverFn = (light) => {
  const p = LIGHT[light];
  const xs = [72, 116, 160, 204, 248];
  const wall = ['#efe2c9', '#e6d4b4', '#efe2c9', '#e9d8bb', '#e3d0ae'];
  const lit: Record<number, string> = { 1: '#9cbf88', 3: '#f0c36a' };
  return (
    <Scene light={light} sun={[256, 62]}>
      <Hills light={light} horizon={150} />
      {xs.map((x, i) => {
        const top = 140 - (i % 2) * 8;
        return (
          <g key={x}>
            <Cut d={`M${x - 19} 198 V${top} L${x} ${top - 22} L${x + 19} ${top} V198Z`} fill={wall[i]} shadow={p.shadow} />
            <path d={`M${x - 21} ${top + 1} L${x} ${top - 23} L${x + 21} ${top + 1}`} fill="none" stroke={i % 2 ? '#7c4433' : '#4a4038'} strokeWidth="6" strokeLinejoin="round" />
            <rect x={x - 7.5} y={top + 13} width={15} height={17} rx={1.5} fill={lit[i] ?? '#6c6150'} />
            <rect x={x - 4} y={186} width={8} height={12} rx={1.5} fill="#8d7c64" />
          </g>
        );
      })}
      <Foreground light={light} y={204} />
    </Scene>
  );
};

/** Pattern (retired): stones in a growing sequence, the next one dotted in. */
const pattern: CoverFn = (light) => {
  const p = LIGHT[light];
  return (
    <Scene light={light} sun={[90, 74]}>
      <Hills light={light} horizon={156} />
      {[[110, 18], [146, 30], [184, 44]].map(([x, h]) => (
        <Cut key={x} d={`M${x - 11} 196 V${196 - h} Q${x} ${190 - h} ${x + 11} ${196 - h} V196Z`} fill="#a69d88" shadow={p.shadow} />
      ))}
      <path d="M212 196 V136 Q224 128 236 136 V196" fill="none" stroke={p.ink} strokeWidth="1.5" strokeDasharray="4 4" />
      <Foreground light={light} y={206} />
    </Scene>
  );
};

// ---------------------------------------------------------------------------
// Game room: evening
// ---------------------------------------------------------------------------

/** Connect Four: an apartment block at night, four windows lit in a line. */
const connectFour: CoverFn = (light) => {
  const p = LIGHT[light];
  const cols = 7;
  const rows = 6;
  const win = new Set(['5,1', '4,2', '3,3', '2,4']);
  const warm = new Set(['0,0', '5,5', '1,6', '0,3', '4,5']);
  return (
    <Scene light={light} sun={[266, 54]} sunR={14}>
      <Cut d="M20 206 V128 H74 V206Z" fill={p.land[1]} shadow={p.shadow} />
      <Cut d="M246 206 V112 H300 V206Z" fill={p.land[1]} shadow={p.shadow} />
      <Cut d="M100 210 V58 H220 V210Z" fill="#3c4a5c" shadow={p.shadow} />
      <rect x={132} y={46} width={18} height={12} fill="#33404f" />
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => {
          const k = `${r},${c}`;
          const fill = win.has(k) ? '#e9875f' : warm.has(k) ? LAMP : '#28323e';
          return <rect key={k} x={108 + c * 15.4} y={70 + r * 21} width={10.5} height={14} rx={1.5} fill={fill} />;
        }),
      )}
      {[[40, 140], [56, 164], [262, 128], [280, 156]].map(([x, y]) => (
        <rect key={`${x}${y}`} x={x} y={y} width={7} height={9} rx={1} fill={LAMP} opacity={0.75} />
      ))}
      <Foreground light={light} y={206} />
    </Scene>
  );
};

/** Mines: a night field marked with flags, a lantern for the careful. */
const mines: CoverFn = (light) => {
  const p = LIGHT[light];
  const flag = (x: number, y: number, s = 1) => (
    <g key={`${x}${y}`} transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 0 V-26" stroke="#d8cfbc" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M0 -26 L15 -21 L0 -16Z" fill="#e07a55" />
    </g>
  );
  return (
    <Scene light={light} sun={[78, 58]} sunR={13}>
      <path d={`M0 138 Q80 128 160 134 T320 132 V${H} H0Z`} fill={p.land[0]} />
      <Cut d={`M0 150 H${W} V${H} H0Z`} fill={p.land[2]} shadow={p.shadow} />
      {[-120, -60, 0, 60, 120].map((dx) => (
        <path key={dx} d={`M${160 + dx * 0.35} 150 L${160 + dx * 2.2} ${H}`} stroke="#2d3b45" strokeWidth="1.2" />
      ))}
      {[164, 184, 210].map((y) => (
        <path key={y} d={`M0 ${y} H${W}`} stroke="#2d3b45" strokeWidth="1.2" />
      ))}
      {flag(112, 182)}
      {flag(204, 168, 0.85)}
      {flag(238, 214, 1.15)}
      <circle cx={150} cy={196} r={22} fill={LAMP} opacity={0.18} />
      <rect x={145} y={186} width={10} height={14} rx={2.5} fill={LAMP} />
      <path d="M146 186 Q150 180 154 186" fill="none" stroke="#d8cfbc" strokeWidth="1.4" />
    </Scene>
  );
};

/** Patience: a hand of cards fanned like hills under the moon. */
const patience: CoverFn = (light) => {
  const p = LIGHT[light];
  const angles = [-34, -17, 0, 17, 34];
  return (
    <Scene light={light} sun={[160, 52]} sunR={14}>
      <Hills light={light} horizon={168} />
      {angles.map((a, i) => (
        <g key={a} transform={`translate(160 230) rotate(${a})`}>
          <rect x={-29} y={-132} width={58} height={84} rx={6} fill={p.shadow} transform="translate(2 3)" />
          <rect x={-29} y={-132} width={58} height={84} rx={6} fill={i === 4 ? '#f4ecda' : '#e3d9c4'} />
          {i < 4 && <rect x={-24} y={-127} width={48} height={74} rx={4} fill="none" stroke="#34587a" strokeWidth="1.2" opacity={0.55} />}
        </g>
      ))}
      <g transform="translate(160 230) rotate(34)">
        <path d="M0 -84 C-12 -96 -22 -84 0 -66 C22 -84 12 -96 0 -84Z" fill="#c45a3c" />
        <text x={-22} y={-114} fontFamily="Fraunces, Georgia, serif" fontWeight={600} fontSize={14} fill="#c45a3c">A</text>
      </g>
      <Foreground light={light} y={214} />
    </Scene>
  );
};

/** Pocket Sudoku: a cottage with a nine-pane window, lamp-lit. */
const sudoku: CoverFn = (light) => {
  const p = LIGHT[light];
  return (
    <Scene light={light} sun={[254, 56]} sunR={13}>
      <Hills light={light} horizon={158} />
      <Cut d="M50 204 L70 132 L90 204Z" fill={p.land[2]} shadow={p.shadow} />
      <Cut d="M232 204 L250 144 L268 204Z" fill={p.land[2]} shadow={p.shadow} />
      <rect x={186} y={70} width={12} height={28} fill="#5a4a44" />
      <path d="M192 66 Q186 56 194 48 Q200 40 194 30" fill="none" stroke="#8f8a7a" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      <Cut d="M106 206 V122 L160 82 L214 122 V206Z" fill="#e3d6bc" shadow={p.shadow} />
      <path d="M98 124 L160 78 L222 124" fill="none" stroke="#5a4a44" strokeWidth="9" strokeLinejoin="round" />
      <rect x={128} y={128} width={64} height={64} rx={2} fill="#5a4a44" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect key={`${r}${c}`} x={131 + c * 20.3} y={131 + r * 20.3} width={17.5} height={17.5} fill={r === 1 && c === 1 ? '#f6d68c' : LAMP} opacity={r === 1 && c === 1 ? 1 : 0.86} />
        )),
      )}
      <text x={160} y={166} textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontWeight={600} fontSize={14} fill="#4d6b4f">7</text>
      <Foreground light={light} y={210} />
    </Scene>
  );
};

/** Picture Logic: an easel, the picture half filled in from the clues. */
const pictureLogic: CoverFn = (light) => {
  const p = LIGHT[light];
  // An 8×8 pine tree, revealed from the bottom up.
  const art = ['...##...', '..####..', '...##...', '..####..', '.######.', '..####..', '.######.', '...##...'];
  const s = 11;
  const x0 = 116;
  const y0 = 64;
  return (
    <Scene light={light} sun={[256, 56]} sunR={12}>
      <Hills light={light} horizon={168} />
      <path d="M126 196 L148 70 M194 196 L172 70 M160 160 V206" stroke="#a7825c" strokeWidth="5" strokeLinecap="round" />
      <rect x={x0 - 8} y={y0 - 8} width={s * 8 + 16} height={s * 8 + 16} rx={3} fill={p.shadow} transform="translate(2 3)" />
      <rect x={x0 - 8} y={y0 - 8} width={s * 8 + 16} height={s * 8 + 16} rx={3} fill="#efe6d6" />
      {art.map((row, r) =>
        [...row].map((ch, c) => {
          const revealed = r >= 3;
          const x = x0 + c * s;
          const y = y0 + r * s;
          if (revealed && ch === '#') return <rect key={`${r}${c}`} x={x + 0.6} y={y + 0.6} width={s - 1.2} height={s - 1.2} rx={1} fill={r === 7 ? '#8d6a4e' : '#74465f'} />;
          if (!revealed) return <rect key={`${r}${c}`} x={x + 0.6} y={y + 0.6} width={s - 1.2} height={s - 1.2} fill="none" stroke="#cfc3ad" strokeWidth="0.8" />;
          return null;
        }),
      )}
      <rect x={x0 - 12} y={y0 + s * 8 + 6} width={s * 8 + 24} height={6} rx={2} fill="#8d6a4e" />
      <Foreground light={light} y={208} />
    </Scene>
  );
};

/** Reversi: stepping stones across a pond, black and white, under a half moon. */
const reversi: CoverFn = (light) => {
  const p = LIGHT[light];
  const stones: [number, number, number, boolean][] = [
    [98, 168, 9, true], [132, 174, 11, false], [170, 182, 13, true], [212, 194, 16, false], [256, 210, 19, true],
  ];
  return (
    <Scene light={light} sun={null}>
      <g>
        <circle cx={238} cy={64} r={30} fill={LIGHT.night.halo} opacity={0.35} />
        <circle cx={238} cy={64} r={16} fill="#f2e4c2" />
        <path d="M238 48 A16 16 0 0 0 238 80Z" fill="#2b3a52" />
      </g>
      <Hills light={light} horizon={148} />
      <ellipse cx={170} cy={194} rx={150} ry={34} fill="#30475c" />
      <path d="M232 180 H248 M222 188 H262 M236 196 H252" stroke="#f2e4c2" strokeWidth="1.4" strokeLinecap="round" opacity="0.4" />
      {stones.map(([x, y, r, dark]) => (
        <g key={x}>
          <ellipse cx={x} cy={y + 2.5} rx={r} ry={r * 0.45} fill={p.shadow} />
          <ellipse cx={x} cy={y} rx={r} ry={r * 0.45} fill={dark ? '#141a20' : '#ece4d2'} />
        </g>
      ))}
      <Foreground light={light} y={222} />
    </Scene>
  );
};

/** Dots & Boxes: fence posts and rails across a field; one paddock closed and claimed. */
const dotsBoxes: CoverFn = (light) => {
  const p = LIGHT[light];
  // Two rows of paddocks in gentle perspective.
  const rowY = [132, 162, 200];
  const spread = [0.78, 0.9, 1.06];
  const colX = (ci: number, ri: number) => 160 + (ci - 1.5) * 64 * spread[ri];
  const post = (x: number, y: number, k: number) => <rect key={k} x={x - 3.2 * spread[0] - 0.4} y={y - 12} width={6.4} height={14} rx={1.6} fill="#ece4d2" />;
  return (
    <Scene light={light} sun={[252, 52]} sunR={13}>
      <path d={`M0 128 Q80 116 160 124 T320 122 V${H} H0Z`} fill={p.land[0]} />
      <Cut d={`M0 128 H${W} V${H} H0Z`} fill={p.land[2]} shadow={p.shadow} />
      <path d={`M${colX(1, 0)} ${rowY[0]} H${colX(2, 0)} L${colX(2, 1)} ${rowY[1]} H${colX(1, 1)}Z`} fill="#c45a3c" />
      <g stroke="#d9cfba" strokeWidth="2.6" strokeLinecap="round">
        {rowY.map((y, ri) => (
          <path key={`h${ri}`} d={`M${colX(0, ri)} ${y - 5} H${colX(ri === 2 ? 2 : 3, ri)}`} />
        ))}
        {[0, 1, 2, 3].map((ci) => (
          <path key={`v${ci}`} d={`M${colX(ci, 0)} ${rowY[0] - 5} L${colX(ci, 1)} ${rowY[1] - 5}`} />
        ))}
        {[0, 1].map((ci) => (
          <path key={`w${ci}`} d={`M${colX(ci, 1)} ${rowY[1] - 5} L${colX(ci, 2)} ${rowY[2] - 5}`} />
        ))}
      </g>
      {rowY.map((y, ri) => [0, 1, 2, 3].map((ci) => post(colX(ci, ri), y, ri * 4 + ci)))}
      <Foreground light={light} y={222} />
    </Scene>
  );
};

/** Mancala: a long boat with seed pits, drifting under the moon. */
const mancala: CoverFn = (light) => {
  const p = LIGHT[light];
  const pits = [104, 128, 152, 176, 200, 224];
  return (
    <Scene light={light} sun={[92, 60]} sunR={14}>
      <path d={`M0 140 Q90 128 170 136 T320 132 V${H} H0Z`} fill={p.land[0]} />
      <path d={`M0 152 H${W} V${H} H0Z`} fill="#2b4055" />
      <path d="M88 172 V214 M84 182 H96 M80 196 H100" stroke="#f2e4c2" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
      <Cut d="M64 170 Q160 158 256 170 Q250 196 220 202 H100 Q70 196 64 170Z" fill="#b07a44" shadow="rgba(0,0,0,0.35)" />
      <path d="M70 172 Q160 162 250 172" fill="none" stroke="#d29a5c" strokeWidth="2.4" strokeLinecap="round" />
      {pits.map((x, i) => (
        <g key={x}>
          <ellipse cx={x} cy={182} rx={9} ry={5.2} fill="#6e4524" />
          {Array.from({ length: (i % 3) + 1 }, (_, k) => (
            <circle key={k} cx={x - 3 + k * 3} cy={182 + (k % 2)} r={1.8} fill="#efe2c9" />
          ))}
        </g>
      ))}
      <path d="M90 214 Q160 208 230 214" stroke="#162433" strokeWidth="5" strokeLinecap="round" opacity="0.6" />
    </Scene>
  );
};

/** Mini Battleship: a lighthouse sweeping the bay for two hidden boats. */
const battleship: CoverFn = (light) => {
  const p = LIGHT[light];
  return (
    <Scene light={light} sun={[72, 52]} sunR={12}>
      <path d={`M0 150 H${W} V${H} H0Z`} fill="#26394d" />
      <path d="M232 92 L30 64 L30 118Z" fill="#f6dca0" opacity="0.26" />
      <Cut d="M200 206 Q226 168 262 170 Q300 172 320 160 V240 H200Z" fill={p.land[3]} shadow={p.shadow} />
      <path d="M222 172 L228 98 H240 L246 172Z" fill="#ece4d2" />
      <path d="M224.6 140 H243.4 L244.6 156 H223.4Z M226.8 112 H241.2 L242.2 126 H225.8Z" fill="#c45a3c" />
      <rect x={224} y={86} width={20} height={12} rx={2} fill={LAMP} />
      <path d="M220 86 L234 74 L248 86Z" fill="#c45a3c" />
      <path d="M86 186 H126 L120 194 H92Z" fill="#141c22" />
      <path d="M100 186 V172 L112 182" fill="#141c22" />
      <path d="M150 168 H176 L172 173 H154Z" fill="#141c22" opacity="0.8" />
      <circle cx={134} cy={206} r={7} fill="none" stroke="#b9c7d4" strokeWidth="1.3" opacity="0.6" />
      <circle cx={134} cy={206} r={13} fill="none" stroke="#b9c7d4" strokeWidth="1" opacity="0.3" />
    </Scene>
  );
};

/** Mystery Grid: a townhouse at night; one window holds the answer. */
const mysteryGrid: CoverFn = (light) => {
  const p = LIGHT[light];
  return (
    <Scene light={light} sun={[64, 56]} sunR={12}>
      <Hills light={light} horizon={160} />
      <Cut d="M114 208 V86 L160 60 L206 86 V208Z" fill="#40495a" shadow={p.shadow} />
      {[0, 1].map((r) =>
        [0, 1].map((c) => {
          const lit = r === 0 && c === 1;
          return (
            <g key={`${r}${c}`}>
              <rect x={128 + c * 46} y={96 + r * 44} width={20} height={28} rx={2} fill={lit ? '#d9a6c0' : '#262e3a'} />
              {lit && <path d={`M${184} ${124} V${116} Q${184} ${108} ${178} ${108}`} fill="none" />}
              {lit && <circle cx={184} cy={109} r={4.2} fill="#3a2a35" />}
              {lit && <path d="M177 124 Q184 112 191 124Z" fill="#3a2a35" />}
            </g>
          );
        }),
      )}
      <rect x={150} y={176} width={20} height={32} rx={9} fill="#262e3a" />
      <circle cx={165} cy={193} r={1.6} fill={LAMP} />
      <Foreground light={light} y={208} />
    </Scene>
  );
};

/** Tic-Tac-Toe: a chalk game on the garden wall. */
const ticTacToe: CoverFn = (light) => {
  const p = LIGHT[light];
  const chalk = '#e8e0cf';
  return (
    <Scene light={light} sun={[252, 52]} sunR={12}>
      <Hills light={light} horizon={150} />
      <Cut d="M40 210 V120 H280 V210Z" fill="#59606b" shadow={p.shadow} />
      {[132, 152, 172, 192].map((y) => (
        <path key={y} d={`M40 ${y} H280`} stroke="#4b525c" strokeWidth="1.2" />
      ))}
      <g stroke={chalk} strokeWidth="2.4" strokeLinecap="round" fill="none" opacity="0.92">
        <path d="M144 128 L142 202 M176 128 L178 202 M118 152 H202 M118 178 H202" />
        <path d="M124 134 L136 146 M136 134 L124 146" />
        <circle cx={160} cy={165} r={7} />
        <path d="M186 184 L196 196 M196 184 L186 196" />
        <circle cx={128} cy={190} r={6.5} />
      </g>
      <Foreground light={light} y={214} />
    </Scene>
  );
};

/** Memory Match: two matching lanterns rising among the faint ones. */
const memoryMatch: CoverFn = (light) => {
  const lantern = (x: number, y: number, s: number, bright: boolean) => (
    <g key={`${x}${y}`} transform={`translate(${x} ${y}) scale(${s})`} opacity={bright ? 1 : 0.4}>
      {bright && <circle cx={0} cy={0} r={22} fill={LAMP} opacity={0.18} />}
      <path d="M-9 -12 Q0 -16 9 -12 L7 12 Q0 14 -7 12Z" fill={bright ? '#f2b85e' : '#c9935a'} />
      <rect x={-5} y={12} width={10} height={3} rx={1} fill="#8f5d34" />
    </g>
  );
  return (
    <Scene light={light} sun={[260, 48]} sunR={11}>
      {lantern(96, 74, 0.7, false)}
      {lantern(214, 112, 0.6, false)}
      {lantern(66, 128, 0.55, false)}
      {lantern(132, 96, 1.25, true)}
      {lantern(190, 72, 1.25, true)}
      <Hills light={light} horizon={170} />
      <Foreground light={light} y={214} />
    </Scene>
  );
};

/** Lost path: for empty and not-found screens. */
const wander: CoverFn = (light) => {
  const p = LIGHT[light];
  return (
    <Scene light={light} sun={[232, 72]}>
      <Hills light={light} horizon={154} />
      <path d="M118 240 Q140 214 170 204 Q196 196 186 182" fill="none" stroke={p.path} strokeWidth="9" strokeLinecap="round" />
      <path d="M186 182 L186 140" stroke={p.ink} strokeWidth="2" strokeLinecap="round" />
      <path d="M186 146 H222 L230 152 L222 158 H186Z" fill="#e6d4b4" />
      <path d="M186 160 H154 L146 166 L154 172 H186Z" fill="#d9c3a0" />
      <Foreground light={light} y={214} />
    </Scene>
  );
};

export const COVERS: Record<string, { draw: CoverFn; light: Light }> = {
  linkup: { draw: linkup, light: DAY },
  wordsteps: { draw: wordsteps, light: DAY },
  couplet: { draw: couplet, light: DAY },
  deduction: { draw: deduction, light: DAY },
  sumwise: { draw: sumwise, light: DAY },
  wordcraft: { draw: wordcraft, light: DAY },
  pattern: { draw: pattern, light: DAY },
  'connect-four': { draw: connectFour, light: NIGHT },
  mines: { draw: mines, light: NIGHT },
  patience: { draw: patience, light: NIGHT },
  sudoku: { draw: sudoku, light: NIGHT },
  'picture-logic': { draw: pictureLogic, light: NIGHT },
  reversi: { draw: reversi, light: NIGHT },
  'dots-boxes': { draw: dotsBoxes, light: NIGHT },
  mancala: { draw: mancala, light: NIGHT },
  battleship: { draw: battleship, light: NIGHT },
  'mystery-grid': { draw: mysteryGrid, light: NIGHT },
  'tic-tac-toe': { draw: ticTacToe, light: NIGHT },
  'memory-match': { draw: memoryMatch, light: NIGHT },
  wander: { draw: wander, light: DAY },
};

/**
 * A game's cover. `mood` brightens the scene for a finished puzzle (the sun
 * rises a little) or quiets it for one that got away.
 */
export function Cover({ id, className = '', mood, ratio }: { id: string; className?: string; mood?: 'won' | 'lost'; ratio?: string }) {
  const c = COVERS[id];
  if (!c) return null;
  return (
    <Art className={`art--${c.light} ${mood ? `art--${mood}` : ''} ${className}`.trim()} ratio={ratio}>
      {c.draw(c.light)}
    </Art>
  );
}

export { H as COVER_H, W as COVER_W };
