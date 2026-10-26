import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DailyGameProps } from '../../../daily/types';
import { load, save as saveKey, useStorageVersion } from '../../../lib/storage';
import { Button } from '../../../ui/Button';
import { Confirm } from '../../../ui/Confirm';
import { IconCheck, IconLightbulb, IconUndo } from '../../../ui/icons';
import { CoupletBoard, type ChangeKind } from './Board';
import { TIER_LABEL, TIERS, type Placement, type Puzzle, type Tier } from './logic';
import { getBoard, warmBoards } from './boards';
import { emptyTier, hint, view, type TierState } from './play';
import { TUTORIAL } from './tutorial';
import './styles.css';

export interface State {
  tier: Tier;
  tiers: Record<Tier, TierState>;
}

export const INTRO_KEY = 'couplet:intro';

export const initialState = (): State => ({ tier: 'easy', tiers: { easy: emptyTier(), medium: emptyTier(), hard: emptyTier() } });

function validState(s: State | undefined): s is State {
  return !!s && TIERS.includes(s.tier) && !!s.tiers && TIERS.every((t) => Array.isArray(s.tiers[t]?.placements) && Array.isArray(s.tiers[t]?.hinted));
}

export const formatTime = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
};

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

export function resultFor(state: State) {
  const hints = TIERS.reduce((s, t) => s + state.tiers[t].hinted.length, 0);
  return {
    score: `All three · ${hints === 0 ? 'no hints' : plural(hints, 'hint')}`,
    grid: TIERS.map((t) => {
      const ts = state.tiers[t];
      return `${TIER_LABEL[t]} ${formatTime(ts.ms)}${ts.hinted.length ? ` · ${plural(ts.hinted.length, 'hint')}` : ''}`;
    }),
  };
}

// ---------------------------------------------------------------------------

function Tabs({ state, onPick }: { state: State; onPick: (t: Tier) => void }) {
  return (
    <div className="cp-tabs" role="tablist" aria-label="Boards">
      {TIERS.map((t) => {
        const ts = state.tiers[t];
        const status = ts.solved ? 'solved' : ts.placements.length ? 'started' : 'fresh';
        return (
          <button key={t} type="button" role="tab" aria-selected={state.tier === t} className="cp-tab" data-status={status} onClick={() => onPick(t)}>
            <span className="cp-tab__mark" aria-hidden="true">{ts.solved ? <IconCheck size={13} /> : null}</span>
            {TIER_LABEL[t]}
            {ts.solved && <span className="visually-hidden">, solved</span>}
          </button>
        );
      })}
    </div>
  );
}

/** The first-play walkthrough: a three-domino board with live coaching. */
export function Intro({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [turned, setTurned] = useState(false);
  const v = view(TUTORIAL, placements);
  const broken = v.statuses.filter((s) => s === 'broken').length;
  let coach: string;
  if (v.solved) coach = 'Solved. Every square covered, every rule met. That’s the whole game.';
  else if (placements.length === 0) coach = 'Drag a domino onto the board. Or tap it, then tap a square.';
  else if (v.full && broken) coach = `Covered, but ${plural(broken, 'rule')} ${broken === 1 ? 'isn’t' : 'aren’t'} met. Tap a domino to turn it, or drag it somewhere else.`;
  else if (!turned) coach = 'Tap a placed domino to turn it. Drag it off the board to take it back.';
  else coach = 'Dominoes can cross from one region into another. Each half counts for the region it lands in.';

  return (
    <section className="cp-intro anim-rise" aria-labelledby="cp-intro-title">
      <div className="cp-intro__head">
        <p className="eyebrow">First time here</p>
        <h2 id="cp-intro-title" className="display">Lay every domino so each region keeps its rule.</h2>
        <ul className="cp-legend">
          <li><span className="cp-legend__badge">8</span> adds up to 8</li>
          <li><span className="cp-legend__badge">=</span> all the same</li>
          <li><span className="cp-legend__badge">&lt;3</span> adds up to less than 3</li>
        </ul>
      </div>
      <CoupletBoard
        board={TUTORIAL}
        placements={placements}
        solved={v.solved}
        label="Practice board"
        onChange={(next, kind) => {
          if (kind === 'rotate') setTurned(true);
          setPlacements(next);
        }}
      />
      <p className="cp-status" role="status" aria-live="polite">{coach}</p>
      <div className="cp-actions">
        {v.solved ? (
          <Button variant="primary" onClick={onDone}>Start today’s Easy</Button>
        ) : (
          <Button variant="quiet" onClick={onSkip}>Skip the walkthrough</Button>
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export default function Couplet({ date, record, save }: DailyGameProps<Puzzle, State>) {
  const initial = useMemo<State>(() => (validState(record?.state) ? record!.state : initialState()), [record]);
  const [state, setState] = useState<State>(initial);
  const stateRef = useRef(state);
  stateRef.current = state;
  const finished = record?.status === 'won';
  const [history, setHistory] = useState<Record<Tier, Placement[][]>>({ easy: [], medium: [], hard: [] });
  const [confirmClear, setConfirmClear] = useState(false);
  const [justSolved, setJustSolved] = useState<Tier | null>(null);

  useStorageVersion(INTRO_KEY);
  const introSeen = load<boolean>(INTRO_KEY, false);
  const fresh = TIERS.every((t) => state.tiers[t].placements.length === 0 && !state.tiers[t].solved);
  const [showIntro, setShowIntro] = useState(() => !introSeen && fresh && !finished);
  useEffect(() => {
    // "Replay the walkthrough" from the rules sheet clears the flag.
    if (!introSeen && !finished) setShowIntro(true);
  }, [introSeen, finished]);

  const tier = state.tier;
  const board = useMemo(() => getBoard(date, tier), [date, tier]);
  const ts = state.tiers[tier];

  // Build the other boards in the background while the player reads this one.
  useEffect(() => warmBoards(date), [date]);

  const persist = useCallback(
    (next: State) => {
      stateRef.current = next;
      setState(next);
      const all = TIERS.every((t) => next.tiers[t].solved);
      if (all) save({ status: 'won', state: next, result: resultFor(next) });
      else save({ status: 'playing', state: next });
    },
    [save],
  );

  // Time on the board in view, while the page is visible and it's unsolved.
  const tickFrom = useRef<number | null>(null);
  const flushTime = useCallback(() => {
    if (tickFrom.current === null) return stateRef.current;
    const now = Date.now();
    const dt = Math.min(now - tickFrom.current, 60_000);
    tickFrom.current = now;
    const s = stateRef.current;
    const t = s.tiers[s.tier];
    if (t.solved || showIntro) return s;
    const next = { ...s, tiers: { ...s.tiers, [s.tier]: { ...t, ms: t.ms + dt } } };
    stateRef.current = next;
    return next;
  }, [showIntro]);

  useEffect(() => {
    if (finished || showIntro) return;
    tickFrom.current = document.hidden ? null : Date.now();
    const onVis = () => {
      if (document.hidden) {
        persist(flushTime());
        tickFrom.current = null;
      } else tickFrom.current = Date.now();
    };
    const id = window.setInterval(() => {
      if (!document.hidden) flushTime();
    }, 1000);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVis);
      if (tickFrom.current !== null) persist(flushTime());
      tickFrom.current = null;
    };
  }, [tier, finished, showIntro, flushTime, persist]);

  const change = (placements: Placement[], kind: ChangeKind) => {
    void kind;
    const s = flushTime();
    const t = s.tiers[s.tier];
    setHistory((h) => ({ ...h, [s.tier]: [...h[s.tier], t.placements].slice(-200) }));
    const solved = view(board, placements).solved;
    if (solved) setJustSolved(s.tier);
    persist({ ...s, tiers: { ...s.tiers, [s.tier]: { ...t, placements, solved } } });
  };

  const undo = () => {
    const stack = history[tier];
    if (!stack.length || ts.solved) return;
    const prev = stack[stack.length - 1];
    setHistory((h) => ({ ...h, [tier]: h[tier].slice(0, -1) }));
    const s = flushTime();
    // Hinted dominoes stay put.
    const keep = prev.filter((p) => !ts.hinted.includes(p.d));
    const hinted = ts.placements.filter((p) => ts.hinted.includes(p.d));
    const merged = [...keep.filter((p) => !hinted.some((h) => h.a === p.a || h.b === p.a || h.a === p.b || h.b === p.b)), ...hinted];
    persist({ ...s, tiers: { ...s.tiers, [tier]: { ...s.tiers[tier], placements: merged } } });
  };

  const useHint = () => {
    const s = flushTime();
    const t = s.tiers[s.tier];
    const h = hint(board, t);
    if (!h) return;
    setHistory((hs) => ({ ...hs, [s.tier]: [...hs[s.tier], t.placements] }));
    const solved = view(board, h.placements).solved;
    if (solved) setJustSolved(s.tier);
    persist({ ...s, tiers: { ...s.tiers, [s.tier]: { ...t, placements: h.placements, hinted: h.hinted, solved } } });
  };

  const clear = () => {
    setConfirmClear(false);
    const s = flushTime();
    const t = s.tiers[s.tier];
    setHistory((h) => ({ ...h, [s.tier]: [...h[s.tier], t.placements] }));
    persist({ ...s, tiers: { ...s.tiers, [s.tier]: { ...t, placements: t.placements.filter((p) => t.hinted.includes(p.d)) } } });
  };

  const pick = (t: Tier) => {
    if (t === tier) return;
    setJustSolved(null);
    persist({ ...flushTime(), tier: t });
  };

  const endIntro = () => {
    saveKey(INTRO_KEY, true);
    setShowIntro(false);
  };

  if (showIntro) return <div className="cp"><Intro onDone={endIntro} onSkip={endIntro} /></div>;

  const v = view(board, ts.placements);
  const broken = v.statuses.filter((x) => x === 'broken').length;
  const nextTier = TIERS.find((t) => !state.tiers[t].solved);
  let status: string;
  if (ts.solved) status = '';
  else if (v.full && broken) status = `Every square is covered, but ${plural(broken, 'rule')} ${broken === 1 ? 'isn’t' : 'aren’t'} met.`;
  else status = `${ts.placements.length} of ${board.dominoes.length} dominoes placed`;

  return (
    <div className="cp">
      <Tabs state={state} onPick={pick} />
      <CoupletBoard
        key={`${date}:${tier}`}
        board={board}
        placements={ts.placements}
        hinted={ts.hinted}
        solved={ts.solved}
        onChange={change}
        label={`${TIER_LABEL[tier]} board`}
      />
      {ts.solved ? (
        <div className={`cp-solved${justSolved === tier ? ' anim-rise' : ''}`} role="status">
          <p className="cp-solved__title display">{TIER_LABEL[tier]} solved</p>
          <p className="cp-solved__line">
            {formatTime(ts.ms)}
            {ts.hinted.length ? ` · ${plural(ts.hinted.length, 'hint')}` : ' · no hints'}
          </p>
          {nextTier && (
            <Button variant="primary" onClick={() => pick(nextTier)}>
              Next: {TIER_LABEL[nextTier]}
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className={`cp-status${v.full && broken ? ' is-warn' : ''}`} role="status" aria-live="polite">{status}</p>
          <div className="cp-actions">
            <Button variant="quiet" size="sm" icon={<IconUndo size={18} />} onClick={undo} disabled={!history[tier].length}>Undo</Button>
            <Button variant="quiet" size="sm" icon={<IconLightbulb size={18} />} onClick={useHint}>Hint</Button>
            <Button variant="quiet" size="sm" onClick={() => setConfirmClear(true)} disabled={ts.placements.length === ts.hinted.length}>Clear</Button>
          </div>
        </>
      )}
      <Confirm
        open={confirmClear}
        title="Clear this board?"
        message="Every domino goes back to the tray. Hinted dominoes stay. Undo can bring the board back."
        confirmLabel="Clear board"
        onConfirm={clear}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
}
