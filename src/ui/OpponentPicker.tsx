import type { Opponent } from '../room/stats';
import { Segmented } from './Segmented';

const OPTIONS: { value: Opponent; label: string }[] = [
  { value: 'friend', label: 'A friend' },
  { value: 'easy', label: 'idl · easy' },
  { value: 'hard', label: 'idl · hard' },
];

/**
 * Who you're playing against. "idl" is the built-in computer opponent; it
 * runs entirely on the device.
 */
export function OpponentPicker({ value, onChange }: { value: Opponent; onChange: (o: Opponent) => void }) {
  return <Segmented<Opponent> label="Opponent" options={OPTIONS} value={value} onChange={onChange} />;
}
