import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { ruleDescription, ruleLabel, type Board, type Placement } from './logic';
import { DIRS, dirBetween, fits, occupancy, place, placeAt, remove, rotate, step, view, type Dir } from './play';

// ---------------------------------------------------------------------------
// Pips
// ---------------------------------------------------------------------------

/** Pip positions on a 3×3 grid, for a half lying across (horizontal tile). */
const PIPS: Record<number, [number, number][]> = {
  0: [],
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [1, 0], [2, 0], [0, 2], [1, 2], [2, 2]],
};

export function Pips({ value, upright }: { value: number; upright?: boolean }) {
  return (
    <svg className="cp-pips" viewBox="0 0 30 30" aria-hidden="true" focusable="false">
      {PIPS[value].map(([x, y], i) => {
        const [cx, cy] = upright ? [y, x] : [x, y];
        return <circle key={i} cx={6 + cx * 9} cy={6 + cy * 9} r={3.1} />;
      })}
    </svg>
  );
}

/** A domino drawn with `first` leading in direction `dir`. */
export function Tile({ first, second, dir, className = '', style }: { first: number; second: number; dir: Dir; className?: string; style?: CSSProperties }) {
  const across = dir === 0 || dir === 2;
  const [lead, trail] = dir === 0 || dir === 1 ? [first, second] : [second, first];
  return (
    <span className={`cp-tile ${across ? 'is-across' : 'is-upright'} ${className}`.trim()} style={style} aria-hidden="true">
      <span className="cp-tile__half"><Pips value={lead} upright={!across} /></span>
      <span className="cp-tile__half"><Pips value={trail} upright={!across} /></span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

const TINTS = ['clay', 'tide', 'moss', 'ochre', 'plum'] as const;

/** Give touching regions different tints (greedy colouring, stable order). */
function regionTints(board: Board): string[] {
  const owner = new Map<number, number>();
  board.regions.forEach((r, i) => r.cells.forEach((c) => owner.set(c, i)));
  const tints: string[] = [];
  board.regions.forEach((r, i) => {
    const taken = new Set<string>();
    for (const c of r.cells)
      for (const n of [c - 1, c + 1, c - board.w, c + board.w]) {
        const j = owner.get(n);
        if (j !== undefined && j < i && (Math.abs(n - c) !== 1 || Math.floor(n / board.w) === Math.floor(c / board.w))) taken.add(tints[j]);
      }
    // Least-used allowed tint, so the map doesn't settle on one colour.
    const allowed = TINTS.filter((t) => !taken.has(t));
    const uses = (t: string) => tints.filter((x) => x === t).length;
    tints.push(allowed.length ? allowed.reduce((a, b) => (uses(b) < uses(a) ? b : a)) : TINTS[i % TINTS.length]);
  });
  return tints;
}

/** Where a region's rule badge sits: its bottom-right-most cell. */
const badgeCell = (cells: number[], w: number) => cells.reduce((best, c) => (Math.floor(c / w) > Math.floor(best / w) || (Math.floor(c / w) === Math.floor(best / w) && c % w > best % w) ? c : best));

// ---------------------------------------------------------------------------
// Board + tray
// ---------------------------------------------------------------------------

export type ChangeKind = 'place' | 'move' | 'rotate' | 'remove';

interface Drag {
  d: number;
  from: 'tray' | 'board';
  pointerId: number;
  x0: number;
  y0: number;
  x: number;
  y: number;
  dir: Dir;
  /** Which half the pointer grabbed on a board domino (for tap-to-turn). */
  pivot: number;
  /** Pointer-to-ghost-centre offset, so the tile doesn't jump under the finger. */
  ox: number;
  oy: number;
  moved: boolean;
  touch: boolean;
}

export interface CoupletBoardProps {
  board: Board;
  placements: Placement[];
  hinted?: number[];
  solved?: boolean;
  onChange: (next: Placement[], kind: ChangeKind) => void;
  /** Bump to replay the solved ripple. */
  label: string;
}

const DIR_VEC: Record<Dir, [number, number]> = { 0: [1, 0], 1: [0, 1], 2: [-1, 0], 3: [0, -1] };

export function CoupletBoard({ board, placements, hinted = [], solved = false, onChange, label }: CoupletBoardProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(340);
  const [selected, setSelected] = useState<number | null>(null);
  /** Per-domino way round in the tray (direction its low value leads). */
  const [trayDir, setTrayDir] = useState<Record<number, Dir>>({});
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [nudge, setNudge] = useState<{ d: number; n: number } | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Cell size: as large as fits, capped so small boards don't balloon.
  const unit = Math.max(34, Math.min(58, Math.floor(width / board.w)));
  const trayUnit = Math.max(20, Math.min(30, Math.round(unit * 0.56)));
  const v = useMemo(() => view(board, placements), [board, placements]);
  const tints = useMemo(() => regionTints(board), [board]);
  const regionOf = useMemo(() => {
    const m = new Map<number, number>();
    board.regions.forEach((r, i) => r.cells.forEach((c) => m.set(c, i)));
    return m;
  }, [board]);
  const occ = useMemo(() => occupancy(placements), [placements]);
  const placed = useMemo(() => new Set(placements.map((p) => p.d)), [placements]);
  const onBoard = useMemo(() => new Set(board.cells), [board]);

  // Drop a selection once its domino lands, and forget its tray turn so it
  // comes back the usual way round if it's returned.
  useEffect(() => {
    if (selected !== null && placed.has(selected)) setSelected(null);
    setTrayDir((m) => {
      const stale = Object.keys(m).filter((d) => placed.has(Number(d)));
      if (!stale.length) return m;
      const next = { ...m };
      for (const d of stale) delete next[Number(d)];
      return next;
    });
  }, [placed, selected]);
  useEffect(() => {
    if (solved) setSelected(null);
  }, [solved]);

  const haptic = (ms: number) => {
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* not supported */
    }
  };

  const commit = useCallback(
    (next: Placement[] | null, kind: ChangeKind, d: number) => {
      if (!next) {
        setNudge((n) => ({ d, n: (n?.n ?? 0) + 1 }));
        return false;
      }
      haptic(kind === 'remove' ? 4 : 8);
      onChange(next, kind);
      return true;
    },
    [onChange],
  );

  // --- Snapping ------------------------------------------------------------

  /** Board cells a dragged domino would cover, given its ghost centre in client coords. */
  const snap = useCallback(
    (dr: Drag): { a: number; b: number; ok: boolean } | null => {
      const rect = boardRef.current?.getBoundingClientRect();
      if (!rect) return null;
      const cx = dr.x + dr.ox - rect.left;
      const cy = dr.y + dr.oy - rect.top;
      const [vx, vy] = DIR_VEC[dr.dir];
      const ax = cx - (vx * unit) / 2;
      const ay = cy - (vy * unit) / 2;
      const col = Math.floor(ax / unit);
      const row = Math.floor(ay / unit);
      if (col < 0 || row < 0 || col >= board.w || row >= board.h) return null;
      const a = row * board.w + col;
      const b = step(board, a, dr.dir);
      if (b < 0 || !onBoard.has(a) || !onBoard.has(b)) return null;
      return { a, b, ok: fits(board, placements, dr.d, a, b) };
    },
    [board, onBoard, placements, unit],
  );

  const target = drag?.moved ? snap(drag) : null;

  // --- Pointer gestures ----------------------------------------------------

  const begin = (e: ReactPointerEvent, d: number, from: 'tray' | 'board') => {
    if (solved || hinted.includes(d) || e.button > 0) return;
    const el = e.currentTarget as HTMLElement;
    const r = el.getBoundingClientRect();
    let dir: Dir = trayDir[d] ?? 0;
    let pivot = -1;
    const touch = e.pointerType !== 'mouse';
    let ox = 0;
    let oy = touch ? -unit * 0.85 : 0;
    if (from === 'board') {
      const p = placements.find((x) => x.d === d)!;
      dir = dirBetween(board, p.a, p.b);
      // The half under the pointer.
      const [vx, vy] = DIR_VEC[dir];
      const along = vx ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height;
      const leadFirst = dir === 0 || dir === 1;
      const onLead = along < 0.5;
      pivot = onLead === leadFirst ? p.a : p.b;
      ox = r.left + r.width / 2 - e.clientX;
      oy = r.top + r.height / 2 - e.clientY + (touch ? -unit * 0.45 : 0);
      void vy;
    }
    const dr: Drag = { d, from, pointerId: e.pointerId, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, dir, pivot, ox, oy, moved: false, touch };
    dragRef.current = dr;
    setDrag(dr);
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* jsdom */
    }
  };

  const move = (e: ReactPointerEvent) => {
    const dr = dragRef.current;
    if (!dr || e.pointerId !== dr.pointerId) return;
    const moved = dr.moved || Math.hypot(e.clientX - dr.x0, e.clientY - dr.y0) > 7;
    const next = { ...dr, x: e.clientX, y: e.clientY, moved };
    dragRef.current = next;
    setDrag(next);
  };

  const end = (e: ReactPointerEvent) => {
    const dr = dragRef.current;
    if (!dr || e.pointerId !== dr.pointerId) return;
    dragRef.current = null;
    setDrag(null);
    if (!dr.moved) {
      tap(dr);
      return;
    }
    const t = snap(dr);
    if (t?.ok) {
      const [first, second] = [t.a, t.b];
      commit(place(board, placements, dr.d, first, second), dr.from === 'tray' ? 'place' : 'move', dr.d);
      if (dr.from === 'tray') setSelected(null);
      return;
    }
    if (dr.from === 'board') {
      const rect = boardRef.current?.getBoundingClientRect();
      const x = dr.x + dr.ox;
      const y = dr.y + dr.oy;
      const outside = !rect || x < rect.left - unit * 0.3 || x > rect.right + unit * 0.3 || y < rect.top - unit * 0.3 || y > rect.bottom + unit * 0.3;
      if (outside) commit(remove(placements, dr.d), 'remove', dr.d);
      else setNudge((n) => ({ d: dr.d, n: (n?.n ?? 0) + 1 }));
    }
  };

  const cancel = () => {
    dragRef.current = null;
    setDrag(null);
  };

  const turnInTray = (d: number) => setTrayDir((m) => ({ ...m, [d]: (((m[d] ?? 0) + 1) % 4) as Dir }));

  const tap = (dr: Drag) => {
    if (dr.from === 'tray') {
      if (selected === dr.d) turnInTray(dr.d);
      else setSelected(dr.d);
      return;
    }
    commit(rotate(board, placements, dr.d, dr.pivot), 'rotate', dr.d);
  };

  const tapCell = (cell: number) => {
    if (solved || occ.has(cell)) return;
    if (selected === null) {
      setNudge((n) => ({ d: -1, n: (n?.n ?? 0) + 1 }));
      return;
    }
    const dir = trayDir[selected] ?? 0;
    if (commit(placeAt(board, placements, selected, cell, dir, false), 'place', selected)) setSelected(null);
  };

  // Keyboard: tray buttons select / turn; cells place; placed tiles turn or lift.
  const onTrayKey = (e: KeyboardEvent, d: number) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (selected === d) turnInTray(d);
    else setSelected(d);
  };
  const onTileKey = (e: KeyboardEvent, p: Placement) => {
    if (hinted.includes(p.d) || solved) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      commit(rotate(board, placements, p.d, p.a), 'rotate', p.d);
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      commit(remove(placements, p.d), 'remove', p.d);
    }
  };

  // --- Render --------------------------------------------------------------

  const cellLabel = (c: number) => {
    const r = Math.floor(c / board.w) + 1;
    const col = (c % board.w) + 1;
    const reg = regionOf.get(c);
    const rule = reg === undefined ? 'no rule' : `region ${ruleDescription(board.regions[reg].rule)}`;
    const val = v.values[c];
    return `Row ${r}, column ${col}, ${rule}${val >= 0 ? `, shows ${val}` : ', empty'}`;
  };

  const edge = (c: number, n: number, sameRow: boolean) => {
    if (!sameRow || !onBoard.has(n)) return true;
    return regionOf.get(c) !== regionOf.get(n);
  };

  const ghostDir = drag?.dir ?? 0;
  const ghostAcross = ghostDir === 0 || ghostDir === 2;
  const preview = target && drag ? [target.a, target.b] : [];

  return (
    <div className="cp-play" ref={wrapRef} data-solved={solved || undefined}>
      <div
        className="cp-board"
        ref={boardRef}
        role="group"
        aria-label={label}
        style={{ width: unit * board.w, height: unit * board.h, '--u': `${unit}px` } as CSSProperties}
      >
        {board.cells.map((c) => {
          const r = Math.floor(c / board.w);
          const col = c % board.w;
          const reg = regionOf.get(c);
          const tint = reg === undefined ? undefined : tints[reg];
          const cls = [
            'cp-cell',
            reg === undefined ? 'is-free' : `tint-${tint}`,
            edge(c, c - board.w, r > 0) && 'e-t',
            edge(c, c + 1, col + 1 < board.w) && 'e-r',
            edge(c, c + board.w, r + 1 < board.h) && 'e-b',
            edge(c, c - 1, col > 0) && 'e-l',
            preview.includes(c) && (target?.ok ? 'is-target' : 'is-blocked'),
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={c}
              type="button"
              className={cls}
              style={{ left: col * unit, top: r * unit, width: unit, height: unit }}
              aria-label={cellLabel(c)}
              onClick={() => tapCell(c)}
              tabIndex={occ.has(c) ? -1 : 0}
            />
          );
        })}

        {placements.map((p, i) => {
          const dir = dirBetween(board, p.a, p.b);
          const [x, y] = board.dominoes[p.d];
          const lead = dir === 0 || dir === 1 ? p.a : p.b;
          const across = dir === 0 || dir === 2;
          const left = (lead % board.w) * unit;
          const top = Math.floor(lead / board.w) * unit;
          const lifting = drag?.moved && drag.d === p.d;
          const locked = hinted.includes(p.d);
          return (
            <button
              key={p.d}
              type="button"
              className={`cp-placed${lifting ? ' is-lifting' : ''}${locked ? ' is-locked' : ''}${nudge?.d === p.d ? ` nudge-${nudge.n % 2}` : ''}`}
              style={{ left, top, width: across ? unit * 2 : unit, height: across ? unit : unit * 2, '--i': i } as CSSProperties}
              aria-label={`Domino ${x} and ${y}${locked ? ', placed by a hint' : ''}. Enter turns it, Delete returns it to the tray.`}
              onPointerDown={(e) => begin(e, p.d, 'board')}
              onPointerMove={move}
              onPointerUp={end}
              onPointerCancel={cancel}
              onKeyDown={(e) => onTileKey(e, p)}
            >
              <Tile first={x} second={y} dir={dir} />
              {locked && <span className="cp-placed__lock" aria-hidden="true" />}
            </button>
          );
        })}

        {board.regions.map((r, i) => {
          const c = badgeCell(r.cells, board.w);
          const status = v.statuses[i];
          return (
            <span
              key={i}
              className={`cp-badge tint-${tints[i]} is-${status}`}
              style={{ left: (c % board.w) * unit + unit, top: Math.floor(c / board.w) * unit + unit }}
              title={`This region ${ruleDescription(r.rule)}`}
              aria-hidden="true"
            >
              {ruleLabel(r.rule)}
            </span>
          );
        })}
      </div>

      {!solved && <ol className="cp-tray" aria-label="Dominoes to place" style={{ '--t': `${trayUnit}px` } as CSSProperties} data-nudge={nudge?.d === -1 ? nudge.n % 2 : undefined}>
        {board.dominoes.map(([x, y], d) => {
          const isPlaced = placed.has(d);
          const dir = trayDir[d] ?? 0;
          const lifting = drag?.moved && drag.d === d && drag.from === 'tray';
          return (
            <li key={d} className="cp-slot">
              {!isPlaced && (
                <button
                  type="button"
                  className={`cp-traytile${selected === d ? ' is-selected' : ''}${lifting ? ' is-lifting' : ''}${nudge?.d === d ? ` nudge-${nudge.n % 2}` : ''}`}
                  aria-pressed={selected === d}
                  aria-label={`Domino ${x} and ${y}${selected === d ? ', selected. Press again to turn it.' : ''}`}
                  onPointerDown={(e) => begin(e, d, 'tray')}
                  onPointerMove={move}
                  onPointerUp={end}
                  onPointerCancel={cancel}
                  onKeyDown={(e) => onTrayKey(e, d)}
                >
                  <Tile first={x} second={y} dir={dir} />
                </button>
              )}
            </li>
          );
        })}
      </ol>}

      {drag?.moved && (
        <div
          className={`cp-ghost${target?.ok ? ' is-ok' : ''}`}
          style={{
            left: drag.x + drag.ox,
            top: drag.y + drag.oy,
            width: ghostAcross ? unit * 2 : unit,
            height: ghostAcross ? unit : unit * 2,
            '--u': `${unit}px`,
          } as CSSProperties}
          aria-hidden="true"
        >
          <Tile first={board.dominoes[drag.d][0]} second={board.dominoes[drag.d][1]} dir={drag.dir} />
        </div>
      )}
    </div>
  );
}

export { DIRS };
