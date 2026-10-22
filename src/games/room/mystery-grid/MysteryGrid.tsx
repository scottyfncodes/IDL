import { useState } from 'react';
import { usePersistentState } from '../../../lib/storage';
import { recordRoomResult } from '../../../room/stats';
import { freshSeed } from '../../../lib/rng';
import { GameScreen } from '../../../ui/GameScreen';
import { Button } from '../../../ui/Button';
import { Confirm } from '../../../ui/Confirm';
import { Segmented } from '../../../ui/Segmented';
import { IconCheck, IconLightbulb, IconUndo } from '../../../ui/icons';
import {
  CROSS,
  DIFFICULTY_LABEL,
  DOT,
  EMPTY,
  GRIDS,
  cellIndex,
  cellLabel,
  check,
  clueText,
  cycleMark,
  emptyMarks,
  generate,
  hint,
  isComplete,
  setMark,
  solutionRows,
  solveScore,
  themeById,
  type Difficulty,
  type Mark,
  type Puzzle,
} from './logic';
import './styles.css';

interface Game {
  puzzle: Puzzle;
  marks: Mark[];
  struck: number[];
  history: Mark[][];
  hints: number;
  checks: number;
  won: boolean;
  /** Has the solve been recorded in stats? Guards against double counting. */
  recorded?: boolean;
  /** Was it a personal best (fewest hints + wrong checks) for this difficulty? */
  newBest?: boolean;
}

interface State {
  difficulty: Difficulty;
  autoCross: boolean;
  tab: number;
  game: Game | null;
}

interface Note {
  text: string;
  tone: 'info' | 'warn' | 'good';
  cell?: number;
}

const initial = (): State => ({ difficulty: 'gentle', autoCross: true, tab: 0, game: null });
const HISTORY_CAP = 120;

const DIFF_OPTIONS: { value: Difficulty; label: string }[] = [
  { value: 'gentle', label: 'Gentle' },
  { value: 'tricky', label: 'Tricky' },
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const MARK_WORD: Record<Mark, string> = { 0: 'unmarked', 1: 'no', 2: 'yes' };

function MarkGlyph({ mark }: { mark: Mark }) {
  if (mark === CROSS)
    return (
      <svg viewBox="0 0 20 20" className="mg-glyph mg-glyph--x" aria-hidden="true">
        <path d="M5 5l10 10M15 5L5 15" />
      </svg>
    );
  if (mark === DOT)
    return (
      <svg viewBox="0 0 20 20" className="mg-glyph mg-glyph--dot" aria-hidden="true">
        <circle cx="10" cy="10" r="6" />
      </svg>
    );
  return null;
}

const newGame = (difficulty: Difficulty): Game => ({
  puzzle: generate(freshSeed(), difficulty),
  marks: emptyMarks(),
  struck: [],
  history: [],
  hints: 0,
  checks: 0,
  won: false,
});

export default function MysteryGrid() {
  const [state, setState] = usePersistentState<State>('room:mystery-grid', initial, 1);
  const [confirm, setConfirm] = useState<null | 'new' | 'clear'>(null);
  const [note, setNote] = useState<Note | null>(null);
  const { game, tab, autoCross } = state;

  const theme = game ? themeById(game.puzzle.themeId) : null;
  const inProgress = !!game && !game.won && game.marks.some((m) => m !== EMPTY);

  const update = (fn: (g: Game) => Game, extra: Partial<State> = {}) =>
    setState((s) => (s.game ? { ...s, ...extra, game: fn(s.game) } : s));

  const start = (difficulty: Difficulty) => {
    setNote(null);
    setState((s) => ({ ...s, difficulty, tab: 0, game: newGame(difficulty) }));
  };

  const pushMarks = (g: Game, marks: Mark[]): Game => ({ ...g, marks, history: [...g.history, g.marks].slice(-HISTORY_CAP) });

  const onCell = (cell: number) => {
    if (!game || game.won) return;
    setNote(null);
    update((g) => pushMarks(g, setMark(g.marks, cell, cycleMark(g.marks[cell]), autoCross)));
  };

  const undo = () => {
    setNote(null);
    update((g) => (g.history.length ? { ...g, marks: g.history[g.history.length - 1], history: g.history.slice(0, -1) } : g));
  };

  const askHint = () => {
    if (!game || !theme) return;
    const h = hint(game.puzzle, game.marks);
    if (h.kind === 'none') {
      setNote({ text: 'Every square is marked. Try Check.', tone: 'info' });
      return;
    }
    const where = (cell: number) => {
      const l = cellLabel(theme, cell);
      return `${cap(l.row)} × ${cap(l.col)}`;
    };
    const tabOf = (cell: number) => Math.floor(cell / 16);
    if (h.kind === 'wrong') {
      setNote({ text: `The ${h.mark === DOT ? '●' : '✕'} at ${where(h.cell)} isn’t right.`, tone: 'warn', cell: h.cell });
      update((g) => ({ ...g, hints: g.hints + 1 }), { tab: tabOf(h.cell) });
      return;
    }
    const n = h.clues.map((k) => k + 1);
    const why =
      h.clues.length === 0
        ? 'Your marks already settle this'
        : h.clues.length === 1
          ? `Clue ${n[0]} settles this`
          : h.clues.length === 2
            ? `Clues ${n[0]} and ${n[1]} together settle this`
            : 'Taken together, the clues settle this';
    setNote({ text: `${why}: ${where(h.cell)} is ${h.value === DOT ? 'a match ●' : 'not a match ✕'}.`, tone: 'info', cell: h.cell });
    update((g) => ({ ...pushMarks(g, setMark(g.marks, h.cell, h.value, false)), hints: g.hints + 1 }), { tab: tabOf(h.cell) });
  };

  const doCheck = () => {
    if (!game) return;
    const r = check(game.puzzle.solution, game.marks);
    if (!r.complete) return;
    if (r.solved) {
      setNote(null);
      const newBest = game.recorded
        ? !!game.newBest
        : recordRoomResult('mystery-grid', { outcome: 'win', score: solveScore(game.puzzle.difficulty, game.hints, game.checks + 1) });
      update((g) => ({ ...g, checks: g.checks + 1, won: true, recorded: true, newBest }));
    } else {
      setNote({
        text: r.wrong === 1 ? 'Close. 1 of the 12 matches isn’t right yet.' : `Not yet. ${r.wrong} of the 12 matches aren’t right.`,
        tone: 'warn',
      });
      update((g) => ({ ...g, checks: g.checks + 1 }));
    }
  };

  const toggleClue = (k: number) =>
    update((g) => ({ ...g, struck: g.struck.includes(k) ? g.struck.filter((x) => x !== k) : [...g.struck, k] }));

  const rules = (
    <>
      <p>Four people, three categories, one answer. Use the clues to work out who goes with what.</p>
      <ul>
        <li>Each grid pairs two categories. Tap a square once for <strong>✕</strong> (not a match), twice for <strong>●</strong> (a match), a third time to clear.</li>
        <li>Every row and column of each grid has exactly one ●.</li>
        <li>With <strong>Auto-cross</strong> on, placing ● crosses out the rest of its row and column.</li>
        <li>Tap a clue to strike it through once you’ve used it.</li>
        <li><strong>Hint</strong> fills in one square you can deduce, or points at a mark that’s wrong.</li>
        <li>When every grid has its four ●, press <strong>Check</strong>.</li>
      </ul>
    </>
  );

  const menu = [
    { label: 'New puzzle', onSelect: () => (inProgress ? setConfirm('new') : setState((s) => ({ ...s, game: null }))), disabled: !game },
    { label: autoCross ? 'Turn auto-cross off' : 'Turn auto-cross on', onSelect: () => setState((s) => ({ ...s, autoCross: !s.autoCross })) },
    { label: 'Clear the grid', onSelect: () => setConfirm('clear'), disabled: !inProgress, destructive: true },
  ];

  if (!game || !theme) {
    return (
      <GameScreen title="Mystery Grid" kicker="Solo · logic" backTo="/play" rules={rules} menu={menu}>
        <div className="mg-setup panel anim-rise">
          <p className="mg-setup__title display">A fresh case</p>
          <p className="muted">Each puzzle is generated on the spot and has exactly one answer, no guessing needed.</p>
          <Segmented label="Difficulty" options={DIFF_OPTIONS} value={state.difficulty} onChange={(d) => setState((s) => ({ ...s, difficulty: d }))} />
          <p className="meta">{state.difficulty === 'gentle' ? 'More direct clues. A good warm-up.' : 'Fewer giveaways, more “not” and “before”.'}</p>
          <Button variant="primary" size="lg" onClick={() => start(state.difficulty)}>Start</Button>
        </div>
      </GameScreen>
    );
  }

  const [rowCat, colCat] = GRIDS[tab].map((k) => theme.categories[k]);
  const complete = isComplete(game.marks);
  const dotsIn = (g: number) => game.marks.slice(g * 16, g * 16 + 16).filter((m) => m === DOT).length;

  return (
    <GameScreen title="Mystery Grid" kicker={`Solo · ${DIFFICULTY_LABEL[game.puzzle.difficulty]}`} backTo="/play" rules={rules} menu={menu} className="mg-body">
      <header className="mg-case">
        <h2 className="display mg-case__title">{theme.title}</h2>
        <p className="muted mg-case__intro">{theme.intro}</p>
      </header>

      {game.won && (
        <div className="end-card">
          {game.newBest && <p className="eyebrow">New best</p>}
          <p className="end-card__title display">Case closed</p>
          <table className="mg-table">
            <thead>
              <tr>{theme.categories.map((c) => <th key={c.name} scope="col">{c.name}</th>)}</tr>
            </thead>
            <tbody>
              {solutionRows(theme, game.puzzle.solution).map((row) => (
                <tr key={row[0]}>{row.map((v, k) => (k === 0 ? <th key={k} scope="row">{v}</th> : <td key={k}>{cap(v)}</td>))}</tr>
              ))}
            </tbody>
          </table>
          <p className="muted">
            {game.hints === 0 ? 'Solved without a single hint.' : `Solved with ${game.hints} hint${game.hints === 1 ? '' : 's'}.`}
            {game.checks > 1 ? ` ${game.checks} checks.` : ''}
          </p>
          <Segmented label="Difficulty" options={DIFF_OPTIONS} value={state.difficulty} onChange={(d) => setState((s) => ({ ...s, difficulty: d }))} />
          <div className="end-card__actions">
            <Button variant="primary" size="lg" onClick={() => start(state.difficulty)}>New puzzle</Button>
          </div>
        </div>
      )}

      <section className="mg-play">
        <div className="mg-tabs" role="tablist" aria-label="Choose a grid">
          {GRIDS.map(([r, c], g) => (
            <button
              key={g}
              type="button"
              role="tab"
              id={`mg-tab-${g}`}
              aria-selected={tab === g}
              aria-controls="mg-panel"
              className="mg-tab"
              onClick={() => setState((s) => ({ ...s, tab: g }))}
            >
              <span className="mg-tab__names">
                {theme.categories[r].name}
                <span aria-hidden="true"> × </span>
                <span className="visually-hidden"> and </span>
                {theme.categories[c].name}
              </span>
              <span className="mg-tab__count" aria-label={`${dotsIn(g)} of 4 matches`}>
                {[0, 1, 2, 3].map((k) => <i key={k} className={k < dotsIn(g) ? 'is-on' : undefined} />)}
              </span>
            </button>
          ))}
        </div>

        <div className={`mg-grid no-select${game.won ? ' is-won' : ''}`} role="tabpanel" id="mg-panel" aria-labelledby={`mg-tab-${tab}`}>
          <div className="mg-corner" aria-hidden="true">
            <span>{colCat.name} →</span>
            <span>{rowCat.name} ↓</span>
          </div>
          {colCat.items.map((it) => (
            <div key={it} className="mg-colhead" aria-hidden="true"><span>{cap(it)}</span></div>
          ))}
          {rowCat.items.map((rowItem, r) => (
            <div key={rowItem} className="mg-row" role="group" aria-label={cap(rowItem)}>
              <div className="mg-rowhead" aria-hidden="true">{cap(rowItem)}</div>
              {colCat.items.map((colItem, c) => {
                const i = cellIndex(tab, r, c);
                const m = game.marks[i];
                return (
                  <button
                    key={colItem}
                    type="button"
                    className={`mg-cell${note?.cell === i ? ` is-flagged is-${note.tone}` : ''}`}
                    data-mark={m}
                    aria-label={`${cap(rowItem)} and ${colItem}: ${MARK_WORD[m]}`}
                    disabled={game.won}
                    onClick={() => onCell(i)}
                  >
                    <MarkGlyph key={m} mark={m} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <p className={`status-line mg-status mg-status--${note?.tone ?? 'info'}`} aria-live="polite">
          {note?.text ?? (game.won ? '' : complete ? 'Every grid has its matches. Ready to check?' : '')}
        </p>

        {!game.won && (
          <div className="mg-actions">
            <button type="button" className="mg-tool" onClick={undo} disabled={game.history.length === 0}>
              <IconUndo size={20} /><span>Undo</span>
            </button>
            <button type="button" className="mg-tool" onClick={askHint}>
              <IconLightbulb size={20} /><span>Hint</span>
              {game.hints > 0 && <span className="mg-tool__count" aria-label={`${game.hints} used`}>{game.hints}</span>}
            </button>
            <button type="button" className="mg-tool mg-tool--primary" onClick={doCheck} disabled={!complete}>
              <IconCheck size={20} /><span>Check</span>
            </button>
          </div>
        )}
        {!game.won && !complete && <p className="meta mg-hint-line">Check unlocks once each grid has one ● in every row and column.</p>}
        {!game.won && (
          <label className="mg-switch">
            <input type="checkbox" checked={autoCross} onChange={(e) => setState((s) => ({ ...s, autoCross: e.target.checked }))} />
            <span className="mg-switch__track" aria-hidden="true"><span /></span>
            <span>Auto-cross the row and column when you place ●</span>
          </label>
        )}
      </section>

      <section className="mg-clues" aria-labelledby="mg-clues-title">
        <h3 id="mg-clues-title" className="mg-clues__title">Clues <span className="meta">tap to strike through</span></h3>
        <ol className="mg-clue-list">
          {game.puzzle.clues.map((clue, k) => {
            const struck = game.struck.includes(k);
            return (
              <li key={k}>
                <button type="button" className={`mg-clue${struck ? ' is-struck' : ''}`} aria-pressed={struck} onClick={() => toggleClue(k)}>
                  <span className="mg-clue__n">{k + 1}</span>
                  <span className="mg-clue__text">{clueText(theme, clue)}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <Confirm
        open={confirm !== null}
        title={confirm === 'new' ? 'Start a new puzzle?' : 'Clear the grid?'}
        message={confirm === 'new' ? 'Your marks on this case will be lost.' : 'Every ✕ and ● is removed. The clues stay the same.'}
        confirmLabel={confirm === 'new' ? 'New puzzle' : 'Clear'}
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const which = confirm;
          setConfirm(null);
          setNote(null);
          if (which === 'new') setState((s) => ({ ...s, game: null }));
          else update((g) => pushMarks(g, emptyMarks()));
        }}
      />
    </GameScreen>
  );
}
