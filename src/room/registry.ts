import type { ComponentType } from 'react';
import type { Accent } from '../daily/registry';

export type RoomGameId =
  | 'dots-boxes'
  | 'connect-four'
  | 'battleship'
  | 'sudoku'
  | 'mystery-grid'
  | 'tic-tac-toe'
  | 'memory-match'
  | 'reversi'
  | 'mancala'
  | 'mines'
  | 'picture-logic'
  | 'patience';
/**
 * Where a game sits in the room. The room is curated, not alphabetical:
 * the strongest games lead, quick fillers sit at the end.
 */
export type Shelf = 'featured' | 'more' | 'filler';

export interface RoomGameMeta {
  id: RoomGameId;
  name: string;
  blurb: string;
  players: '1' | '2' | '1–2';
  /** Typical length, minutes [min, max]. */
  minutes: [number, number];
  accent: Accent;
  shelf: Shelf;
  load: () => Promise<{ default: ComponentType }>;
}

/** In display order. */
export const ROOM_GAMES: RoomGameMeta[] = [
  { id: 'connect-four', name: 'Connect Four', blurb: 'Drop discs. Line up four before your friend, or idl, does.', players: '1–2', minutes: [3, 8], accent: 'tide', shelf: 'featured', load: () => import('../games/room/connect-four') },
  { id: 'mines', name: 'Mines', blurb: 'Clear the field from the numbers. No lucky guesses needed.', players: '1', minutes: [2, 10], accent: 'clay', shelf: 'featured', load: () => import('../games/room/mines') },
  { id: 'patience', name: 'Patience', blurb: 'Seven-column solitaire, built for one thumb. Every deal can be won.', players: '1', minutes: [5, 15], accent: 'tide', shelf: 'featured', load: () => import('../games/room/patience') },
  { id: 'sudoku', name: 'Pocket Sudoku', blurb: 'Classic nine-by-nine, every grid uniquely solvable.', players: '1', minutes: [6, 30], accent: 'moss', shelf: 'featured', load: () => import('../games/room/sudoku') },
  { id: 'picture-logic', name: 'Picture Logic', blurb: 'Fill the grid from the clues to reveal a picture.', players: '1', minutes: [4, 15], accent: 'plum', shelf: 'more', load: () => import('../games/room/picture-logic') },
  { id: 'reversi', name: 'Reversi', blurb: 'Outflank and flip. The board turns in a single move.', players: '1–2', minutes: [8, 15], accent: 'moss', shelf: 'more', load: () => import('../games/room/reversi') },
  { id: 'dots-boxes', name: 'Dots & Boxes', blurb: 'Draw lines, close boxes, steal the board.', players: '1–2', minutes: [5, 15], accent: 'clay', shelf: 'more', load: () => import('../games/room/dots-boxes') },
  { id: 'mancala', name: 'Mancala', blurb: 'Sow seeds around the board and capture the most.', players: '1–2', minutes: [5, 12], accent: 'ochre', shelf: 'more', load: () => import('../games/room/mancala') },
  { id: 'battleship', name: 'Mini Battleship', blurb: 'Hide your fleet, pass the phone, hunt theirs.', players: '2', minutes: [10, 20], accent: 'tide', shelf: 'more', load: () => import('../games/room/battleship') },
  { id: 'mystery-grid', name: 'Mystery Grid', blurb: 'Untangle who did what with a logic grid.', players: '1', minutes: [3, 6], accent: 'plum', shelf: 'more', load: () => import('../games/room/mystery-grid') },
  { id: 'tic-tac-toe', name: 'Tic-Tac-Toe', blurb: 'Three in a row. Over in a minute.', players: '1–2', minutes: [1, 2], accent: 'clay', shelf: 'filler', load: () => import('../games/room/tic-tac-toe') },
  { id: 'memory-match', name: 'Memory Match', blurb: 'Flip cards, find pairs. Best taking turns.', players: '1–2', minutes: [2, 6], accent: 'ochre', shelf: 'filler', load: () => import('../games/room/memory-match') },
];

export const roomMeta = (id: string) => ROOM_GAMES.find((g) => g.id === id);
