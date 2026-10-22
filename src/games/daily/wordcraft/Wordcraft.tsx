import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import type { DailyGameProps, DailyRecord } from '../../../daily/types';
import { Keyboard, usePhysicalKeyboard, type KeyPress } from '../../../ui/Keyboard';
import {
  ERROR_TEXT,
  MARK_TEXT,
  MAX_GUESSES,
  WORD_LENGTH,
  checkGuess,
  evaluate,
  keyStates,
  normalize,
  resultFor,
  statusOf,
  type Mark,
} from './logic';
import './styles.css';

export interface WordcraftPuzzle {
  answer: string;
}

export interface WordcraftState {
  guesses: string[];
}

const REVEAL_MS = 5 * 110 + 420;

export default function Wordcraft({ puzzle, record, save }: DailyGameProps<WordcraftPuzzle, WordcraftState>) {
  const { answer } = puzzle;
  const [guesses, setGuesses] = useState<string[]>(() => record?.state?.guesses ?? []);
  const [current, setCurrent] = useState('');
  const [message, setMessage] = useState<{ id: number; text: string } | null>(null);
  const [shake, setShake] = useState(0);
  const [revealRow, setRevealRow] = useState<number | null>(null);
  const msgTimer = useRef<number | undefined>(undefined);

  const status = statusOf(guesses, answer);
  const finished = record?.status === 'won' || record?.status === 'lost' || status !== 'playing';
  const revealing = revealRow !== null;

  useEffect(() => () => window.clearTimeout(msgTimer.current), []);

  const flash = useCallback((text: string, ms = 1800) => {
    window.clearTimeout(msgTimer.current);
    const id = Date.now();
    setMessage({ id, text });
    msgTimer.current = window.setTimeout(() => setMessage((m) => (m?.id === id ? null : m)), ms);
  }, []);

  const submit = useCallback(() => {
    const err = checkGuess(current);
    if (err) {
      setShake((s) => s + 1);
      flash(ERROR_TEXT[err]);
      return;
    }
    const next = [...guesses, normalize(current)];
    setGuesses(next);
    setCurrent('');
    setRevealRow(next.length - 1);
    window.setTimeout(() => setRevealRow(null), REVEAL_MS);
    const st = statusOf(next, answer);
    if (st === 'playing') save({ status: 'playing', state: { guesses: next } });
    else {
      save({ status: st, state: { guesses: next }, result: resultFor(next, answer) });
      window.setTimeout(() => flash(st === 'won' ? WIN_WORDS[next.length - 1] : 'So close. Better luck tomorrow', 3200), REVEAL_MS);
    }
  }, [current, guesses, answer, save, flash]);

  const onKey = useCallback(
    (k: KeyPress) => {
      if (finished || revealing) return;
      if (k.type === 'letter') setCurrent((c) => (c.length < WORD_LENGTH ? c + k.letter : c));
      else if (k.type === 'back') setCurrent((c) => c.slice(0, -1));
      else submit();
    },
    [finished, revealing, submit],
  );

  usePhysicalKeyboard(onKey, !finished);

  // Key colours only update once the row has finished flipping.
  const shownGuesses = revealing ? guesses.slice(0, -1) : guesses;
  const states = useMemo(() => keyStates(shownGuesses, answer), [shownGuesses, answer]);

  const rows = Array.from({ length: MAX_GUESSES }, (_, r) => r);
  const activeRow = finished ? -1 : guesses.length;

  return (
    <div className={`wc${finished && !revealing ? ' wc--done' : ''}`}>
      <div className="wc-msg" role="status" aria-live="polite">
        {message && (
          <span className="wc-msg__bubble anim-rise" key={message.id}>
            {message.text}
          </span>
        )}
      </div>

      <div className="wc-board" role="group" aria-label={`Guesses, ${guesses.length} of ${MAX_GUESSES} used`}>
        {rows.map((r) => {
          const word = r < guesses.length ? guesses[r] : r === activeRow ? current : '';
          const marks: Mark[] | null = r < guesses.length ? evaluate(guesses[r], answer) : null;
          const isShaking = r === activeRow && shake > 0;
          return (
            <div
              key={r === activeRow ? `row-${r}-${shake}` : `row-${r}`}
              className={`wc-row${isShaking ? ' anim-shake' : ''}`}
              role="group"
              aria-label={`Row ${r + 1}${marks ? '' : r === activeRow ? ', current' : ', empty'}`}
            >
              {Array.from({ length: WORD_LENGTH }, (_, i) => {
                const letter = word[i] ?? '';
                const mark = marks?.[i];
                const label = letter ? (mark ? `${letter.toUpperCase()}, ${MARK_TEXT[mark]}` : letter.toUpperCase()) : 'empty';
                return (
                  <span
                    key={i}
                    role="img"
                    aria-label={label}
                    className={[
                      'wc-tile',
                      letter && !mark ? 'wc-tile--filled' : '',
                      mark ? `wc-tile--${mark}` : '',
                      mark && r === revealRow ? 'wc-tile--reveal' : '',
                      letter && !mark && r === activeRow && i === current.length - 1 ? 'anim-pop' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ '--i': i } as CSSProperties}
                  >
                    <span aria-hidden="true">{letter}</span>
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>

      {(!finished || revealing) && (
        <div className="wc-kb">
          <Keyboard onKey={onKey} states={states} disabled={revealing} />
        </div>
      )}
    </div>
  );
}

const WIN_WORDS = ['Unreal!', 'Brilliant', 'Lovely work', 'Nicely done', 'Got there', 'Phew, just in time'];

export function WordcraftRules() {
  return (
    <>
      <p>Find the hidden five-letter word in six guesses. Each guess must be a real word.</p>
      <ul>
        <li><strong>Green</strong> with a bar: right letter, right spot.</li>
        <li><strong>Gold</strong> with a dot: in the word, but somewhere else.</li>
        <li><strong>Plain</strong>: not in the word (or no more copies of it).</li>
        <li>Letters can repeat. A new word every day.</li>
      </ul>
    </>
  );
}

export function WordcraftReveal({ puzzle }: { puzzle: WordcraftPuzzle; record: DailyRecord<WordcraftState> }) {
  return (
    <p className="wc-reveal">
      The word was <strong className="wc-reveal__word">{puzzle.answer.toUpperCase()}</strong>
    </p>
  );
}
