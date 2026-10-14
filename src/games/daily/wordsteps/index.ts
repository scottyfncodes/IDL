import { createElement } from 'react';
import type { DailyModule } from '../../../daily/types';
import { generatePuzzle, type Puzzle, type State } from './logic';
import Wordsteps, { WordstepsReveal } from './Wordsteps';
import { WordstepsRules } from './Rules';

const mod: DailyModule<Puzzle, State> = {
  getPuzzle: (date) => generatePuzzle(date),
  Component: Wordsteps,
  rules: createElement(WordstepsRules),
  Reveal: WordstepsReveal,
};

export default mod;
