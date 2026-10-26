import type { DailyModule } from '../../../daily/types';
import { remove } from '../../../lib/storage';
import { getPuzzle, type Puzzle } from './logic';
import Couplet, { INTRO_KEY, type State } from './Couplet';

function Rules() {
  return (
    <>
      <p>Place every domino on the board so that each shaded region keeps its rule. There are three boards a day: Easy, Medium and Hard.</p>
      <ul>
        <li><strong>8</strong>: the region adds up to 8. <strong>&lt;3</strong> and <strong>&gt;9</strong>: less than or more than.</li>
        <li><strong>=</strong>: every number in the region is the same. <strong>≠</strong>: every number is different.</li>
        <li>Plain squares have no rule. A domino can cross from one region into another; each half counts where it lands.</li>
        <li><strong>Drag</strong> a domino onto the board, or tap it and then tap a square. Tap a domino in the tray again to turn it first.</li>
        <li><strong>Tap</strong> a placed domino to turn it around the half you tapped. Drag it off the board to take it back.</li>
        <li>Every board has exactly one answer, and you can always reason your way to it. A hint places one domino for you, and the day’s result counts hints.</li>
      </ul>
      <p>
        <button type="button" className="text-link" onClick={() => remove(INTRO_KEY)}>
          Replay the walkthrough
        </button>
      </p>
    </>
  );
}

const couplet: DailyModule<Puzzle, State> = {
  getPuzzle,
  Component: Couplet,
  rules: <Rules />,
};

export default couplet;
