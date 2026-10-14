import { act, fireEvent, render, screen } from '@testing-library/react';
import MemoryMatch from './MemoryMatch';
import { load, save } from '../../../lib/storage';
import { newMatch, type MatchState } from './logic';
import { motifName } from './content';

const KEY = 'room:memory-match';
const seedState = (match: MatchState) => save(KEY, { match, elapsedMs: 0, best: {}, newBest: false }, 1);
const card = (n: number) => screen.getByRole('button', { name: new RegExp(`^Card ${n},`) });
const stored = () => load<{ match: MatchState; best: Record<string, unknown> } | null>(KEY, null, 1)!;

afterEach(() => vi.useRealTimers());

describe('Memory Match screen', () => {
  it('labels cards without leaking face-down motifs, and flips mismatches back', () => {
    vi.useFakeTimers();
    const m = newMatch('solo', '4x4', 1234);
    seedState(m);
    const { container } = render(<MemoryMatch />);
    expect(container.querySelectorAll('.mm-motif')).toHaveLength(0);
    expect(card(1).getAttribute('aria-label')).toBe('Card 1, face down');

    const j = m.deck.findIndex((x) => x !== m.deck[0]);
    fireEvent.click(card(1));
    expect(card(1).getAttribute('aria-label')).toBe(`Card 1, ${motifName(m.deck[0])}`);
    fireEvent.click(card(j + 1));
    expect(container.querySelectorAll('.mm-motif')).toHaveLength(2);
    expect(screen.getByText('Not a pair.')).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(900);
    });
    expect(container.querySelectorAll('.mm-motif')).toHaveLength(0);
    expect(stored().match.moves).toBe(1);
  });

  it('finishes a solo game, records a best and offers another round', () => {
    const m = newMatch('solo', '4x4', 77);
    seedState(m);
    render(<MemoryMatch />);
    const done = new Set<number>();
    for (let i = 0; i < m.deck.length; i++) {
      if (done.has(i)) continue;
      const p = m.deck.findIndex((x, k) => k !== i && x === m.deck[i]);
      done.add(i).add(p);
      fireEvent.click(card(i + 1));
      fireEvent.click(card(p + 1));
    }
    expect(screen.getByText('New best')).toBeTruthy();
    expect(card(1).getAttribute('aria-label')).toMatch(/, matched$/);
    expect(stored().best['4x4']).toMatchObject({ moves: 8 });
    // No moves after the end.
    fireEvent.click(card(1));
    expect(stored().match.moves).toBe(8);
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }));
    expect(stored().match.moves).toBe(0);
    expect(stored().best['4x4']).toMatchObject({ moves: 8 });
  });

  it('two players: a pair keeps the turn and is credited to the finder', () => {
    const m = newMatch('duo', '4x4', 5);
    seedState(m);
    render(<MemoryMatch />);
    const p = m.deck.findIndex((x, k) => k !== 0 && x === m.deck[0]);
    fireEvent.click(card(1));
    fireEvent.click(card(p + 1));
    expect(screen.getByText('A pair! Player 1 goes again.')).toBeTruthy();
    expect(card(1).getAttribute('aria-label')).toMatch(/matched by Player 1$/);
    expect(stored().match.scores).toEqual([1, 0]);
  });

  it('asks before switching size mid-game', () => {
    const m = newMatch('solo', '4x4', 5);
    seedState(m);
    render(<MemoryMatch />);
    fireEvent.click(card(1));
    fireEvent.click(screen.getByRole('radio', { name: '4 × 6' }));
    // Board unchanged until confirmed.
    expect(screen.getAllByRole('button', { name: /^Card \d+,/ })).toHaveLength(16);
  });
});
