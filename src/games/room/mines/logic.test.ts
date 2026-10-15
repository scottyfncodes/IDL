import {
  FLAGGED,
  HIDDEN,
  REVEALED,
  SIZES,
  SIZE_IDS,
  adjacentCounts,
  chord,
  formatTime,
  generateMines,
  isValidField,
  minesLeft,
  neighbours,
  newField,
  placeMines,
  reveal,
  solve,
  toggleFlag,
  type CellState,
  type Field,
} from './logic';
import { createRng } from '../../../lib/rng';

/** Build a field from a picture: '*' mine, anything else safe. */
function fieldFrom(rows: string[], cells?: string[]): Field {
  const cols = rows[0].length;
  const mines: number[] = [];
  rows.join('').split('').forEach((ch, i) => ch === '*' && mines.push(i));
  const st: CellState[] = cells
    ? cells.join('').split('').map((ch) => (ch === 'r' ? REVEALED : ch === 'f' ? FLAGGED : HIDDEN))
    : Array(cols * rows.length).fill(HIDDEN);
  return { cols, rows: rows.length, mineCount: mines.length, mines, cells: st, status: 'playing', exploded: null };
}

describe('mines: geometry', () => {
  it('lists neighbours at corners, edges and the middle', () => {
    expect(neighbours(3, 3, 0).sort()).toEqual([1, 3, 4]);
    expect(neighbours(3, 3, 4)).toHaveLength(8);
    expect(neighbours(3, 3, 7).sort()).toEqual([3, 4, 5, 6, 8]);
  });
  it('counts adjacent mines', () => {
    expect(adjacentCounts(3, 3, [0, 8])).toEqual([0, 1, 0, 1, 2, 1, 0, 1, 0]);
  });
  it('fits a 375px phone: at most 10 columns', () => {
    for (const id of SIZE_IDS) expect(SIZES[id].cols).toBeLessThanOrEqual(10);
  });
});

describe('mines: generation', () => {
  it('places exactly the right number of distinct mines, never near the first tap', () => {
    for (const id of SIZE_IDS) {
      const { cols, rows, mines } = SIZES[id];
      for (let s = 0; s < 30; s++) {
        const safe = (s * 37) % (cols * rows);
        const m = placeMines(cols, rows, mines, safe, createRng(s));
        expect(m).toHaveLength(mines);
        expect(new Set(m).size).toBe(mines);
        expect(m).not.toContain(safe);
        for (const j of neighbours(cols, rows, safe)) expect(m).not.toContain(j);
      }
    }
  });

  it('is deterministic for a seed', () => {
    const a = generateMines(10, 12, 20, 55, 1234, true);
    const b = generateMines(10, 12, 20, 55, 1234, true);
    expect(a).toEqual(b);
  });

  it('first reveal is safe and opens a region', () => {
    for (const id of SIZE_IDS) {
      for (let s = 0; s < 20; s++) {
        const f0 = newField(id);
        const safe = (s * 13) % f0.cells.length;
        const g = generateMines(f0.cols, f0.rows, f0.mineCount, safe, s, false);
        const f = reveal(f0, safe, g.mines);
        expect(f.status === 'playing' || f.status === 'won').toBe(true);
        expect(adjacentCounts(f.cols, f.rows, f.mines)[safe]).toBe(0);
        expect(f.cells.filter((c) => c === REVEALED).length).toBeGreaterThan(1);
      }
    }
  });

  it('no-guess boards are solvable from the first tap, and generation is quick', () => {
    let found = 0;
    for (const id of SIZE_IDS) {
      const { cols, rows, mines } = SIZES[id];
      for (let s = 0; s < 12; s++) {
        const safe = Math.floor((cols * rows) / 2) + (s % 3);
        const t = performance.now();
        const g = generateMines(cols, rows, mines, safe, 900 + s, true);
        const ms = performance.now() - t;
        expect(ms).toBeLessThan(600); // generous for slow CI; typical is a few ms
        if (g.noGuess) {
          found++;
          expect(solve(cols, rows, g.mines, safe).solved).toBe(true);
        }
        expect(g.mines).toHaveLength(mines);
      }
    }
    expect(found).toBe(36);
  });

  it('falls back to an ordinary board when the budget runs out', () => {
    // 1 attempt on a dense board: very unlikely to be solvable.
    const g = generateMines(8, 8, 40, 0, 7, true, 1);
    expect(g.attempts).toBe(1);
    expect(g.mines).toHaveLength(40);
    expect(g.noGuess).toBe(solve(8, 8, g.mines, 0).solved);
  });
});

describe('mines: solver', () => {
  it('solves a board that needs no guessing', () => {
    const rows = ['.....', '.....', '..*..', '.....', '.....'];
    const f = fieldFrom(rows);
    expect(solve(f.cols, f.rows, f.mines, 0).solved).toBe(true);
  });

  it('solves a board with mines on the far edge', () => {
    // Bottom row hidden; middle row of numbers 1 2 1 above it decides mines.
    const rows = ['.....', '.....', '.....', '*...*'];
    expect(solve(5, 4, fieldFrom(rows).mines, 0).solved).toBe(true);
  });

  it('needs the subset rule where single-cell rules stall', () => {
    // ...**  /  *....  /  .....  /  *....  — opened from row 4, column 3.
    const m = [3, 4, 5, 15];
    expect(solve(5, 4, m, 17, { subset: false, global: false }).solved).toBe(false);
    expect(solve(5, 4, m, 17, { global: false }).solved).toBe(true);
  });

  it('refuses a 50/50', () => {
    // After the opening, two cells share one mine with no way to tell them apart.
    const rows = ['...*', '....'];
    const f = fieldFrom(rows);
    const r = solve(f.cols, f.rows, f.mines, 0);
    expect(r.solved).toBe(false);
    expect(r.revealed).toBe(6);
  });

  it('refuses when the start is a mine', () => {
    expect(solve(3, 3, [0], 0).solved).toBe(false);
  });
});

describe('mines: play', () => {
  it('flood-fills zero regions and stops at numbers', () => {
    const f = fieldFrom(['....', '....', '...*']);
    const r = reveal(f, 0);
    // Everything except the mine and its numbered neighbours... all safe cells are reachable here.
    expect(r.cells.filter((c) => c === REVEALED)).toHaveLength(11);
    expect(r.status).toBe('won');
    const g = fieldFrom(['.*..', '....', '....']);
    const r2 = reveal(g, 11);
    expect(r2.cells[0]).toBe(HIDDEN); // walled off behind the numbers around the mine
    expect(r2.cells[11]).toBe(REVEALED);
    expect(r2.status).toBe('playing');
  });

  it('first reveal requires a layout and starts play', () => {
    const f = newField('small');
    expect(() => reveal(f, 0)).toThrow();
    const g = generateMines(8, 8, 10, 0, 1, false);
    expect(reveal(f, 0, g.mines).status).not.toBe('ready');
  });

  it('loses on a mine and records which one', () => {
    const f = fieldFrom(['*..', '...', '...']);
    const r = reveal(f, 0);
    expect(r.status).toBe('lost');
    expect(r.exploded).toBe(0);
    // No moves after the end.
    expect(reveal(r, 8)).toBe(r);
    expect(toggleFlag(r, 8)).toBe(r);
  });

  it('wins when every safe cell is revealed, flagging the mines', () => {
    const f = fieldFrom(['*..', '...', '...']);
    const r = reveal(reveal(reveal(f, 8), 1), 3);
    expect(r.status).toBe('won');
    expect(r.cells[0]).toBe(FLAGGED);
  });

  it('flags toggle only on hidden cells and count down mines left', () => {
    const f = fieldFrom(['*..', '...', '...']);
    const a = toggleFlag(f, 0);
    expect(a.cells[0]).toBe(FLAGGED);
    expect(minesLeft(a)).toBe(0);
    expect(toggleFlag(a, 0).cells[0]).toBe(HIDDEN);
    const b = reveal(f, 4);
    expect(toggleFlag(b, 4)).toBe(b);
  });

  it('flagged cells are not revealed', () => {
    const f = toggleFlag(fieldFrom(['*..', '...', '...']), 0);
    expect(reveal(f, 0)).toBe(f);
  });

  it('chords when flags match the number', () => {
    // Revealed 1 at centre, mine flagged at 0: chording opens the rest.
    let f = fieldFrom(['*..', '...', '...'], ['...', '.r.', '...']);
    f = toggleFlag(f, 0);
    const r = chord(f, 4);
    expect(r.status).toBe('won');
  });

  it('does not chord when flags do not match', () => {
    const f = fieldFrom(['*..', '...', '...'], ['...', '.r.', '...']);
    expect(chord(f, 4)).toBe(f);
  });

  it('chording with a wrong flag reveals a mine and loses', () => {
    let f = fieldFrom(['*..', '...', '...'], ['...', '.r.', '...']);
    f = toggleFlag(f, 2); // wrong cell
    const r = chord(f, 4);
    expect(r.status).toBe('lost');
    expect(r.exploded).toBe(0);
    expect(r.cells[2]).toBe(FLAGGED);
  });

  it('chording flood-fills through zeros', () => {
    let f = fieldFrom(['*....', '.....', '.....'], ['.....', 'r....', '.....']);
    f = toggleFlag(f, 0);
    const r = chord(f, 5);
    expect(r.status).toBe('won');
  });
});

describe('mines: misc', () => {
  it('formats time', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(102_400)).toBe('1:42');
    expect(formatTime(3_725_000)).toBe('1:02:05');
  });
  it('validates stored fields', () => {
    expect(isValidField(newField('medium'))).toBe(true);
    expect(isValidField({ cols: 2, rows: 2, cells: [], mines: [], status: 'ready' })).toBe(false);
    expect(isValidField(null)).toBe(false);
  });
});
