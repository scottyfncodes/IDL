import { act, fireEvent, render, screen } from '@testing-library/react';
import Patience, { STORAGE_KEY, STORAGE_VERSION, type Game, type State } from './Patience';
import { load, save } from '../../../lib/storage';
import { loadRoomStats } from '../../../room/stats';
import { cardOf, dealFor, type Board, type Column } from './logic';

const S = (r: number) => cardOf(0, r);
const H = (r: number) => cardOf(1, r);
const C = (r: number) => cardOf(3, r);

function makeBoard(cols: Column[], extra: Partial<Board> = {}): Board {
  const tableau = Array.from({ length: 7 }, (_, i) => cols[i] ?? { cards: [], hidden: 0 });
  return { tableau, stock: [], waste: [], foundations: [0, 0, 0, 0], draw: 1, ...extra };
}
function seed(board: Board, g: Partial<Game> = {}, s: Partial<State> = {}) {
  const game: Game = { seed: 1, attempt: 0, verified: true, board, history: [], moves: 0, elapsed: 0, won: false, recorded: false, newBest: false, ...g };
  save(STORAGE_KEY, { draw: board.draw, winnable: true, game, ...s }, STORAGE_VERSION);
}
const stored = () => load<State | null>(STORAGE_KEY, null, STORAGE_VERSION)!;
const btn = (name: string | RegExp) => screen.getByRole('button', { name });

afterEach(() => vi.useRealTimers());

describe('Patience screen', () => {
  it('deals a fresh game on first visit', () => {
    vi.useFakeTimers();
    render(<Patience />);
    expect(screen.getByText('Shuffling…')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(100);
    });
    const g = stored().game!;
    expect(g.board.tableau.map((c) => c.cards.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(btn(/^Stock, 24 cards/)).toBeTruthy();
    // Face-down cards are never exposed as buttons or labels.
    expect(screen.getAllByRole('button', { name: /, column \d/ })).toHaveLength(7);
  });

  it('a tap sends a card to its best spot and flips the card beneath', () => {
    seed(makeBoard([{ cards: [C(9), H(1)], hidden: 1 }, { cards: [S(2)], hidden: 0 }]));
    render(<Patience />);
    fireEvent.click(btn('Ace of hearts, column 1'));
    const g = stored().game!;
    expect(g.board.foundations).toEqual([0, 1, 0, 0]);
    expect(g.board.tableau[0]).toEqual({ cards: [C(9)], hidden: 0 });
    expect(g.moves).toBe(1);
    expect(btn('Nine of clubs, column 1')).toBeTruthy();
  });

  it('a repeated tap cycles to the next destination without adding a move', () => {
    seed(makeBoard([{ cards: [H(6)], hidden: 0 }, { cards: [S(7)], hidden: 0 }, { cards: [C(7)], hidden: 0 }, { cards: [S(9)], hidden: 0 }]));
    render(<Patience />);
    fireEvent.click(btn('Six of hearts, column 1'));
    expect(stored().game!.board.tableau[1].cards).toEqual([S(7), H(6)]);
    fireEvent.click(btn('Six of hearts, column 2'));
    const g = stored().game!;
    expect(g.board.tableau[1].cards).toEqual([S(7)]);
    expect(g.board.tableau[2].cards).toEqual([C(7), H(6)]);
    expect(g.moves).toBe(1);
    expect(g.history).toHaveLength(1);
    // Undo goes straight back to the start.
    fireEvent.click(btn('Undo'));
    expect(stored().game!.board.tableau[0].cards).toEqual([H(6)]);
    expect(stored().game!.moves).toBe(0);
  });

  it('tapping a card with nowhere to go changes nothing', () => {
    seed(makeBoard([{ cards: [H(6)], hidden: 0 }, { cards: [S(9)], hidden: 0 }]));
    render(<Patience />);
    fireEvent.click(btn('Six of hearts, column 1'));
    expect(stored().game!.moves).toBe(0);
    expect(screen.getByText('No move for Six of hearts')).toBeTruthy();
  });

  it('the stock draws, recycles, and undo restores it exactly', () => {
    const b = dealFor(4, 0, 3);
    seed(b);
    render(<Patience />);
    fireEvent.click(btn(/^Stock, 24 cards. Draw 3/));
    expect(stored().game!.board.waste).toHaveLength(3);
    for (let i = 0; i < 7; i++) fireEvent.click(btn(/^Stock, /));
    expect(stored().game!.board.stock).toHaveLength(0);
    fireEvent.click(btn('Stock empty. Turn the waste over'));
    expect(stored().game!.board.stock).toEqual(b.stock);
    for (let i = 0; i < 9; i++) fireEvent.click(btn('Undo'));
    expect(stored().game!.board).toEqual(b);
    expect(stored().game!.moves).toBe(0);
  });

  it('Space picks a card up and Space on a column puts it there', () => {
    seed(makeBoard([{ cards: [H(6)], hidden: 0 }, { cards: [S(7)], hidden: 0 }, { cards: [C(7)], hidden: 0 }]));
    render(<Patience />);
    fireEvent.keyDown(btn('Six of hearts, column 1'), { key: ' ' });
    expect(btn('Six of hearts, column 1').getAttribute('aria-pressed')).toBe('true');
    fireEvent.keyDown(btn('Seven of clubs, column 3'), { key: ' ' });
    expect(stored().game!.board.tableau[2].cards).toEqual([C(7), H(6)]);
  });

  it('picking up then choosing an illegal spot leaves the board alone', () => {
    seed(makeBoard([{ cards: [H(6)], hidden: 0 }, { cards: [S(9)], hidden: 0 }]));
    render(<Patience />);
    fireEvent.keyDown(btn('Six of hearts, column 1'), { key: ' ' });
    fireEvent.click(btn('Empty column 3'));
    expect(stored().game!.moves).toBe(0);
    expect(screen.getByText('Six of hearts can’t go to column 3')).toBeTruthy();
  });

  it('records a win exactly once, with a best time per draw mode', () => {
    seed(makeBoard([{ cards: [S(13)], hidden: 0 }], { foundations: [12, 13, 13, 13] }), { elapsed: 102_000, moves: 140 });
    const { unmount } = render(<Patience />);
    fireEvent.click(btn('King of spades, column 1'));
    expect(screen.getByText('Every card home')).toBeTruthy();
    expect(screen.getByText('New best')).toBeTruthy();
    expect(screen.getAllByText('1:42').length).toBeGreaterThan(0);
    const stats = loadRoomStats('patience');
    expect(stats.played).toBe(1);
    expect(stats.completed).toBe(1);
    expect(stats.best.draw1).toMatchObject({ value: 102, label: '1:42' });
    // Coming back to the finished game never counts it again.
    unmount();
    render(<Patience />);
    expect(screen.getByText('Every card home')).toBeTruthy();
    expect(loadRoomStats('patience').played).toBe(1);
    // No moves after the end.
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('auto-finish plays everything home once nothing is face down', () => {
    vi.useFakeTimers();
    seed(makeBoard([{ cards: [S(13), H(12)], hidden: 0 }, { cards: [H(13), S(12)], hidden: 0 }], { foundations: [11, 11, 13, 13] }), { moves: 3 });
    render(<Patience />);
    fireEvent.click(btn('Auto-finish'));
    for (let i = 0; i < 20; i++) {
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }
    expect(stored().game!.won).toBe(true);
    expect(loadRoomStats('patience').played).toBe(1);
  });

  it('asks before replacing a game in progress, and records nothing for it', () => {
    vi.useFakeTimers();
    seed(dealFor(9, 0, 1), { moves: 5 });
    render(<Patience />);
    fireEvent.click(btn('New deal'));
    expect(screen.getByText('Deal again?')).toBeTruthy();
    const dialogButtons = screen.getAllByRole('button', { name: 'New deal', hidden: true });
    fireEvent.click(dialogButtons[dialogButtons.length - 1]);
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(stored().game!.moves).toBe(0);
    expect(stored().game!.seed).not.toBe(1);
    expect(loadRoomStats('patience').played).toBe(0);
  });
});
