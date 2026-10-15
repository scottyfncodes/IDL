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
export type CollectionId = 'five-minute' | 'road-trip' | 'brain-workout' | 'no-wifi';

export interface RoomGameMeta {
  id: RoomGameId;
  name: string;
  blurb: string;
  players: '1' | '2' | '1–2';
  /** Typical length, minutes [min, max]. */
  minutes: [number, number];
  accent: Accent;
  collections: CollectionId[];
  load: () => Promise<{ default: ComponentType }>;
}

export const ROOM_GAMES: RoomGameMeta[] = [
  { id: 'dots-boxes', name: 'Dots & Boxes', blurb: 'Draw lines, close boxes, steal the board.', players: '1–2', minutes: [5, 15], accent: 'clay', collections: ['road-trip', 'no-wifi'], load: () => import('../games/room/dots-boxes') },
  { id: 'connect-four', name: 'Connect Four', blurb: 'Drop discs. Line up four before they do.', players: '1–2', minutes: [3, 8], accent: 'tide', collections: ['five-minute', 'road-trip', 'no-wifi'], load: () => import('../games/room/connect-four') },
  { id: 'battleship', name: 'Mini Battleship', blurb: 'Hide your fleet, pass the phone, hunt theirs.', players: '2', minutes: [10, 20], accent: 'tide', collections: ['road-trip', 'no-wifi'], load: () => import('../games/room/battleship') },
  { id: 'sudoku', name: 'Pocket Sudoku', blurb: 'Classic nine-by-nine, every grid uniquely solvable.', players: '1', minutes: [6, 30], accent: 'moss', collections: ['brain-workout', 'no-wifi'], load: () => import('../games/room/sudoku') },
  { id: 'mystery-grid', name: 'Mystery Grid', blurb: 'Untangle who did what with a logic grid.', players: '1', minutes: [5, 12], accent: 'plum', collections: ['brain-workout', 'five-minute', 'no-wifi'], load: () => import('../games/room/mystery-grid') },
  { id: 'tic-tac-toe', name: 'Tic-Tac-Toe', blurb: 'Three in a row. Over in a minute.', players: '1–2', minutes: [1, 2], accent: 'clay', collections: ['five-minute', 'road-trip', 'no-wifi'], load: () => import('../games/room/tic-tac-toe') },
  { id: 'reversi', name: 'Reversi', blurb: 'Outflank and flip. The board turns in a single move.', players: '1–2', minutes: [8, 15], accent: 'moss', collections: ['road-trip', 'brain-workout', 'no-wifi'], load: () => import('../games/room/reversi') },
  { id: 'mancala', name: 'Mancala', blurb: 'Sow seeds around the board and capture the most.', players: '1–2', minutes: [5, 12], accent: 'ochre', collections: ['road-trip', 'brain-workout', 'no-wifi'], load: () => import('../games/room/mancala') },
  { id: 'mines', name: 'Mines', blurb: 'Clear the field using the numbers. Mind the mines.', players: '1', minutes: [2, 10], accent: 'clay', collections: ['five-minute', 'brain-workout', 'no-wifi'], load: () => import('../games/room/mines') },
  { id: 'picture-logic', name: 'Picture Logic', blurb: 'Fill the grid from the clues to reveal a picture.', players: '1', minutes: [4, 15], accent: 'plum', collections: ['brain-workout', 'no-wifi'], load: () => import('../games/room/picture-logic') },
  { id: 'patience', name: 'Patience', blurb: 'The classic seven-column solitaire, built for one thumb.', players: '1', minutes: [5, 15], accent: 'tide', collections: ['five-minute', 'brain-workout', 'no-wifi'], load: () => import('../games/room/patience') },
  { id: 'memory-match', name: 'Memory Match', blurb: 'Flip cards, find pairs, alone or taking turns.', players: '1–2', minutes: [2, 6], accent: 'ochre', collections: ['five-minute', 'road-trip', 'no-wifi'], load: () => import('../games/room/memory-match') },
];

export interface Collection {
  id: CollectionId;
  name: string;
  line: string;
}

export const COLLECTIONS: Collection[] = [
  { id: 'five-minute', name: 'The 5-Minute Wait', line: 'Quick games for queues and kettles.' },
  { id: 'road-trip', name: 'Two-Player Road Trip', line: 'One phone, two players, many miles.' },
  { id: 'brain-workout', name: 'Quiet Brain Workout', line: 'Solo logic for a calm stretch.' },
  { id: 'no-wifi', name: 'No Wi-Fi Needed', line: 'Everything here. Planes welcome.' },
];

export const roomMeta = (id: string) => ROOM_GAMES.find((g) => g.id === id);
