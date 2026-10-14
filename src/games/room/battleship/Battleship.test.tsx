import { act, fireEvent, render, screen } from '@testing-library/react';
import Battleship from './Battleship';
import { load } from '../../../lib/storage';
import type { Game } from './logic';

const click = (name: RegExp | string) => fireEvent.click(screen.getByRole('button', { name }));
const noSecrets = (container: HTMLElement) => {
  expect(container.querySelector('.bs-hull')).toBeNull();
  expect(container.querySelector('.bs-board')).toBeNull();
  expect(container.querySelector('.bs-dock')).toBeNull();
};

function setUpBothFleets(container: HTMLElement) {
  click(/I'm Player 1 — place my fleet/);
  expect((screen.getByRole('button', { name: 'Ready' }) as HTMLButtonElement).disabled).toBe(true);
  click(/Random fleet/);
  expect(container.querySelectorAll('.bs-hull')).toHaveLength(5);
  click('Ready');
  expect(screen.getByText('Pass the phone to Player 2')).toBeTruthy();
  noSecrets(container);
  click(/I'm Player 2 — place my fleet/);
  expect(container.querySelectorAll('.bs-hull')).toHaveLength(0); // P2 starts with an empty board
  click(/Random fleet/);
  click('Ready');
  expect(screen.getByText('Pass the phone to Player 1')).toBeTruthy();
  noSecrets(container);
}

describe('Battleship screen', () => {
  it('walks setup → handoff → attack without rendering secrets on handoff screens', () => {
    const { container } = render(<Battleship />);
    expect(screen.getByText('Player 1 hides their fleet first')).toBeTruthy();
    noSecrets(container);
    setUpBothFleets(container);

    click(/I'm Player 1 — show my board/);
    // Own fleet only (5 hulls on the small board); the target board has none.
    expect(container.querySelectorAll('.bs-hull')).toHaveLength(5);
    const target = screen.getByRole('grid');
    expect(target.querySelectorAll('.bs-hull')).toHaveLength(0);

    fireEvent.click(screen.getByRole('gridcell', { name: /^A1:/ }));
    expect(screen.getByRole('button', { name: /pass to Player 2/ })).toBeTruthy();
    // One shot per turn: the whole target board is locked.
    expect(screen.getAllByRole('gridcell').every((c) => (c as HTMLButtonElement).disabled)).toBe(true);
    const g = load<{ game: Game } | null>('room:battleship', null, 1)!.game;
    expect(g.shots[0]).toHaveLength(1);
    expect(g.turn).toBe(1);

    click(/pass to Player 2/);
    expect(screen.getByText('Pass the phone to Player 2')).toBeTruthy();
    noSecrets(container);
  });

  it('resumes on a handoff screen after a reload mid-turn', () => {
    const first = render(<Battleship />);
    setUpBothFleets(first.container);
    click(/I'm Player 1 — show my board/);
    expect(screen.getByRole('grid')).toBeTruthy();
    first.unmount();

    const { container } = render(<Battleship />);
    expect(screen.getByText('Pass the phone to Player 1')).toBeTruthy();
    noSecrets(container);
  });

  it('resumes setup behind a handoff too', () => {
    const first = render(<Battleship />);
    click(/I'm Player 1 — place my fleet/);
    click(/Random fleet/);
    first.unmount();
    const { container } = render(<Battleship />);
    noSecrets(container);
    click(/I'm Player 1 — place my fleet/);
    expect(container.querySelectorAll('.bs-hull')).toHaveLength(5); // draft fleet kept
  });

  it('places, rejects an out-of-bounds spot, and picks a boat back up', () => {
    const { container } = render(<Battleship />);
    click(/I'm Player 1 — place my fleet/);
    // Schooner (4) is selected, across: G1 doesn't fit.
    act(() => {
      fireEvent.click(screen.getByRole('gridcell', { name: /^G1:/ }));
    });
    expect(screen.getByText(/doesn't fit there/)).toBeTruthy();
    expect(container.querySelectorAll('.bs-hull')).toHaveLength(0);
    expect(container.querySelectorAll('.bs-cell.is-invalid').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('gridcell', { name: /^A1:/ }));
    expect(container.querySelectorAll('.bs-hull')).toHaveLength(1);
    // Ferry is auto-selected next; overlapping the schooner picks the schooner up instead.
    fireEvent.click(screen.getByRole('gridcell', { name: /^B1: Schooner/ }));
    expect(container.querySelectorAll('.bs-hull')).toHaveLength(0);
    expect(screen.getByText(/Picked up the Schooner/)).toBeTruthy();

    // Rotate and place down; an overlap is rejected.
    click(/Rotate/);
    fireEvent.click(screen.getByRole('gridcell', { name: /^A1:/ })); // schooner down A1–A4
    fireEvent.click(screen.getByRole('gridcell', { name: /^A5:/ })); // ferry down A5–A7
    expect(container.querySelectorAll('.bs-hull')).toHaveLength(2);
  });
});
