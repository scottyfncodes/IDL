import { EndArt } from '../../../art/EndArt';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { load, usePersistentState } from '../../../lib/storage';
import { createRng, freshSeed } from '../../../lib/rng';
import { OpponentPicker } from '../../../ui/OpponentPicker';
import { COMPUTER_NAME, HUMAN_NAME, useComputerMove } from '../../../room/computer';
import { recordRoomResult, type Opponent, type RoomResult } from '../../../room/stats';
import { GameScreen } from '../../../ui/GameScreen';
import { Button } from '../../../ui/Button';
import { Confirm } from '../../../ui/Confirm';
import { Segmented } from '../../../ui/Segmented';
import {
  applyMove,
  chooseEdge,
  drawnCount,
  edgeKey,
  edgeOwner,
  isOver,
  newGame,
  other,
  sameEdge,
  score,
  SIZES,
  winner,
  type Edge,
  type MoveResult,
  type Player,
  type Size,
  type State,
} from './logic';
import './styles.css';

interface Saved {
  game: State;
  /** Who started the current game; rematches alternate. */
  first: Player;
  /** Against the computer, the human is always player 1 (clay, ✕). */
  opponent: Opponent;
  /** Has the finished game been recorded in stats? Guards against double counting. */
  recorded: boolean;
}

const KEY = 'room:dots-boxes';

/** v1 had no opponent; carry an in-progress game over as a friend game. */
function initial(): Saved {
  const v1 = load<{ game: State; first: Player } | null>(KEY, null, 1);
  if (v1 && v1.game && Array.isArray(v1.game.h) && Array.isArray(v1.game.v) && Array.isArray(v1.game.boxes)) {
    return { game: v1.game, first: v1.first === 2 ? 2 : 1, opponent: 'friend', recorded: isOver(v1.game) };
  }
  return { game: newGame(4, 1), first: 1, opponent: 'friend', recorded: false };
}

const FRIEND_NAMES: Record<Player, string> = { 1: 'Player 1', 2: 'Player 2' };
const IDL_NAMES: Record<Player, string> = { 1: HUMAN_NAME, 2: COMPUTER_NAME };
const OPPONENT_LABEL: Record<Opponent, string> = { friend: 'a friend', easy: 'idl · easy', hard: 'idl · hard' };

function resultFor(w: Player | 'tie' | null, opponent: Opponent): RoomResult {
  if (opponent === 'friend') return { outcome: 'complete', opponent };
  return { outcome: w === 'tie' ? 'draw' : w === 1 ? 'win' : 'loss', opponent };
}
const SIZE_OPTIONS = SIZES.map((n) => ({ value: String(n) as `${Size}`, label: `${n}×${n}` }));

// SVG geometry (viewBox units).
const U = 60; // dot spacing
const PAD = 22;

/** Player mark: ✕ for player 1, ◯ for player 2 — shape always paired with colour. */
function PlayerMark({ player, x, y, size, className = '' }: { player: Player; x?: number; y?: number; size: number; className?: string }) {
  const h = size / 2;
  const a = size * 0.26;
  if (x === undefined || y === undefined) {
    return (
      <svg viewBox="0 0 40 40" className={`db-mark db-mark--p${player} ${className}`.trim()} aria-hidden="true">
        {player === 1 ? <path d="M12 12l16 16M28 12L12 28" /> : <circle cx="20" cy="20" r="9.5" />}
      </svg>
    );
  }
  return player === 1 ? (
    <path className={`db-mark db-mark--p1 ${className}`.trim()} d={`M${x - a} ${y - a}L${x + a} ${y + a}M${x + a} ${y - a}L${x - a} ${y + a}`} />
  ) : (
    <circle className={`db-mark db-mark--p2 ${className}`.trim()} cx={x} cy={y} r={h * 0.36} />
  );
}

function edgeLabel(e: Edge, owner: 0 | Player, names: Record<Player, string>): string {
  const where =
    e.kind === 'h'
      ? `Horizontal line, row ${e.r + 1}, between dots ${e.c + 1} and ${e.c + 2}`
      : `Vertical line, column ${e.c + 1}, between dots ${e.r + 1} and ${e.r + 2}`;
  return owner ? `${where}: drawn by ${names[owner]}` : where;
}

/** Endpoints of an edge in viewBox units. */
function endpoints(e: Edge): [number, number, number, number] {
  const x1 = PAD + e.c * U;
  const y1 = PAD + e.r * U;
  return e.kind === 'h' ? [x1, y1, x1 + U, y1] : [x1, y1, x1, y1 + U];
}

/** Diamond hit area: the edge plus the triangles towards neighbouring box centres. Tiles the board. */
function hitPolygon(e: Edge): string {
  const [x1, y1, x2, y2] = endpoints(e);
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const d = U / 2;
  const pts = e.kind === 'h' ? [[x1, y1], [mx, my - d], [x2, y2], [mx, my + d]] : [[x1, y1], [mx + d, my], [x2, y2], [mx - d, my]];
  return pts.map((p) => p.join(',')).join(' ');
}

export default function DotsBoxes() {
  const [saved, setSaved] = usePersistentState<Saved>(KEY, initial, 2);
  const { game, first, opponent } = saved;
  const vsIdl = opponent !== 'friend';
  const NAMES = vsIdl ? IDL_NAMES : FRIEND_NAMES;
  const [pendingSize, setPendingSize] = useState<Size | null>(null);
  const [pendingOpponent, setPendingOpponent] = useState<Opponent | null>(null);
  const [confirmNew, setConfirmNew] = useState(false);
  const [flash, setFlash] = useState<{ id: number; text: string } | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const svgRef = useRef<SVGSVGElement>(null);

  const over = isOver(game);
  const sc = score(game);
  const w = winner(game);
  const started = drawnCount(game) > 0;
  const n = game.size;
  const vb = n * U + PAD * 2;
  const idlTurn = vsIdl && !over && game.turn === 2;

  useEffect(() => {
    if (!flash) return;
    const t = window.setTimeout(() => setFlash(null), 1400);
    return () => window.clearTimeout(t);
  }, [flash]);

  const startGame = (size: Size, starter: Player, against: Opponent = opponent) => {
    setSaved({ game: newGame(size, starter), first: starter, opponent: against, recorded: false });
    setFlash(null);
    setFresh(new Set());
  };

  /** Commit a move from either side; records the finished game exactly once. */
  const commit = useCallback(
    (res: MoveResult) => {
      const done = isOver(res.state);
      const recording = done && !saved.recorded;
      if (recording) recordRoomResult('dots-boxes', resultFor(winner(res.state), saved.opponent));
      setSaved({ ...saved, game: res.state, recorded: saved.recorded || recording });
      setFresh(new Set(res.completed.map(([r, c]) => `${r}-${c}`)));
      if (res.extraTurn) {
        const two = res.completed.length === 2;
        const text =
          saved.opponent !== 'friend' && saved.game.turn === 2
            ? `${COMPUTER_NAME} closes ${two ? 'two boxes' : 'a box'}`
            : `${two ? 'Two boxes' : 'Box'}! Another turn`;
        setFlash({ id: Date.now(), text });
      } else setFlash(null);
    },
    [saved, setSaved],
  );

  const onEdge = (e: Edge) => {
    if (idlTurn) return;
    const res = applyMove(game, e);
    if (res) commit(res);
  };

  const idlMove = useCallback(() => {
    if (saved.opponent === 'friend') return;
    const e = chooseEdge(saved.game, saved.opponent, createRng(freshSeed()));
    const res = e && applyMove(saved.game, e);
    if (res) commit(res);
  }, [saved, commit]);
  useComputerMove(idlTurn, idlMove);

  const requestOpponent = (o: Opponent) => {
    if (o === opponent) return;
    if (started && !over) setPendingOpponent(o);
    else startGame(n, first, o);
  };

  const requestSize = (size: Size) => {
    if (size === n) return;
    if (started && !over) setPendingSize(size);
    else startGame(size, first);
  };

  // Arrow keys move focus to the nearest open line in that direction.
  const onKey = (ev: KeyboardEvent<SVGGElement>, e: Edge) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      onEdge(e);
      return;
    }
    const dir = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[ev.key];
    if (!dir) return;
    ev.preventDefault();
    const [x1, y1, x2, y2] = endpoints(e);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    let best: SVGGElement | null = null;
    let bestScore = Infinity;
    svgRef.current?.querySelectorAll<SVGGElement>('.db-edge[tabindex="0"]').forEach((el) => {
      const ex = Number(el.dataset.x);
      const ey = Number(el.dataset.y);
      const dx = ex - cx;
      const dy = ey - cy;
      const along = dx * dir[0] + dy * dir[1];
      if (along <= 1) return;
      const across = Math.abs(dx * dir[1]) + Math.abs(dy * dir[0]);
      const s = along + across * 2;
      if (s < bestScore) {
        bestScore = s;
        best = el;
      }
    });
    (best as SVGGElement | null)?.focus();
  };

  const edges: Edge[] = [];
  for (let r = 0; r <= n; r++) for (let c = 0; c < n; c++) edges.push({ kind: 'h', r, c });
  for (let r = 0; r < n; r++) for (let c = 0; c <= n; c++) edges.push({ kind: 'v', r, c });

  const humanWon = vsIdl && w === 1;
  const status = over
    ? w === 'tie'
      ? `A tie at ${sc[1]}–${sc[2]}`
      : `${NAMES[w as Player]} ${humanWon ? 'win' : 'wins'} ${Math.max(sc[1], sc[2])}–${Math.min(sc[1], sc[2])}`
    : idlTurn
      ? `${COMPUTER_NAME} is thinking…`
      : vsIdl
        ? 'Your turn to draw a line'
        : `${NAMES[game.turn]} to draw a line`;

  return (
    <GameScreen
      title="Dots & Boxes"
      kicker={vsIdl ? `You vs ${OPPONENT_LABEL[opponent]}` : '2 players · one phone'}
      backTo="/play"
      className="db-screen"
      rules={
        <>
          <p>Take turns joining two neighbouring dots with a line. Close the fourth side of a box to claim it.</p>
          <ul>
            <li>Claiming a box (or two at once) earns you <strong>another turn</strong>. Otherwise play passes.</li>
            <li><strong>Player 1</strong> marks boxes with ✕, <strong>Player 2</strong> with ◯.</li>
            <li>When every line is drawn, the most boxes wins. Even boards can tie.</li>
            <li>Starts alternate each rematch.</li>
            <li>Playing <strong>idl</strong>, the computer? You play ✕ and still alternate who starts.</li>
          </ul>
        </>
      }
      menu={[
        { label: 'New game', onSelect: () => (started && !over ? setConfirmNew(true) : startGame(n, first)) },
        ...SIZES.filter((s) => s !== n).map((s) => ({ label: `Switch to ${s}×${s}`, onSelect: () => requestSize(s) })),
      ]}
    >
      <div className="db-top">
        <OpponentPicker value={opponent} onChange={requestOpponent} />
        <Segmented label="Board size" options={SIZE_OPTIONS} value={String(n) as `${Size}`} onChange={(v) => requestSize(Number(v) as Size)} />
      </div>

      <div className="scoreboard">
        {([1, 2] as Player[]).map((p) => (
          <span key={p} className={`player-chip player-chip--p${p}`} data-active={!over && game.turn === p}>
            <PlayerMark player={p} size={18} />
            <span className="player-chip__name">{NAMES[p]}</span>
            <span className="player-chip__score" aria-label={`${sc[p]} boxes`}>{sc[p]}</span>
          </span>
        ))}
      </div>

      <p className="status-line" aria-live="polite">
        {!over && <PlayerMark player={game.turn} size={18} className={`db-status-mark db-status-mark--p${game.turn}`} />}
        <span>{status}</span>
        {vsIdl && !started && !over && <span className="meta">· {game.turn === 1 ? 'you start' : 'idl starts'}</span>}
        {flash && !over && (
          <span key={flash.id} className={`db-flash db-flash--p${game.turn}`}>
            {flash.text}
          </span>
        )}
      </p>

      <div className={`db-board-wrap db-turn--p${game.turn}${over ? ' is-over' : ''}${idlTurn ? ' is-waiting' : ''}`}>
        <svg ref={svgRef} className="db-board" viewBox={`0 0 ${vb} ${vb}`} role="group" aria-label={`Dots and Boxes board, ${n} by ${n} boxes`} aria-busy={idlTurn || undefined}>
          {/* boxes */}
          {game.boxes.map((row, r) =>
            row.map((o, c) =>
              o ? (
                <g key={`b${r}-${c}`} className={`db-box db-box--p${o}${fresh.has(`${r}-${c}`) ? ' is-fresh' : ''}`}>
                  <rect x={PAD + c * U + 4} y={PAD + r * U + 4} width={U - 8} height={U - 8} rx={6} />
                  <PlayerMark player={o} x={PAD + c * U + U / 2} y={PAD + r * U + U / 2} size={U * 0.62} />
                </g>
              ) : null,
            ),
          )}
          {/* last-move halo */}
          {game.last && (() => {
            const [x1, y1, x2, y2] = endpoints(game.last);
            return <line className="db-last" x1={x1} y1={y1} x2={x2} y2={y2} />;
          })()}
          {/* edges */}
          {edges.map((e) => {
            const owner = edgeOwner(game, e);
            const [x1, y1, x2, y2] = endpoints(e);
            const open = !owner && !over && !idlTurn;
            return (
              <g
                key={edgeKey(e)}
                className={`db-edge${owner ? ` is-drawn db-edge--p${owner}` : ''}${sameEdge(game.last, e) ? ' is-last' : ''}`}
                role="button"
                tabIndex={open ? 0 : -1}
                aria-label={edgeLabel(e, owner, NAMES)}
                aria-disabled={!open}
                data-x={(x1 + x2) / 2}
                data-y={(y1 + y2) / 2}
                onClick={open ? () => onEdge(e) : undefined}
                onKeyDown={open ? (ev) => onKey(ev, e) : undefined}
              >
                {open && <polygon className="db-hit" points={hitPolygon(e)} />}
                <line className="db-line" x1={x1} y1={y1} x2={x2} y2={y2} />
              </g>
            );
          })}
          {/* dots */}
          {Array.from({ length: (n + 1) * (n + 1) }, (_, i) => (
            <circle key={`d${i}`} className="db-dot" cx={PAD + (i % (n + 1)) * U} cy={PAD + Math.floor(i / (n + 1)) * U} r={5.5} />
          ))}
        </svg>
      </div>

      {over && (
        <section className="end-card" aria-labelledby="db-end-title">
          <EndArt />
          <h2 id="db-end-title" className="end-card__title display">
            {w === 'tie' ? 'Dead even' : humanWon ? 'You take it' : `${NAMES[w as Player]} takes it`}
          </h2>
          <p className="muted">
            {w === 'tie' ? `${vsIdl ? 'You and idl each' : 'Both players'} closed ${sc[1]} boxes.` : `${Math.max(sc[1], sc[2])} boxes to ${Math.min(sc[1], sc[2])}.`}
          </p>
          <div className="end-card__actions">
            <Button variant="primary" size="lg" onClick={() => startGame(n, other(first))}>Rematch</Button>
          </div>
          <div className="db-end-size">
            <span className="meta">Or try another size</span>
            <Segmented label="Board size for next game" options={SIZE_OPTIONS} value={String(n) as `${Size}`} onChange={(v) => startGame(Number(v) as Size, other(first))} />
          </div>
        </section>
      )}

      <Confirm
        open={pendingSize !== null}
        title={`Switch to ${pendingSize}×${pendingSize}?`}
        message="This clears the current game. Boxes claimed so far won't count."
        confirmLabel="Switch size"
        destructive
        onCancel={() => setPendingSize(null)}
        onConfirm={() => {
          if (pendingSize) startGame(pendingSize, first);
          setPendingSize(null);
        }}
      />
      <Confirm
        open={pendingOpponent !== null}
        title={`Play ${pendingOpponent ? OPPONENT_LABEL[pendingOpponent] : ''} instead?`}
        message="This clears the current game. Boxes claimed so far won't count."
        confirmLabel="Switch"
        destructive
        onCancel={() => setPendingOpponent(null)}
        onConfirm={() => {
          if (pendingOpponent) startGame(n, first, pendingOpponent);
          setPendingOpponent(null);
        }}
      />
      <Confirm
        open={confirmNew}
        title="Start a new game?"
        message="This clears the current board."
        confirmLabel="New game"
        destructive
        onCancel={() => setConfirmNew(false)}
        onConfirm={() => {
          setConfirmNew(false);
          startGame(n, other(first));
        }}
      />
    </GameScreen>
  );
}
