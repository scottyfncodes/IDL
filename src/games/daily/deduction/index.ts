import { createElement } from 'react';
import type { DailyModule } from '../../../daily/types';
import { generatePuzzle, type Puzzle, type State } from './logic';
import Deduction, { DeductionReveal } from './Deduction';
import { DeductionRules } from './Rules';

const mod: DailyModule<Puzzle, State> = {
  getPuzzle: (date) => generatePuzzle(date),
  Component: Deduction,
  rules: createElement(DeductionRules),
  Reveal: DeductionReveal,
};

export default mod;
