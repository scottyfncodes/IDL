// TEMPORARY STUB — replaced by the real game.
import type { DailyModule } from '../../../daily/types';
const mod: DailyModule<{ date: string }, { n: number }> = {
  getPuzzle: (date) => ({ date }),
  Component: ({ save, record }) => (
    <button type="button" className="btn btn--primary" onClick={() => save({ status: 'won', state: { n: (record?.state.n ?? 0) + 1 }, result: { score: 'Solved', grid: ['🟩🟩'] } })}>Win stub</button>
  ),
  rules: <p>Stub rules</p>,
};
export default mod;
