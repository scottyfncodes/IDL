import { useCallback, useEffect, useRef, useState } from 'react';
import type { DailyGameProps, DailyRecord } from '../../../daily/types';
import { freshSeed } from '../../../lib/rng';
import { Button } from '../../../ui/Button';
import { IconShuffle } from '../../../ui/icons';
import {
  GROUP_SIZE,
  LEVEL_NAMES,
  MAX_MISTAKES,
  applyGuess,
  bandOrder,
  initialState,
  remainingWords,
  resultFor,
  shuffleOrder,
  statusOf,
  wordKey,
  type LinkupGroup,
  type LinkupPuzzle,
  type LinkupState,
} from './logic';
import './styles.css';

const LEVEL_TONES = ['ochre', 'moss', 'tide', 'plum'] as const;

/** Tile text size steps down for long words so 4 tiles fit across a phone. */
function sizeClass(word: string): string {
  const longest = Math.max(...word.split(' ').map((p) => p.length));
  if (longest >= 10) return ' lk-tile--xs';
  if (longest >= 8) return ' lk-tile--sm';
  return '';
}

export function LevelMarker({ level }: { level: number }) {
  return (
    <span className="lk-level" role="img" aria-label={`Level ${level + 1} of 4: ${LEVEL_NAMES[level].toLowerCase()}`}>
      {Array.from({ length: 4 }, (_, i) => (
        <span key={i} className={`lk-level__pip${i <= level ? ' is-on' : ''}`} />
      ))}
    </span>
  );
}

export function GroupBand({ group, found, fresh }: { group: LinkupGroup; found: boolean; fresh?: boolean }) {
  return (
    <div
      className={`lk-band lk-band--${LEVEL_TONES[group.level]}${fresh ? ' anim-pop' : ''}${found ? '' : ' lk-band--revealed'}`}
      role="group"
      aria-label={`${found ? 'Found' : 'Missed'}: ${group.label}. ${group.words.join(', ')}`}
    >
      <div className="lk-band__head">
        <LevelMarker level={group.level} />
        <span className="lk-band__label">{group.label}</span>
      </div>
      <p className="lk-band__words" aria-hidden="true">
        {group.words.join(' · ')}
      </p>
    </div>
  );
}

type Message = { id: number; text: string };

export default function Linkup({ date, puzzle, record, save }: DailyGameProps<LinkupPuzzle, LinkupState>) {
  const [state, setState] = useState<LinkupState>(() => record?.state ?? initialState(puzzle, date));
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState<Message | null>(null);
  const [shaking, setShaking] = useState(false);
  const [freshBand, setFreshBand] = useState<number | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const shakeTimer = useRef<number | undefined>(undefined);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      window.clearTimeout(shakeTimer.current);
    },
    [],
  );

  const status = statusOf(state);
  const finished = status !== 'playing' || record?.status === 'won' || record?.status === 'lost';
  const tiles = remainingWords(puzzle, state);
  const bands = bandOrder(puzzle, state);

  const flash = useCallback((text: string, ms = 1800) => {
    window.clearTimeout(timer.current);
    const id = Date.now();
    setMessage({ id, text });
    timer.current = window.setTimeout(() => setMessage((m) => (m?.id === id ? null : m)), ms);
  }, []);

  const toggle = (word: string) => {
    if (finished) return;
    setSelected((sel) => (sel.includes(word) ? sel.filter((w) => w !== word) : sel.length < GROUP_SIZE ? [...sel, word] : sel));
  };

  const submit = () => {
    if (selected.length !== GROUP_SIZE || finished) return;
    const { state: next, outcome } = applyGuess(puzzle, state, selected);
    if (outcome.kind === 'duplicate') {
      flash('Already tried');
      return;
    }
    if (outcome.kind === 'invalid') return;
    setState(next);
    const st = statusOf(next);
    if (outcome.kind === 'correct') {
      setSelected([]);
      setFreshBand(outcome.group);
      if (st === 'won') flash(next.mistakes === 0 ? 'Flawless!' : 'All four found', 2600);
    } else {
      setShaking(true);
      window.clearTimeout(shakeTimer.current);
      shakeTimer.current = window.setTimeout(() => setShaking(false), 400);
      if (st === 'lost') {
        setSelected([]);
        flash('Out of mistakes — here they are', 2600);
      } else flash(outcome.kind === 'one-away' ? 'One away…' : 'Not quite');
    }
    if (st === 'playing') save({ status: 'playing', state: next });
    else save({ status: st, state: next, result: resultFor(puzzle, next) });
  };

  const shuffle = () => {
    const next = { ...state, order: shuffleOrder(state.order, freshSeed()) };
    setState(next);
    save({ status: 'playing', state: next });
  };

  const left = MAX_MISTAKES - state.mistakes;
  const selectedKeys = new Set(selected.map(wordKey));

  return (
    <div className="lk">
      <p className="lk-intro meta">{finished ? 'The four groups' : 'Make four groups of four.'}</p>

      <div className="lk-board">
        {bands.map((b) => (
          <GroupBand key={b.group} group={puzzle.groups[b.group]} found={b.found} fresh={freshBand === b.group} />
        ))}
        {!finished && tiles.length > 0 && (
          <div className="lk-grid" role="group" aria-label="Words">
            {tiles.map((w) => {
              const on = selectedKeys.has(wordKey(w));
              return (
                <button
                  key={w}
                  type="button"
                  className={`lk-tile${sizeClass(w)}${on ? ' is-selected' : ''}${on && shaking ? ' lk-tile--shake' : ''}`}
                  aria-pressed={on}
                  onClick={() => toggle(w)}
                >
                  {w}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="lk-msg" role="status" aria-live="polite">
        {message && (
          <span className="lk-msg__bubble anim-rise" key={message.id}>
            {message.text}
          </span>
        )}
      </div>

      {!finished && (
        <>
          <div className="lk-mistakes" aria-label={`${left} ${left === 1 ? 'mistake' : 'mistakes'} left`}>
            <span className="meta" aria-hidden="true">Mistakes left</span>
            <span className="lk-mistakes__dots" aria-hidden="true">
              {Array.from({ length: MAX_MISTAKES }, (_, i) => (
                <span key={i} className={`lk-dot${i < left ? ' is-on' : ''}`} />
              ))}
            </span>
          </div>
          <div className="lk-actions">
            <Button variant="quiet" size="md" onClick={shuffle} icon={<IconShuffle size={18} />} aria-label="Shuffle words">
              Shuffle
            </Button>
            <Button variant="quiet" size="md" onClick={() => setSelected([])} disabled={selected.length === 0}>
              Deselect
            </Button>
            <Button variant="primary" size="md" onClick={submit} disabled={selected.length !== GROUP_SIZE}>
              Submit
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function LinkupRules() {
  return (
    <>
      <p>Sixteen words hide four groups of four. Find what links each group.</p>
      <ul>
        <li>Tap four words, then <strong>Submit</strong>.</li>
        <li>Three right and one wrong? You’ll see <strong>One away…</strong></li>
        <li>You can make <strong>four mistakes</strong>. Repeating a guess is free.</li>
        <li>Groups run from straightforward (one pip) to devious (four pips) — the last is often wordplay, like <em>___ cake</em>.</li>
        <li>Some words fit more than one group. Only one split uses all sixteen.</li>
      </ul>
    </>
  );
}

export function LinkupReveal({ puzzle, record }: { puzzle: LinkupPuzzle; record: DailyRecord<LinkupState> }) {
  const solved = new Set(record.state?.solved ?? []);
  const order = puzzle.groups.map((_, i) => i).sort((a, b) => puzzle.groups[a].level - puzzle.groups[b].level);
  return (
    <ul className="lk-reveal" aria-label="Today’s groups">
      {order.map((i) => {
        const g = puzzle.groups[i];
        return (
          <li key={i} className="lk-reveal__item">
            <span className={`lk-reveal__swatch lk-band--${LEVEL_TONES[g.level]}`} aria-hidden="true" />
            <LevelMarker level={g.level} />
            <span className="lk-reveal__text">
              <strong>{g.label}</strong>
              <span className="meta"> — {g.words.join(', ')}</span>
              {!solved.has(i) && <span className="meta"> (missed)</span>}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
