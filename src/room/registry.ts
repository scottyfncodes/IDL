import type { ComponentType } from 'react';
import type { Accent } from '../daily/registry';

export type RoomGameId = 'dots-boxes' | 'connect-four' | 'battleship' | 'sudoku' | 'mystery-grid' | 'tic-tac-toe' | 'memory-match';
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
  { id: 'dots-boxes', name: 'Dots & Boxes', blurb: 'Draw lines, close boxes, steal the board.', players: '2', minutes: [5, 15], accent: 'clay', collections: ['road-trip', 'no-wifi'], load: () => import('../games/room/dots-boxes') },
  { id: 'connect-four', name: 'Connect Four', blurb: 'Drop discs. Line up four before they do.', players: '2', minutes: [3, 8], accent: 'tide', collections: ['five-minute', 'road-trip', 'no-wifi'], load: () => import('../games/room/connect-four') },
  { id: 'battleship', name: 'Mini Battleship', blurb: 'Hide your fleet, pass the phone, hunt theirs.', players: '2', minutes: [10, 20], accent: 'tide', collections: ['road-trip', 'no-wifi'], load: () => import('../games/room/battleship') },
  { id: 'sudoku', name: 'Pocket Sudoku', blurb: 'Classic nine-by-nine, every grid uniquely solvable.', players: '1', minutes: [6, 30], accent: 'moss', collections: ['brain-workout', 'no-wifi'], load: () => import('../games/room/sudoku') },
  { id: 'mystery-grid', name: 'Mystery Grid', blurb: 'Untangle who did what with a logic grid.', players: '1', minutes: [5, 12], accent: 'plum', collections: ['brain-workout', 'five-minute', 'no-wifi'], load: () => import('../games/room/mystery-grid') },
  { id: 'tic-tac-toe', name: 'Tic-Tac-Toe', blurb: 'Three in a row. Over in a minute.', players: '2', minutes: [1, 2], accent: 'clay', collections: ['five-minute', 'road-trip', 'no-wifi'], load: () => import('../games/room/tic-tac-toe') },
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
