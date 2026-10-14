import { createElement } from 'react';
import type { DailyModule } from '../../../daily/types';
import { answerFor } from './logic';
import Wordcraft, { WordcraftReveal, WordcraftRules, type WordcraftPuzzle, type WordcraftState } from './Wordcraft';

const wordcraft: DailyModule<WordcraftPuzzle, WordcraftState> = {
  getPuzzle: (date) => ({ answer: answerFor(date) }),
  Component: Wordcraft,
  rules: createElement(WordcraftRules),
  Reveal: WordcraftReveal,
};

export default wordcraft;
