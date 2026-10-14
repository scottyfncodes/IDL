import { useState } from 'react';
import type { DailyGameProps, DailyRecord } from '../../../daily/types';
import { Button } from '../../../ui/Button';
import { Sheet } from '../../../ui/Sheet';
import { SuspectFigure } from './Figure';
import {
  accuse,
  clueText,
  explanation,
  MAX_ACCUSATIONS,
  refutingClue,
  resultGrid,
  scoreText,
  status as gameStatus,
  toggleRuledOut,
  valueLabel,
  wrongAccusations,
  type Puzzle,
  type State,
  type Suspect,
} from './logic';
import './styles.css';

const EMPTY: State = { ruledOut: [], accusations: [] };

const describe = (s: Suspect) =>
  `${s.hat === 'none' ? 'no hat' : s.hat === 'bobble' ? 'bobble hat' : s.hat}, ${s.coat} coat, ${s.holding === 'nothing' ? 'empty hands' : `holding ${s.holding === 'umbrella' ? 'an' : 'a'} ${s.holding}`}`;

export default function Deduction({ puzzle, record, save }: DailyGameProps<Puzzle, State>) {
  const [state, setState] = useState<State>(() => record?.state ?? EMPTY);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [choice, setChoice] = useState<number | null>(null);

  const st = record && record.status !== 'playing' ? record.status : gameStatus(puzzle, state);
  const over = st !== 'playing';
  const wrong = wrongAccusations(puzzle, state);
  const left = MAX_ACCUSATIONS - wrong;
  const last = state.accusations[state.accusations.length - 1];
  const culpritName = puzzle.suspects[puzzle.culprit].name;

  const commit = (next: State) => {
    setState(next);
    const s = gameStatus(puzzle, next);
    if (s === 'playing') save({ status: 'playing', state: next });
    else save({ status: s, state: next, result: { score: scoreText(puzzle, next), grid: [resultGrid(puzzle, next)] } });
  };

  const onToggle = (i: number) => {
    if (over) return;
    commit(toggleRuledOut(puzzle, state, i));
  };

  const onAccuse = () => {
    if (choice === null) return;
    const res = accuse(puzzle, state, choice);
    setSheetOpen(false);
    setChoice(null);
    if (res) commit(res.state);
  };

  let statusText: string;
  if (st === 'won') statusText = `Case closed. It was ${culpritName}.`;
  else if (st === 'lost') statusText = `Out of accusations. It was ${culpritName}.`;
  else if (last !== undefined) {
    const k = refutingClue(puzzle, last);
    statusText = `Not ${puzzle.suspects[last].name}: clue ${k + 1} rules them out. ${left} ${left === 1 ? 'accusation' : 'accusations'} left.`;
  } else statusText = 'Read the clues, cross off suspects, then make your accusation.';

  return (
    <div className="dd">
      <section className="dd-case">
        <p className="dd-case__kicker">Today’s case</p>
        <h2 className="dd-case__title display">{puzzle.scenario.title}</h2>
        <p className="dd-case__text">{puzzle.scenario.text}</p>
      </section>

      <div className="dd-lineup-wrap">
        <div className="dd-lineup__axis" aria-hidden="true"><span>Left</span><span>Right</span></div>
        <ol className="dd-lineup" aria-label="Lineup, left to right" style={{ gridTemplateColumns: `repeat(${puzzle.suspects.length}, minmax(0, 1fr))` }}>
          {puzzle.suspects.map((s, i) => {
            const out = state.ruledOut.includes(i);
            const accusedWrong = state.accusations.includes(i) && (over ? i !== puzzle.culprit : true);
            const isCulprit = over && i === puzzle.culprit;
            const label = `${i + 1}. ${s.name}: ${describe(s)}.${isCulprit ? ' The culprit.' : accusedWrong ? ' Wrongly accused.' : ''}${out && !isCulprit ? ' Crossed off.' : ''}`;
            return (
              <li key={i} className="dd-slot">
                <button
                  type="button"
                  className={`dd-suspect${out ? ' is-out' : ''}${isCulprit ? ' is-culprit' : ''}${accusedWrong ? ' is-cleared' : ''}`}
                  aria-pressed={over ? undefined : out}
                  aria-label={label}
                  disabled={over}
                  onClick={() => onToggle(i)}
                >
                  <span className="dd-suspect__pos" aria-hidden="true">{i + 1}</span>
                  <span className="dd-suspect__fig" aria-hidden="true">
                    <SuspectFigure suspect={s} />
                    {out && !isCulprit && (
                      <svg className="dd-suspect__cross" viewBox="0 0 40 40" aria-hidden="true"><path d="M8 8l24 24M32 8L8 32" /></svg>
                    )}
                  </span>
                  <span className="dd-suspect__name" aria-hidden="true">{s.name}</span>
                  <span className="dd-suspect__tags" aria-hidden="true">
                    <span>{valueLabel('hat', s.hat)}</span>
                    <span>{valueLabel('coat', s.coat)}</span>
                    <span>{valueLabel('holding', s.holding)}</span>
                  </span>
                  {isCulprit && <span className="dd-suspect__badge dd-suspect__badge--culprit" aria-hidden="true">Culprit</span>}
                  {accusedWrong && !isCulprit && <span className="dd-suspect__badge" aria-hidden="true">Accused</span>}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
      {!over && <p className="dd-hint">Tap a suspect to cross them off. Notes are free.</p>}

      <section className="dd-clues-wrap" aria-labelledby="dd-clues-h">
        <h3 id="dd-clues-h" className="dd-clues__h">Clues</h3>
        <ol className="dd-clues">
          {puzzle.clues.map((c, k) => (
            <li key={k} className="dd-clue">
              <span className="dd-clue__n" aria-hidden="true">{k + 1}</span>
              <span><span className="sr-only">Clue {k + 1}: </span>{clueText(c)}</span>
            </li>
          ))}
        </ol>
      </section>

      <p className={`status-line dd-status${!over && last !== undefined ? ' is-miss' : ''}`} aria-live="polite">{statusText}</p>

      {!over && (
        <div className="dd-actions">
          <Button variant="primary" size="lg" onClick={() => setSheetOpen(true)}>Make an accusation</Button>
          <span className="dd-tries" aria-label={`${left} of ${MAX_ACCUSATIONS} accusations left`}>
            {Array.from({ length: MAX_ACCUSATIONS }, (_, i) => (
              <span key={i} className={`dd-tries__dot${i < wrong ? ' is-used' : ''}`} aria-hidden="true" />
            ))}
            <span aria-hidden="true">{left} left</span>
          </span>
        </div>
      )}

      <Sheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setChoice(null);
        }}
        title="Who did it?"
        actions={
          <>
            <Button variant="quiet" onClick={() => { setSheetOpen(false); setChoice(null); }}>Not yet</Button>
            <Button variant="primary" disabled={choice === null} onClick={onAccuse}>
              {choice === null ? 'Accuse' : `Accuse ${puzzle.suspects[choice].name}`}
            </Button>
          </>
        }
      >
        <div className="dd-pick" role="radiogroup" aria-label="Choose a suspect">
          {puzzle.suspects.map((s, i) => {
            const done = state.accusations.includes(i);
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={choice === i}
                disabled={done}
                className="dd-pick__opt"
                onClick={() => setChoice(i)}
              >
                <span className="dd-pick__pos" aria-hidden="true">{i + 1}</span>
                <span className="dd-pick__name">{s.name}</span>
                <span className="dd-pick__meta">{done ? 'already accused' : state.ruledOut.includes(i) ? 'crossed off' : describe(s)}</span>
              </button>
            );
          })}
        </div>
      </Sheet>
    </div>
  );
}

export function DeductionReveal({ puzzle }: { puzzle: Puzzle; record: DailyRecord<State> }) {
  const culprit = puzzle.suspects[puzzle.culprit];
  return (
    <div className="dd-reveal">
      <p className="dd-reveal__lead">
        <strong>{culprit.name}</strong> did it — position {puzzle.culprit + 1}, {describe(culprit)}.
      </p>
      <ol className="dd-reveal__list">
        {explanation(puzzle).map((e, k) => (
          <li key={k}>
            <span className="dd-clue__n" aria-hidden="true">{k + 1}</span>
            <span>
              <span className="dd-reveal__clue">{e.text}</span>
              <span className="dd-reveal__elim">Rules out {listNames(e.eliminated)}.</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="meta">Only {culprit.name} fits every clue.</p>
    </div>
  );
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
