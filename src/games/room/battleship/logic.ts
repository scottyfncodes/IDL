/**
 * Mini Battleship rules. Pure functions, no React.
 *
 * Board: 7×7, cells indexed row-major (index = row * SIZE + col).
 * Fleet: five boats of lengths 4, 3, 3, 2, 2. Boats may touch but never overlap.
 * Turns: one shot per turn, strictly alternating (no extra shot on a hit).
 */
import type { Rng } from '../../../lib/rng';

export const SIZE = 7;
export const CELLS = SIZE * SIZE;

export type Orientation = 'h' | 'v';
export type Player = 0 | 1;

export interface ShipSpec {
  id: string;
  name: string;
  length: number;
}

export const FLEET: readonly ShipSpec[] = [
  { id: 'schooner', name: 'Schooner', length: 4 },
  { id: 'ferry', name: 'Ferry', length: 3 },
  { id: 'trawler', name: 'Trawler', length: 3 },
  { id: 'tug', name: 'Tug', length: 2 },
  { id: 'skiff', name: 'Skiff', length: 2 },
];

export const FLEET_CELLS = FLEET.reduce((n, s) => n + s.length, 0);

export const specOf = (id: string): ShipSpec => {
  const s = FLEET.find((f) => f.id === id);
  if (!s) throw new Error(`Unknown ship ${id}`);
  return s;
};

export interface Placement {
  id: string;
  row: number;
  col: number;
  orient: Orientation;
}

export type Fleet = Placement[];

export const rowOf = (i: number) => Math.floor(i / SIZE);
export const colOf = (i: number) => i % SIZE;
export const indexOf = (row: number, col: number) => row * SIZE + col;

/** Cells a placement would cover, or null if any part leaves the board. */
export function cellsFor(p: Placement): number[] | null {
  const { length } = specOf(p.id);
  if (p.row < 0 || p.col < 0 || p.row >= SIZE || p.col >= SIZE) return null;
  const endRow = p.orient === 'v' ? p.row + length - 1 : p.row;
  const endCol = p.orient === 'h' ? p.col + length - 1 : p.col;
  if (endRow >= SIZE || endCol >= SIZE) return null;
  const out: number[] = [];
  for (let k = 0; k < length; k++) out.push(p.orient === 'h' ? indexOf(p.row, p.col + k) : indexOf(p.row + k, p.col));
  return out;
}

/** Same as cellsFor, but clipped to the board — used to draw an invalid preview. */
export function previewCells(p: Placement): number[] {
  const { length } = specOf(p.id);
  const out: number[] = [];
  for (let k = 0; k < length; k++) {
    const r = p.orient === 'v' ? p.row + k : p.row;
    const c = p.orient === 'h' ? p.col + k : p.col;
    if (r >= 0 && c >= 0 && r < SIZE && c < SIZE) out.push(indexOf(r, c));
  }
  return out;
}

export function occupied(fleet: Fleet, ignoreId?: string): Set<number> {
  const out = new Set<number>();
  for (const p of fleet) {
    if (p.id === ignoreId) continue;
    for (const c of cellsFor(p) ?? []) out.add(c);
  }
  return out;
}

/** Is `p` legal given the rest of the fleet (any existing placement of the same boat is ignored)? */
export function canPlace(fleet: Fleet, p: Placement): boolean {
  const cells = cellsFor(p);
  if (!cells) return false;
  const taken = occupied(fleet, p.id);
  return cells.every((c) => !taken.has(c));
}

/** Returns a new fleet with `p` placed (replacing that boat if already placed), or the same fleet if illegal. */
export function placeShip(fleet: Fleet, p: Placement): Fleet {
  if (!canPlace(fleet, p)) return fleet;
  return [...fleet.filter((f) => f.id !== p.id), { ...p }];
}

export const removeShip = (fleet: Fleet, id: string): Fleet => fleet.filter((f) => f.id !== id);

export function shipAt(fleet: Fleet, cell: number): Placement | undefined {
  return fleet.find((p) => cellsFor(p)?.includes(cell));
}

/** Every boat placed exactly once, all legal, none overlapping. */
export function isFleetComplete(fleet: Fleet): boolean {
  if (fleet.length !== FLEET.length) return false;
  if (!FLEET.every((s) => fleet.filter((p) => p.id === s.id).length === 1)) return false;
  const seen = new Set<number>();
  for (const p of fleet) {
    const cells = cellsFor(p);
    if (!cells) return false;
    for (const c of cells) {
      if (seen.has(c)) return false;
      seen.add(c);
    }
  }
  return true;
}

/** A complete, legal random fleet. */
export function randomFleet(rng: Rng): Fleet {
  for (;;) {
    let fleet: Fleet = [];
    let ok = true;
    for (const spec of FLEET) {
      const options: Placement[] = [];
      for (const orient of ['h', 'v'] as Orientation[])
        for (let row = 0; row < SIZE; row++)
          for (let col = 0; col < SIZE; col++) {
            const p = { id: spec.id, row, col, orient };
            if (canPlace(fleet, p)) options.push(p);
          }
      if (options.length === 0) {
        ok = false;
        break;
      }
      fleet = placeShip(fleet, rng.pick(options));
    }
    if (ok) return fleet;
  }
}

// ---- Game ----------------------------------------------------------------

export type Phase = 'setup' | 'battle' | 'over';

export interface ShotRecord {
  cell: number;
  hit: boolean;
  /** Id of the boat this shot sank, if any. */
  sunk: string | null;
}

export interface Game {
  phase: Phase;
  /** Who places first and who fires first. */
  starter: Player;
  /** Setup: who is placing. Battle: who fires next. Over: the winner. */
  turn: Player;
  fleets: [Fleet, Fleet];
  /** shots[p] = shots player p has fired at the other player's waters, in order. */
  shots: [ShotRecord[], ShotRecord[]];
  winner: Player | null;
}

export const other = (p: Player): Player => (p === 0 ? 1 : 0);

export function newGame(starter: Player = 0): Game {
  return { phase: 'setup', starter, turn: starter, fleets: [[], []], shots: [[], []], winner: null };
}

/** Replace the placing player's (draft) fleet during setup. */
export function setFleet(game: Game, fleet: Fleet): Game {
  if (game.phase !== 'setup') return game;
  const fleets: [Fleet, Fleet] = [game.fleets[0], game.fleets[1]];
  fleets[game.turn] = fleet;
  return { ...game, fleets };
}

/** The placing player confirms a complete fleet. Returns the same game if not allowed. */
export function confirmFleet(game: Game): Game {
  if (game.phase !== 'setup' || !isFleetComplete(game.fleets[game.turn])) return game;
  if (game.turn === game.starter) return { ...game, turn: other(game.starter) };
  return { ...game, phase: 'battle', turn: game.starter };
}

export function sunkIds(fleet: Fleet, shots: ShotRecord[]): string[] {
  const hits = new Set(shots.filter((s) => s.hit).map((s) => s.cell));
  return fleet.filter((p) => (cellsFor(p) ?? []).every((c) => hits.has(c))).map((p) => p.id);
}

export type FireOutcome =
  | { kind: 'invalid' }
  | { kind: 'repeat' }
  | { kind: 'miss' }
  | { kind: 'hit'; sunk: string | null; won: boolean };

/** Current player fires at `cell` on the opponent's board. Rejected shots return the same game. */
export function fire(game: Game, cell: number): { game: Game; outcome: FireOutcome } {
  if (game.phase !== 'battle' || !Number.isInteger(cell) || cell < 0 || cell >= CELLS) return { game, outcome: { kind: 'invalid' } };
  const shooter = game.turn;
  const target = other(shooter);
  const mine = game.shots[shooter];
  if (mine.some((s) => s.cell === cell)) return { game, outcome: { kind: 'repeat' } };

  const ship = shipAt(game.fleets[target], cell);
  const before = sunkIds(game.fleets[target], mine);
  const probe: ShotRecord = { cell, hit: !!ship, sunk: null };
  const after = sunkIds(game.fleets[target], [...mine, probe]);
  const sunk = after.find((id) => !before.includes(id)) ?? null;
  const record: ShotRecord = { ...probe, sunk };
  const shots: [ShotRecord[], ShotRecord[]] = [game.shots[0], game.shots[1]];
  shots[shooter] = [...mine, record];
  const won = after.length === FLEET.length;

  const next: Game = won
    ? { ...game, shots, phase: 'over', winner: shooter, turn: shooter }
    : { ...game, shots, turn: target };
  return { game: next, outcome: ship ? { kind: 'hit', sunk, won } : { kind: 'miss' } };
}

export type MarkKind = 'hit' | 'miss' | null;

/** What `viewer` knows of the opponent's waters: their own shot marks only. */
export function targetMarks(game: Game, viewer: Player): MarkKind[] {
  const out: MarkKind[] = Array(CELLS).fill(null);
  for (const s of game.shots[viewer]) out[s.cell] = s.hit ? 'hit' : 'miss';
  return out;
}

/** Placements of the opponent's boats that `viewer` has sunk (safe to reveal). */
export function sunkPlacements(game: Game, viewer: Player): Placement[] {
  const opp = game.fleets[other(viewer)];
  const ids = sunkIds(opp, game.shots[viewer]);
  return opp.filter((p) => ids.includes(p.id));
}

export interface Stats {
  shots: number;
  hits: number;
  /** 0–100, rounded. */
  accuracy: number;
  sunk: number;
}

export function stats(game: Game, p: Player): Stats {
  const shots = game.shots[p].length;
  const hits = game.shots[p].filter((s) => s.hit).length;
  return {
    shots,
    hits,
    accuracy: shots ? Math.round((hits / shots) * 100) : 0,
    sunk: sunkIds(game.fleets[other(p)], game.shots[p]).length,
  };
}

/** Light structural check for state restored from storage. */
export function isValidGame(g: unknown): g is Game {
  if (!g || typeof g !== 'object') return false;
  const x = g as Game;
  return (
    (x.phase === 'setup' || x.phase === 'battle' || x.phase === 'over') &&
    (x.turn === 0 || x.turn === 1) &&
    (x.starter === 0 || x.starter === 1) &&
    Array.isArray(x.fleets) && x.fleets.length === 2 && x.fleets.every(Array.isArray) &&
    Array.isArray(x.shots) && x.shots.length === 2 && x.shots.every(Array.isArray)
  );
}
