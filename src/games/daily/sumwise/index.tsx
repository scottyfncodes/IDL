import type { DailyModule } from '../../../daily/types';
import { generatePuzzle, type Puzzle, type State } from './logic';
import Sumwise, { SumwiseReveal } from './Sumwise';

const sumwise: DailyModule<Puzzle, State> = {
  getPuzzle: generatePuzzle,
  Component: Sumwise,
  Reveal: SumwiseReveal,
  rules: (
    <>
      <p>Build a sum from the number tiles that lands exactly on the target. There are three targets a day: Warm-up, Steady and Stretch.</p>
      <ul>
        <li>Use <strong>+ − × ÷</strong> and brackets. Tap tiles and signs to build your sum; backspace gives a tile back.</li>
        <li>Each tile can be used <strong>once</strong>. You don't need to use them all.</li>
        <li>× and ÷ happen before + and −; otherwise left to right. Brackets go first.</li>
        <li>Fractions along the way are fine, as long as the final answer is exactly the target. No dividing by zero.</li>
        <li>Stuck? Skip a target. It counts as a miss, and a solution appears once the day's set is done.</li>
      </ul>
    </>
  ),
};

export default sumwise;
