import { useCallback, useEffect, useRef, useState } from 'react';
import type { DailyGameProps, DailyRecord } from '../../../daily/types';
import { Button } from '../../../ui/Button';
import { Confirm } from '../../../ui/Confirm';
import { IconBackspace, IconCheck } from '../../../ui/icons';
import {
  ERROR_TEXT,
  evaluate,
  fEq,
  finishRound,
  frac,
  fToString,
  initialState,
  isDone,
  isWin,
  OP_GLYPH,
  popToken,
  pushToken,
  resultFor,
  setExpr,
  tokensToString,
  usedTiles,
  type Op,
  type Outcome,
  type Puzzle,
  type State,
  type Token,
} from './logic';
import './styles.css';

const OPS: Op[] = ['+', '-', '*', '/'];
const NO_TOKENS: Token[] = [];
const OP_NAME: Record<Op, string> = { '+': 'plus', '-': 'minus', '*': 'times', '/': 'divided by' };

function validState(s: State | undefined, rounds: number): s is State {
  return !!s && Array.isArray(s.exprs) && s.exprs.length === rounds && Array.isArray(s.outcomes) && s.outcomes.length === rounds;
}

function formatValue(tokens: Token[], tiles: number[]) {
  const r = evaluate(tokens, tiles);
  if (r.ok) return { ok: true as const, text: fToString(r.value).replace('-', '−'), value: r.value };
  return { ok: false as const, text: ERROR_TEXT[r.error], error: r.error };
}

function RoundTrack({ puzzle, state }: { puzzle: Puzzle; state: State }) {
  return (
    <ol className="sw-track" aria-label="Targets">
      {puzzle.rounds.map((r, i) => {
        const o = state.outcomes[i];
        const status = o === 'hit' ? 'hit' : o === 'skipped' ? 'skipped' : i === state.round ? 'current' : 'upcoming';
        return (
          <li key={i} className="sw-track__item" data-status={status} aria-current={status === 'current' ? 'step' : undefined}>
            <span className="sw-track__mark" aria-hidden="true">
              {o === 'hit' ? <IconCheck size={14} /> : o === 'skipped' ? '–' : i + 1}
            </span>
            <span className="sw-track__label">{r.label}</span>
            <span className="visually-hidden">{status === 'hit' ? ', hit' : status === 'skipped' ? ', skipped' : status === 'current' ? ', in play' : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}

function ExprLine({ tokens, tiles, placeholder }: { tokens: Token[]; tiles: number[]; placeholder?: string }) {
  if (tokens.length === 0) return <span className="sw-expr__placeholder">{placeholder}</span>;
  return (
    <>
      {tokens.map((tok, i) => (
        <span key={i} className={`sw-tok sw-tok--${tok.t}`}>
          {tok.t === 'num' ? tiles[tok.tile] : tok.t === 'op' ? OP_GLYPH[tok.op] : tok.t === 'lp' ? '(' : ')'}
        </span>
      ))}
    </>
  );
}

export default function Sumwise({ puzzle, record, save }: DailyGameProps<Puzzle, State>) {
  const rounds = puzzle.rounds.length;
  const [state, setState] = useState<State>(() => (validState(record?.state, rounds) ? record!.state : initialState(rounds)));
  const [confirmSkip, setConfirmSkip] = useState(false);
  const [shake, setShake] = useState(0);
  const finished = record?.status === 'won' || record?.status === 'lost' || isDone(state);

  const commit = useCallback(
    (next: State) => {
      setState(next);
      if (isDone(next)) save({ status: isWin(next) ? 'won' : 'lost', state: next, result: resultFor(next) });
      else save({ status: 'playing', state: next });
    },
    [save],
  );

  const round = finished ? null : puzzle.rounds[state.round];
  const tokens = finished ? NO_TOKENS : state.exprs[state.round];
  const used = usedTiles(tokens);
  const preview = round ? formatValue(tokens, round.tiles) : null;
  const onTarget = !!(round && preview?.ok && fEq(preview.value, frac(round.target)));

  const push = useCallback(
    (tok: Token) => {
      if (!round) return;
      const next = pushToken(tokens, tok, round.tiles.length);
      if (next !== tokens) commit(setExpr(state, next));
    },
    [round, tokens, state, commit],
  );
  const back = useCallback(() => {
    if (tokens.length) commit(setExpr(state, popToken(tokens)));
  }, [tokens, state, commit]);
  const clear = useCallback(() => {
    if (tokens.length) commit(setExpr(state, []));
  }, [tokens, state, commit]);
  const submit = useCallback(() => {
    if (!round) return;
    if (onTarget) commit(finishRound(state, 'hit'));
    else setShake((n) => n + 1);
  }, [round, onTarget, state, commit]);
  const skip = (o: Outcome) => {
    setConfirmSkip(false);
    commit(finishRound(state, o));
  };

  // Desktop keyboard: + − * / ( ) Backspace Enter Escape, and digits to pick a free tile.
  const digitBuf = useRef('');
  const digitTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!round) return;
    const pickTile = (buf: string, final: boolean) => {
      const free = round.tiles.map((v, i) => ({ v: String(v), i })).filter((x) => !used.has(x.i));
      const exact = free.find((x) => x.v === buf);
      const longer = free.some((x) => x.v.length > buf.length && x.v.startsWith(buf));
      if (exact && (!longer || final)) {
        digitBuf.current = '';
        push({ t: 'num', tile: exact.i });
        return;
      }
      if (!longer) digitBuf.current = '';
    };
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (document.querySelector('dialog[open]')) return;
      const k = e.key;
      if (/^\d$/.test(k)) {
        window.clearTimeout(digitTimer.current);
        digitBuf.current += k;
        pickTile(digitBuf.current, false);
        if (digitBuf.current) digitTimer.current = window.setTimeout(() => pickTile(digitBuf.current, true), 700);
        return;
      }
      const op: Op | undefined = k === '+' ? '+' : k === '-' ? '-' : k === '*' || k === 'x' ? '*' : k === '/' ? '/' : undefined;
      if (op) {
        e.preventDefault();
        push({ t: 'op', op });
      } else if (k === '(') push({ t: 'lp' });
      else if (k === ')') push({ t: 'rp' });
      else if (k === 'Backspace') {
        e.preventDefault();
        back();
      } else if (k === 'Escape') clear();
      else if (k === 'Enter' && !(t && t.tagName === 'BUTTON')) {
        e.preventDefault();
        submit();
      }
    };
    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      window.clearTimeout(digitTimer.current);
    };
  }, [round, used, push, back, clear, submit]);

  if (finished) {
    return (
      <div className="sw">
        <RoundTrack puzzle={puzzle} state={state} />
        <ul className="sw-summary">
          {puzzle.rounds.map((r, i) => (
            <li key={i} className="sw-summary__row" data-outcome={state.outcomes[i] ?? 'skipped'}>
              <div className="sw-summary__head">
                <span className="eyebrow">{r.label}</span>
                <span className="sw-summary__target display">{r.target}</span>
              </div>
              <p className="sw-summary__expr">
                {state.outcomes[i] === 'hit' ? (
                  <>
                    <IconCheck size={16} /> {tokensToString(state.exprs[i], r.tiles)}
                  </>
                ) : (
                  <span className="muted">Skipped</span>
                )}
              </p>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const r = round!;
  return (
    <div className="sw">
      <RoundTrack puzzle={puzzle} state={state} />

      <section className="sw-target" aria-label={`${r.label} target`}>
        <span className="eyebrow">{r.label} · target</span>
        <span className="sw-target__num display" key={state.round}>
          {r.target}
        </span>
      </section>

      <div className={`sw-expr${onTarget ? ' is-hit' : ''}${shake ? ' anim-shake' : ''}`} key={`shake-${shake}`}>
        <div className="sw-expr__line" aria-label={tokens.length ? `Your sum: ${tokensToString(tokens, r.tiles)}` : 'Your sum is empty'} role="img">
          <ExprLine tokens={tokens} tiles={r.tiles} placeholder="Tap numbers and signs" />
        </div>
        <p className="sw-expr__value" aria-live="polite" data-kind={preview?.ok ? (onTarget ? 'hit' : 'value') : preview?.error === 'incomplete' || preview?.error === 'empty' ? 'hint' : 'error'}>
          {preview?.ok ? (onTarget ? <>= {preview.text} · on target</> : <>= {preview.text}</>) : tokens.length ? preview?.text : ' '}
        </p>
      </div>

      <div className="sw-tiles" role="group" aria-label="Numbers">
        {r.tiles.map((v, i) => (
          <button
            key={i}
            type="button"
            className={`sw-tile${v >= 25 ? ' sw-tile--big' : ''}`}
            disabled={used.has(i)}
            aria-label={used.has(i) ? `${v}, used` : `${v}`}
            onClick={() => push({ t: 'num', tile: i })}
          >
            {v}
          </button>
        ))}
      </div>

      <div className="sw-keys" role="group" aria-label="Signs">
        {OPS.map((op) => (
          <button key={op} type="button" className="sw-key" aria-label={OP_NAME[op]} onClick={() => push({ t: 'op', op })}>
            {OP_GLYPH[op]}
          </button>
        ))}
        <button type="button" className="sw-key" aria-label="Open bracket" onClick={() => push({ t: 'lp' })}>
          (
        </button>
        <button type="button" className="sw-key" aria-label="Close bracket" onClick={() => push({ t: 'rp' })}>
          )
        </button>
        <button type="button" className="sw-key sw-key--util" aria-label="Clear" onClick={clear} disabled={!tokens.length}>
          Clear
        </button>
        <button type="button" className="sw-key sw-key--util" aria-label="Backspace" onClick={back} disabled={!tokens.length}>
          <IconBackspace size={22} />
        </button>
      </div>

      <div className="sw-actions">
        <Button variant="quiet" onClick={() => setConfirmSkip(true)}>
          Skip target
        </Button>
        <Button variant="primary" onClick={submit} disabled={!onTarget}>
          Submit
        </Button>
      </div>

      <Confirm
        open={confirmSkip}
        title="Skip this target?"
        message="It counts as a miss. You'll see a solution once today's set is finished."
        confirmLabel="Skip"
        onCancel={() => setConfirmSkip(false)}
        onConfirm={() => skip('skipped')}
      />
    </div>
  );
}

export function SumwiseReveal({ puzzle, record }: { puzzle: Puzzle; record: DailyRecord<State> }) {
  const st = validState(record.state, puzzle.rounds.length) ? record.state : initialState(puzzle.rounds.length);
  return (
    <div className="sw-reveal">
      <h3 className="sw-reveal__title">One way to hit each target</h3>
      <ul className="sw-reveal__list">
        {puzzle.rounds.map((r, i) => (
          <li key={i} className="sw-reveal__row">
            <span className="eyebrow">{r.label}</span>
            <p className="sw-reveal__sol">
              {tokensToString(r.solution, r.tiles)} = <strong>{r.target}</strong>
            </p>
            <p className="meta">
              Numbers: {r.tiles.join(', ')}
              {st.outcomes[i] === 'hit' ? ` · You: ${tokensToString(st.exprs[i], r.tiles)}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
