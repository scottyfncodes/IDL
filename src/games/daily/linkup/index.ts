import { createElement } from 'react';
import type { DailyModule } from '../../../daily/types';
import { POOL } from './content';
import { puzzleFor, type LinkupPuzzle, type LinkupState } from './logic';
import Linkup, { LinkupRules } from './Linkup';

const linkup: DailyModule<LinkupPuzzle, LinkupState> = {
  getPuzzle: (date) => puzzleFor(POOL, date),
  Component: Linkup,
  rules: createElement(LinkupRules),
};

export default linkup;
