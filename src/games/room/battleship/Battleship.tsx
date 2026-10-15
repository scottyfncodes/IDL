import { useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { usePersistentState } from '../../../lib/storage';
import { recordRoomResult } from '../../../room/stats';
import { createRng, freshSeed } from '../../../lib/rng';
import { GameScreen } from '../../../ui/GameScreen';
import { Button } from '../../../ui/Button';
import { Confirm } from '../../../ui/Confirm';
import { IconCheck, IconRotate, IconShuffle } from '../../../ui/icons';
import {
  CELLS,
  FLEET,
  SIZE,
  canPlace,
  cellsFor,
  colOf,
  confirmFleet,
  fire,
  isFleetComplete,
  isValidGame,
  newGame,
  other,
  placeShip,
  previewCells,
  randomFleet,
  removeShip,
  rowOf,
  setFleet,
  shipAt,
  specOf,
  stats,
  sunkIds,
  sunkPlacements,
  targetMarks,
  type FireOutcome,
  type Fleet,
  type Game,
  type MarkKind,
  type Orientation,
  type Placement,
  type Player,
} from './logic';
import './styles.css';

interface Saved {
  game: Game;
  score: [number, number];
  /** Has this finished game been recorded in stats? Guards against double counting. */
  recorded?: boolean;
}

const initial = (): Saved => ({ game: newGame(0), score: [0, 0] });

type View =
  | { kind: 'handoff'; to: Player }
  | { kind: 'setup'; player: Player }
  | { kind: 'attack'; player: Player; fired: { cell: number; outcome: FireOutcome } | null }
  | { kind: 'over' };

/** Where to land on load: never on a private screen, so secrets aren't shown to the wrong person. */
const safeView = (game: Game): View => (game.phase === 'over' ? { kind: 'over' } : { kind: 'handoff', to: game.turn });

const NAMES = ['Player 1', 'Player 2'] as const;
const COLS = 'ABCDEFG';
const coord = (i: number) => `${COLS[colOf(i)]}${rowOf(i) + 1}`;

function PlayerMark({ p }: { p: Player }) {
  return p === 0 ? (
    <svg viewBox="0 0 20 20" className="bs-pmark" aria-hidden="true"><path d="M5 3v14M5 4h10l-3 3.5 3 3.5H5" /></svg>
  ) : (
    <svg viewBox="0 0 20 20" className="bs-pmark" aria-hidden="true"><path d="M10 3l6 7-6 7-6-7z" /></svg>
  );
}

function Chip({ p, active, children }: { p: Player; active?: boolean; children?: ReactNode }) {
  return (
    <span className={`player-chip player-chip--p${p + 1}`} data-active={!!active}>
      <PlayerMark p={p} />
      <span className="player-chip__name">{NAMES[p]}</span>
      {children}
    </span>
  );
}

const HitMark = () => (
  <svg viewBox="0 0 20 20" className="bs-mark bs-mark--hit" aria-hidden="true"><path d="M5 5l10 10M15 5L5 15" /></svg>
);
const MissMark = () => (
  <svg viewBox="0 0 20 20" className="bs-mark bs-mark--miss" aria-hidden="true"><circle cx="10" cy="10" r="2.6" /></svg>
);

const spanStyle = (p: Placement): CSSProperties => {
  const { length } = specOf(p.id);
  return {
    gridRow: `${p.row + 1} / span ${p.orient === 'v' ? length : 1}`,
    gridColumn: `${p.col + 1} / span ${p.orient === 'h' ? length : 1}`,
  };
};
const cellStyle = (i: number): CSSProperties => ({ gridRow: rowOf(i) + 1, gridColumn: colOf(i) + 1 });

/** Arrow-key movement between cells of one grid. */
function onGridKey(e: KeyboardEvent<HTMLDivElement>) {
  const d = { ArrowUp: -SIZE, ArrowDown: SIZE, ArrowLeft: -1, ArrowRight: 1 }[e.key];
  if (d === undefined) return;
  const t = e.target as HTMLElement;
  const at = Number(t.dataset.cell);
  if (Number.isNaN(at)) return;
  const next = at + d;
  if (next < 0 || next >= CELLS || (Math.abs(d) === 1 && rowOf(next) !== rowOf(at))) return;
  e.preventDefault();
  (e.currentTarget.querySelector(`[data-cell="${next}"]`) as HTMLElement | null)?.focus();
}

interface BoardProps {
  label: string;
  size?: 'lg' | 'sm';
  /** Boats drawn as solid hulls (own fleet only). */
  ships?: Placement[];
  /** Sunk enemy boats, drawn as an outline. */
  sunk?: Placement[];
  marks?: MarkKind[];
  preview?: { cells: number[]; valid: boolean } | null;
  fresh?: number | null;
  cellLabel?: (i: number) => string;
  onCell?: (i: number) => void;
  onHover?: (i: number | null) => void;
  disabled?: (i: number) => boolean;
  shake?: number;
}

function Board({ label, size = 'lg', ships = [], sunk = [], marks, preview, fresh, cellLabel, onCell, onHover, disabled, shake }: BoardProps) {
  const previewSet = new Set(preview?.cells ?? []);
  const interactive = !!onCell;
  return (
    <div
      className={`bs-board bs-board--${size}${shake ? (shake % 2 ? ' bs-shake-a' : ' bs-shake-b') : ''}`}
      role={interactive ? 'grid' : 'img'}
      aria-label={label}
      onKeyDown={interactive ? onGridKey : undefined}
      onPointerLeave={() => onHover?.(null)}
    >
      {Array.from({ length: CELLS }, (_, i) => {
        const mark = marks?.[i] ?? null;
        const cls = `bs-cell${previewSet.has(i) ? (preview!.valid ? ' is-preview' : ' is-invalid') : ''}`;
        const content = mark && (
          <span className={`bs-cell__mark${fresh === i ? ' is-fresh' : ''}`}>{mark === 'hit' ? <HitMark /> : <MissMark />}</span>
        );
        if (!interactive) return <span key={i} className={cls} style={cellStyle(i)} />;
        return (
          <button
            key={i}
            type="button"
            role="gridcell"
            data-cell={i}
            className={cls}
            style={cellStyle(i)}
            aria-label={cellLabel?.(i) ?? coord(i)}
            disabled={disabled?.(i)}
            tabIndex={i === 0 ? 0 : -1}
            onClick={() => onCell(i)}
            onPointerEnter={(e) => e.pointerType === 'mouse' && onHover?.(i)}
            onFocus={() => onHover?.(i)}
          >
            {size === 'lg' && content}
          </button>
        );
      })}
      {ships.map((p) => (
        <span key={`s-${p.id}`} className={`bs-hull bs-hull--${p.orient}`} style={spanStyle(p)} aria-hidden="true" />
      ))}
      {sunk.map((p) => (
        <span key={`k-${p.id}`} className="bs-sunk" style={spanStyle(p)} aria-hidden="true" />
      ))}
      {/* Marks sit above hulls on non-interactive boards. */}
      {(!interactive || size === 'sm') &&
        marks?.map((m, i) =>
          m ? (
            <span key={`m-${i}`} className="bs-cell__mark bs-overlay" style={cellStyle(i)} aria-hidden="true">
              {m === 'hit' ? <HitMark /> : <MissMark />}
            </span>
          ) : null,
        )}
    </div>
  );
}

function Pips({ n }: { n: number }) {
  return (
    <span className="bs-pips" aria-hidden="true">
      {Array.from({ length: n }, (_, k) => <span key={k} />)}
    </span>
  );
}

/** Boats remaining in a fleet, by name, with sunk ones struck through. */
function FleetList({ fleetSunk, title }: { fleetSunk: string[]; title: string }) {
  return (
    <div className="bs-fleetlist">
      <p className="eyebrow">{title}</p>
      <ul>
        {FLEET.map((s) => {
          const down = fleetSunk.includes(s.id);
          return (
            <li key={s.id} className={down ? 'is-sunk' : ''}>
              <Pips n={s.length} />
              <span>{s.name}</span>
              {down && <span className="visually-hidden">, sunk</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Battleship() {
  const [saved, setSaved] = usePersistentState<Saved>('room:battleship', initial, 1);
  const data = isValidGame(saved?.game) ? saved : initial();
  const { game, score } = data;
  const [view, setView] = useState<View>(() => safeView(game));
  const [confirm, setConfirm] = useState<null | 'new' | 'reset'>(null);

  // Setup-only UI state.
  const [selected, setSelected] = useState<string | null>(FLEET[0].id);
  const [orient, setOrient] = useState<Orientation>('h');
  const [hover, setHover] = useState<number | null>(null);
  const [invalid, setInvalid] = useState<number[] | null>(null);
  const [shake, setShake] = useState(0);
  const [note, setNote] = useState<string>('');

  const save = (g: Game, s: [number, number] = score) => setSaved({ game: g, score: s });

  const resetSetupUi = () => {
    setSelected(FLEET[0].id);
    setOrient('h');
    setHover(null);
    setInvalid(null);
    setNote('');
    setShake(0);
  };

  const startNew = (starter: Player, s: [number, number] = score) => {
    const g = newGame(starter);
    save(g, s);
    resetSetupUi();
    setView({ kind: 'handoff', to: starter });
  };

  const inProgress = game.phase === 'battle' || (game.phase === 'setup' && (game.fleets[0].length > 0 || game.fleets[1].length > 0));

  const rules = (
    <>
      <p>Hide five boats on your 7 × 7 waters, then take turns firing at your opponent's. Sink all five to win.</p>
      <ul>
        <li>The fleet: Schooner (4), Ferry (3), Trawler (3), Tug (2) and Skiff (2).</li>
        <li>Boats run across or down. They may touch, but never overlap.</li>
        <li>One shot per turn, hit or miss — then pass the phone.</li>
        <li>✕ marks a hit, a dot marks a miss, and a sunk boat is outlined.</li>
        <li>Only look at the phone when it's your turn. The pass screen keeps both fleets hidden.</li>
      </ul>
    </>
  );

  const menu = [
    { label: 'New game', onSelect: () => (inProgress ? setConfirm('new') : startNew(0)) },
    { label: 'Reset scores', onSelect: () => setConfirm('reset'), destructive: true, disabled: score[0] + score[1] === 0 },
  ];

  let body: ReactNode;

  if (view.kind === 'handoff') {
    const to = view.to;
    const settingUp = game.phase === 'setup';
    const firstEver = settingUp && to === game.starter && game.fleets[to].length === 0 && game.fleets[other(to)].length === 0;
    body = (
      <div className="bs-handoff anim-rise">
        <div className={`bs-handoff__badge bs-handoff__badge--p${to + 1}`}><PlayerMark p={to} /></div>
        <h2 className="display bs-handoff__title">{firstEver ? `${NAMES[to]} hides their fleet first` : `Pass the phone to ${NAMES[to]}`}</h2>
        <p className="muted">
          {settingUp
            ? `${NAMES[other(to)]}, look away while ${NAMES[to]} places their boats.`
            : `${NAMES[other(to)]}, no peeking. ${NAMES[to]} is about to fire.`}
        </p>
        <Button
          variant="primary"
          size="lg"
          block
          onClick={() => {
            resetSetupUi();
            setView(settingUp ? { kind: 'setup', player: to } : { kind: 'attack', player: to, fired: null });
          }}
        >
          {`I'm ${NAMES[to]} — ${settingUp ? 'place my fleet' : 'show my board'}`}
        </Button>
        {(score[0] > 0 || score[1] > 0) && (
          <p className="meta">Wins so far · {NAMES[0]} {score[0]} · {NAMES[1]} {score[1]}</p>
        )}
      </div>
    );
  } else if (view.kind === 'setup') {
    body = renderSetup();
  } else if (view.kind === 'attack') {
    body = renderAttack();
  } else {
    body = renderOver();
  }

  // Plain render helpers that close over state (called as functions, not mounted as components).
  function renderSetup() {
    const p = view.kind === 'setup' ? view.player : game.turn;
    const fleet: Fleet = game.fleets[p];
    const placedIds = fleet.map((f) => f.id);
    const complete = isFleetComplete(fleet);
    const nextUnplaced = (f: Fleet, skip?: string) => FLEET.find((s) => !f.some((x) => x.id === s.id) && s.id !== skip)?.id ?? null;
    const sel = selected && !placedIds.includes(selected) ? selected : null;

    let preview: BoardProps['preview'] = null;
    if (invalid) preview = { cells: invalid, valid: false };
    else if (sel && hover !== null) {
      const cand = { id: sel, row: rowOf(hover), col: colOf(hover), orient };
      preview = { cells: previewCells(cand), valid: canPlace(fleet, cand) };
    }

    const update = (f: Fleet) => save(setFleet(game, f));

    const onCell = (i: number) => {
      setInvalid(null);
      const there = shipAt(fleet, i);
      if (there) {
        update(removeShip(fleet, there.id));
        setSelected(there.id);
        setOrient(there.orient);
        setNote(`Picked up the ${specOf(there.id).name}. Tap a square to place it again.`);
        return;
      }
      if (!sel) {
        setNote(complete ? 'All boats are placed. Tap a boat to move it.' : 'Choose a boat from the dock first.');
        return;
      }
      const cand = { id: sel, row: rowOf(i), col: colOf(i), orient };
      if (canPlace(fleet, cand)) {
        const nf = placeShip(fleet, cand);
        update(nf);
        setSelected(nextUnplaced(nf));
        setNote(`${specOf(sel).name} placed at ${coord(i)}.`);
      } else {
        setInvalid(previewCells(cand));
        setShake((s) => s + 1);
        setNote(cellsFor(cand) ? `The ${specOf(sel).name} would overlap another boat there.` : `The ${specOf(sel).name} doesn't fit there.`);
      }
    };

    const status = complete
      ? 'Fleet ready. Tap Ready when you are happy with it.'
      : sel
        ? `Tap a square to place the ${specOf(sel).name} (${specOf(sel).length}) ${orient === 'h' ? 'across' : 'down'}.`
        : 'Choose a boat from the dock.';

    return (
      <>
        <div className="bs-setup-head">
          <Chip p={p} active />
          <Button
            size="sm"
            variant="quiet"
            icon={<IconRotate size={18} />}
            aria-label={`Rotate. Boats currently go ${orient === 'h' ? 'across' : 'down'}`}
            onClick={() => {
              setInvalid(null);
              setOrient((o) => (o === 'h' ? 'v' : 'h'));
              setNote('');
            }}
          >
            {orient === 'h' ? 'Across' : 'Down'}
          </Button>
        </div>
        <p className="status-line bs-setup-status" aria-live="polite">{note || status}</p>
        <Board
          label={`${NAMES[p]}'s waters, placing boats`}
          ships={fleet}
          preview={preview}
          shake={shake}
          onCell={onCell}
          onHover={(i) => {
            setHover(i);
            if (i !== null) setInvalid(null);
          }}
          cellLabel={(i) => {
            const s = shipAt(fleet, i);
            return `${coord(i)}: ${s ? `${specOf(s.id).name}, tap to pick up` : 'open water'}`;
          }}
        />
        <div className="bs-dock" role="group" aria-label="Dock">
          {FLEET.map((s) => {
            const placed = placedIds.includes(s.id);
            const isSel = sel === s.id;
            return (
              <button
                key={s.id}
                type="button"
                className={`bs-dock__ship${isSel ? ' is-selected' : ''}${placed ? ' is-placed' : ''}`}
                aria-pressed={isSel}
                aria-label={`${s.name}, ${s.length} squares, ${placed ? 'placed — tap to pick up' : isSel ? 'selected' : 'in dock'}`}
                onClick={() => {
                  setInvalid(null);
                  if (placed) {
                    const was = fleet.find((f) => f.id === s.id);
                    update(removeShip(fleet, s.id));
                    if (was) setOrient(was.orient);
                    setNote(`Picked up the ${s.name}.`);
                  } else setNote('');
                  setSelected(s.id);
                }}
              >
                <Pips n={s.length} />
                <span className="bs-dock__name">{s.name}</span>
                {placed && <IconCheck size={16} className="bs-dock__check" />}
              </button>
            );
          })}
        </div>
        <div className="bs-setup-actions">
          <Button
            size="sm"
            variant="quiet"
            icon={<IconShuffle size={18} />}
            onClick={() => {
              update(randomFleet(createRng(freshSeed())));
              setSelected(null);
              setInvalid(null);
              setNote('Random fleet placed. Shuffle again, or move any boat.');
            }}
          >
            Random fleet
          </Button>
          <Button
            size="sm"
            variant="quiet"
            disabled={fleet.length === 0}
            onClick={() => {
              update([]);
              resetSetupUi();
            }}
          >
            Clear
          </Button>
          <Button
            variant="primary"
            className="bs-ready"
            disabled={!complete}
            onClick={() => {
              const g = confirmFleet(game);
              if (g === game) return;
              save(g);
              resetSetupUi();
              setView({ kind: 'handoff', to: g.turn });
            }}
          >
            Ready
          </Button>
        </div>
      </>
    );
  }

  function renderAttack() {
    if (view.kind !== 'attack') return null;
    const p = view.player;
    const opp = other(p);
    const marks = targetMarks(game, p);
    const sunk = sunkPlacements(game, p);
    const mySunk = sunkIds(game.fleets[p], game.shots[opp]);
    const fired = view.fired;

    const onCell = (i: number) => {
      if (fired || game.phase !== 'battle' || game.turn !== p) return;
      const r = fire(game, i);
      if (r.outcome.kind === 'repeat' || r.outcome.kind === 'invalid') {
        setShake((s) => s + 1);
        setNote(`You've already fired at ${coord(i)}. Pick another square.`);
        return;
      }
      setNote('');
      if (r.outcome.kind === 'hit' && r.outcome.won) {
        const s: [number, number] = [score[0], score[1]];
        s[p] += 1;
        if (!data.recorded) recordRoomResult('battleship', { outcome: 'complete', opponent: 'friend' });
        setSaved({ game: r.game, score: s, recorded: true });
        setView({ kind: 'over' });
        return;
      }
      save(r.game);
      setView({ kind: 'attack', player: p, fired: { cell: i, outcome: r.outcome } });
    };

    let headline: string;
    if (!fired) headline = note || `${NAMES[p]}, take your shot.`;
    else if (fired.outcome.kind === 'hit' && fired.outcome.sunk) headline = `Hit at ${coord(fired.cell)} — you sank their ${specOf(fired.outcome.sunk).name}!`;
    else if (fired.outcome.kind === 'hit') headline = `Hit at ${coord(fired.cell)}!`;
    else headline = `Miss at ${coord(fired.cell)}. Open water.`;

    const enemyHitsOnMe = targetMarks(game, opp);

    return (
      <>
        <div className="scoreboard"><Chip p={p} active={!fired} /></div>
        <p className={`status-line${fired?.outcome.kind === 'hit' ? ' bs-status--hit' : ''}`} aria-live="polite">{headline}</p>
        <div className="bs-target">
          <p className="eyebrow bs-caption">{`${NAMES[opp]}'s waters`}</p>
          <Board
            label={`${NAMES[opp]}'s waters. Your shots so far.`}
            marks={marks}
            sunk={sunk}
            fresh={fired?.cell ?? null}
            shake={shake}
            onCell={onCell}
            disabled={(i) => !!fired || marks[i] !== null}
            cellLabel={(i) => {
              const m = marks[i];
              const down = sunk.find((s) => cellsFor(s)?.includes(i));
              return `${coord(i)}: ${m === 'hit' ? (down ? `hit, ${specOf(down.id).name} sunk` : 'hit') : m === 'miss' ? 'miss' : 'not fired at'}`;
            }}
          />
        </div>
        {fired && (
          <Button
            variant="primary"
            size="lg"
            block
            className="anim-rise"
            onClick={() => {
              resetSetupUi();
              setView({ kind: 'handoff', to: opp });
            }}
          >
            {`Done — pass to ${NAMES[opp]}`}
          </Button>
        )}
        <div className="bs-intel">
          <div className="bs-own">
            <p className="eyebrow">Your fleet</p>
            <Board label={`Your fleet, with ${NAMES[opp]}'s shots`} size="sm" ships={game.fleets[p]} marks={enemyHitsOnMe} />
            <p className="meta">{mySunk.length === 0 ? 'No boats lost' : `${mySunk.length} of ${FLEET.length} lost`}</p>
          </div>
          <FleetList title="Their fleet" fleetSunk={sunk.map((s) => s.id)} />
        </div>
      </>
    );
  }

  function renderOver() {
    const w = game.winner ?? 0;
    const st = [stats(game, 0), stats(game, 1)];
    return (
      <>
        <div className="scoreboard">
          {([0, 1] as Player[]).map((p) => (
            <Chip key={p} p={p} active={p === w}><span className="player-chip__score">{score[p]}</span></Chip>
          ))}
        </div>
        <div className="end-card">
          <p className="eyebrow">Fleet sunk</p>
          <h2 className="end-card__title display">{`${NAMES[w]} wins`}</h2>
          <p className="muted">{`All five boats found in ${st[w].shots} shots.`}</p>
          <table className="bs-stats">
            <thead>
              <tr><th scope="col"><span className="visually-hidden">Player</span></th><th scope="col">Shots</th><th scope="col">Hits</th><th scope="col">Accuracy</th><th scope="col">Sunk</th></tr>
            </thead>
            <tbody>
              {([0, 1] as Player[]).map((p) => (
                <tr key={p}>
                  <th scope="row">{NAMES[p]}</th>
                  <td>{st[p].shots}</td>
                  <td>{st[p].hits}</td>
                  <td>{st[p].accuracy}%</td>
                  <td>{st[p].sunk}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="end-card__actions">
            <Button variant="primary" size="lg" onClick={() => startNew(other(game.starter))}>Rematch</Button>
          </div>
          <p className="meta">{`${NAMES[other(game.starter)]} hides first and fires first next time.`}</p>
        </div>
        <div className="bs-reveal">
          {([0, 1] as Player[]).map((p) => (
            <div key={p} className="bs-own">
              <p className="eyebrow">{`${NAMES[p]}'s fleet`}</p>
              <Board label={`${NAMES[p]}'s fleet and ${NAMES[other(p)]}'s shots`} size="sm" ships={game.fleets[p]} marks={targetMarks(game, other(p))} />
            </div>
          ))}
        </div>
      </>
    );
  }

  return (
    <GameScreen title="Mini Battleship" kicker="2 players · pass the phone" backTo="/play" rules={rules} menu={menu} className="bs-body">
      {body}
      <Confirm
        open={confirm === 'new'}
        title="Start a new game?"
        message="Both fleets and every shot so far will be cleared. Scores are kept."
        confirmLabel="New game"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          startNew(0);
        }}
      />
      <Confirm
        open={confirm === 'reset'}
        title="Reset scores?"
        message="Both win counts go back to zero. The current game carries on."
        confirmLabel="Reset"
        cancelLabel="Cancel"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null);
          save(game, [0, 0]);
        }}
      />
    </GameScreen>
  );
}
