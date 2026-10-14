import { useCallback, useEffect, useState } from 'react';
import type { DailyGameProps, DailyRecord } from '../../../daily/types';
import { Button } from '../../../ui/Button';
import { IconCheck, IconClose } from '../../../ui/icons';
import {
  answer as answerState,
  currentIndex,
  describeTerm,
  initialState,
  isCorrect,
  isDone,
  isWin,
  resultFor,
  type Puzzle,
  type Sequence,
  type State,
  type Visual,
} from './logic';
import './styles.css';

function validState(s: State | undefined, n: number): s is State {
  return !!s && Array.isArray(s.picks) && s.picks.length === n;
}

/* ---------- Pictures ---------- */

function Clock({ angle }: { angle: number }) {
  const rad = (angle * Math.PI) / 180;
  const x = 50 + 31 * Math.sin(rad);
  const y = 50 - 31 * Math.cos(rad);
  return (
    <svg viewBox="0 0 100 100" className="pt-svg pt-clock" aria-hidden="true">
      <circle cx="50" cy="50" r="44" className="pt-clock__face" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i * Math.PI) / 4;
        const r0 = i === 0 ? 34 : 37;
        return <line key={i} x1={50 + r0 * Math.sin(a)} y1={50 - r0 * Math.cos(a)} x2={50 + 42 * Math.sin(a)} y2={50 - 42 * Math.cos(a)} className={i === 0 ? 'pt-clock__tick pt-clock__tick--top' : 'pt-clock__tick'} />;
      })}
      <line x1="50" y1="50" x2={x} y2={y} className="pt-clock__hand" />
      <g transform={`rotate(${angle} 50 50)`}>
        <path d="M50 12 L43 25 L57 25 Z" className="pt-clock__tip" />
      </g>
      <circle cx="50" cy="50" r="5" className="pt-clock__hub" />
    </svg>
  );
}

function Dots({ count }: { count: number }) {
  const rows = Math.ceil(count / 5);
  const top = 50 - ((rows - 1) * 19) / 2;
  return (
    <svg viewBox="0 0 100 100" className="pt-svg pt-dots" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => {
        const row = Math.floor(i / 5);
        const inRow = Math.min(5, count - row * 5);
        const left = 50 - ((inRow - 1) * 18) / 2;
        return <circle key={i} cx={left + (i % 5) * 18} cy={top + row * 19} r="6.5" className="pt-dots__dot" />;
      })}
    </svg>
  );
}

function Term({ value, visual }: { value: number; visual?: Visual }) {
  if (visual === 'clock') return <Clock angle={value} />;
  if (visual === 'dots') return <Dots count={value} />;
  return <span className={`pt-num${String(value).length >= 4 ? ' pt-num--long' : ''}`}>{value}</span>;
}

/* ---------- One sequence ---------- */

function SequenceView({ seq, index }: { seq: Sequence; index: number }) {
  const label = seq.terms.map((t) => describeTerm(t, seq.visual)).join(', ');
  return (
    <div className={`pt-terms${seq.visual ? ' pt-terms--visual' : ''}`} role="img" aria-label={`Sequence ${index + 1}: ${label}, then what?`}>
      {seq.terms.map((t, i) => (
        <span key={i} className="pt-term">
          <Term value={t} visual={seq.visual} />
        </span>
      ))}
      <span className="pt-term pt-term--next" aria-hidden="true">
        ?
      </span>
    </div>
  );
}

function Feedback({ seq, picked }: { seq: Sequence; picked: number }) {
  const right = seq.choices[picked] === seq.answer;
  return (
    <div className={`pt-feedback anim-rise${right ? ' is-right' : ' is-wrong'}`}>
      <p className="pt-feedback__head">
        {right ? <IconCheck size={18} /> : <IconClose size={18} />}
        {right ? 'Correct' : 'Not this time'}
        {!right && !seq.visual && <span className="muted"> · it was {seq.answer}</span>}
      </p>
      <p className="pt-feedback__why">{seq.explanation}</p>
    </div>
  );
}

function Choices({
  seq,
  selected,
  picked,
  onSelect,
}: {
  seq: Sequence;
  selected: number | null;
  picked: number | null;
  onSelect?: (i: number) => void;
}) {
  const locked = picked !== null;
  return (
    <div className={`pt-choices${seq.visual ? ' pt-choices--visual' : ''}`} role="radiogroup" aria-label="Choose the next term">
      {seq.choices.map((c, i) => {
        // Correctness is only exposed once this sequence has been answered.
        const status = !locked ? (selected === i ? 'selected' : 'idle') : c === seq.answer ? 'answer' : picked === i ? 'wrong' : 'idle';
        const desc = describeTerm(c, seq.visual);
        const suffix = status === 'answer' ? ', correct answer' : status === 'wrong' ? ', your answer, wrong' : '';
        return (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={locked ? picked === i : selected === i}
            aria-label={`Option ${i + 1}: ${desc}${suffix}`}
            className="pt-choice"
            data-status={status}
            disabled={locked}
            onClick={() => onSelect?.(i)}
          >
            <Term value={c} visual={seq.visual} />
            {status === 'answer' && <IconCheck size={18} className="pt-choice__mark" />}
            {status === 'wrong' && <IconClose size={18} className="pt-choice__mark" />}
          </button>
        );
      })}
    </div>
  );
}

function Track({ puzzle, state, viewing }: { puzzle: Puzzle; state: State; viewing: number }) {
  return (
    <ol className="pt-track" aria-label="Sequences">
      {puzzle.sequences.map((s, i) => {
        const done = state.picks[i] !== null;
        const right = done && isCorrect(state, puzzle, i);
        const status = done ? (right ? 'right' : 'wrong') : i === viewing ? 'current' : 'upcoming';
        return (
          <li key={i} className="pt-track__item" data-status={status} aria-current={i === viewing ? 'step' : undefined}>
            <span className="pt-track__mark" aria-hidden="true">
              {status === 'right' ? <IconCheck size={13} /> : status === 'wrong' ? <IconClose size={13} /> : i + 1}
            </span>
            {s.level}
            <span className="visually-hidden">{status === 'right' ? ', correct' : status === 'wrong' ? ', missed' : ''}</span>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- Game ---------- */

export default function Pattern({ puzzle, record, save }: DailyGameProps<Puzzle, State>) {
  const n = puzzle.sequences.length;
  const [state, setState] = useState<State>(() => (validState(record?.state, n) ? record!.state : initialState(n)));
  const [viewing, setViewing] = useState(() => currentIndex(state));
  const [selected, setSelected] = useState<number | null>(null);
  const finished = record?.status === 'won' || record?.status === 'lost' || isDone(state);

  const seq = puzzle.sequences[Math.min(viewing, n - 1)];
  const picked = viewing < n ? state.picks[viewing] : null;

  const check = useCallback(() => {
    if (selected === null || picked !== null || viewing !== currentIndex(state)) return;
    const next = answerState(state, puzzle, selected);
    setState(next);
    setSelected(null);
    if (isDone(next)) save({ status: isWin(next, puzzle) ? 'won' : 'lost', state: next, result: resultFor(next, puzzle) });
    else save({ status: 'playing', state: next });
  }, [selected, picked, viewing, state, puzzle, save]);

  const goNext = useCallback(() => setViewing((v) => Math.min(currentIndex(state), v + 1)), [state]);

  useEffect(() => {
    if (finished) return;
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (/^[1-4]$/.test(e.key) && picked === null) setSelected(Number(e.key) - 1);
      else if (e.key === 'Enter' && !(t && t.tagName === 'BUTTON')) {
        e.preventDefault();
        if (picked === null) check();
        else goNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [finished, picked, check, goNext]);

  if (finished) {
    return (
      <div className="pt">
        <Track puzzle={puzzle} state={state} viewing={-1} />
        <ul className="pt-final">
          {puzzle.sequences.map((s, i) => (
            <li key={i} className="pt-final__item">
              <p className="eyebrow">
                {s.level} · {isCorrect(state, puzzle, i) ? 'correct' : 'missed'}
              </p>
              <SequenceView seq={s} index={i} />
              <Choices seq={s} selected={null} picked={state.picks[i] ?? -1} />
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="pt">
      <Track puzzle={puzzle} state={state} viewing={viewing} />
      <section className="pt-card" key={viewing} aria-labelledby="pt-q">
        <p className="eyebrow">
          {seq.level} · {viewing + 1} of {n}
        </p>
        <h2 id="pt-q" className="pt-q display">
          {seq.visual === 'clock' ? 'Where does the hand point next?' : seq.visual === 'dots' ? 'How many dots come next?' : 'What comes next?'}
        </h2>
        <SequenceView seq={seq} index={viewing} />
      </section>

      <Choices seq={seq} selected={selected} picked={picked} onSelect={setSelected} />

      <div aria-live="polite">{picked !== null && <Feedback seq={seq} picked={picked} />}</div>

      <div className="pt-actions">
        {picked === null ? (
          <Button variant="primary" size="lg" block onClick={check} disabled={selected === null}>
            Check
          </Button>
        ) : (
          <Button variant="primary" size="lg" block onClick={goNext}>
            Next sequence
          </Button>
        )}
      </div>
      {picked === null && <p className="meta pt-note">One try per sequence. Pick an option, then check it.</p>}
    </div>
  );
}

export function PatternReveal({ puzzle, record }: { puzzle: Puzzle; record: DailyRecord<State> }) {
  const st = validState(record.state, puzzle.sequences.length) ? record.state : initialState(puzzle.sequences.length);
  return (
    <div className="pt-reveal">
      {puzzle.sequences.map((s, i) => (
        <div key={i} className="pt-reveal__item">
          <div className="pt-reveal__head">
            <span className="eyebrow">{s.level}</span>
            <span className="pt-reveal__verdict">{isCorrect(st, puzzle, i) ? 'Correct' : 'Missed'}</span>
          </div>
          <div className="pt-reveal__answer">
            <span className="muted">Answer</span>
            {s.visual ? (
              <span className="pt-reveal__pic" role="img" aria-label={describeTerm(s.answer, s.visual)}>
                <Term value={s.answer} visual={s.visual} />
              </span>
            ) : (
              <strong>{s.answer}</strong>
            )}
          </div>
          <p className="pt-reveal__why">{s.explanation}</p>
        </div>
      ))}
    </div>
  );
}
