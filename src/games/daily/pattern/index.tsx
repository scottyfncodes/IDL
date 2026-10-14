import type { DailyModule } from '../../../daily/types';
import { generatePuzzle, type Puzzle, type State } from './logic';
import Pattern, { PatternReveal } from './Pattern';

const pattern: DailyModule<Puzzle, State> = {
  getPuzzle: generatePuzzle,
  Component: Pattern,
  Reveal: PatternReveal,
  rules: (
    <>
      <p>Three sequences a day, from easy to hard. Work out the rule and choose what comes next.</p>
      <ul>
        <li>Some sequences are numbers; one is drawn as pictures, like a turning clock hand or a growing group of dots.</li>
        <li>Pick one of the four options, then tap <strong>Check</strong>. You get <strong>one try</strong> per sequence.</li>
        <li>After each answer you'll see the rule. Each sequence is checked so that every sensible rule fitting the terms shown agrees on what comes next.</li>
      </ul>
    </>
  ),
};

export default pattern;
