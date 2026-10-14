/** Card motifs. Each is a distinct silhouette, so pairs never rely on colour alone. Drawings live in Motif.tsx. */
export type MotifId =
  | 'leaf'
  | 'moon'
  | 'wave'
  | 'mountain'
  | 'kite'
  | 'shell'
  | 'star'
  | 'acorn'
  | 'sun'
  | 'fish'
  | 'mushroom'
  | 'pine';

export type MotifTone = 'clay' | 'moss' | 'ochre' | 'tide' | 'plum' | 'ink';

export interface MotifSpec {
  id: MotifId;
  /** Spoken in card labels once the card is face up. */
  name: string;
  tone: MotifTone;
}

export const MOTIFS: readonly MotifSpec[] = [
  { id: 'leaf', name: 'leaf', tone: 'moss' },
  { id: 'moon', name: 'moon', tone: 'ochre' },
  { id: 'wave', name: 'wave', tone: 'tide' },
  { id: 'mountain', name: 'mountain', tone: 'ink' },
  { id: 'kite', name: 'kite', tone: 'clay' },
  { id: 'shell', name: 'shell', tone: 'plum' },
  { id: 'star', name: 'star', tone: 'ochre' },
  { id: 'acorn', name: 'acorn', tone: 'clay' },
  { id: 'sun', name: 'sun', tone: 'clay' },
  { id: 'fish', name: 'fish', tone: 'tide' },
  { id: 'mushroom', name: 'mushroom', tone: 'plum' },
  { id: 'pine', name: 'pine tree', tone: 'moss' },
];

export const motifName = (id: MotifId) => MOTIFS.find((m) => m.id === id)?.name ?? id;
export const motifTone = (id: MotifId) => MOTIFS.find((m) => m.id === id)?.tone ?? 'ink';
