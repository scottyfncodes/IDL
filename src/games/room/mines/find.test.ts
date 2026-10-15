import { solve, placeMines } from './logic';
import { createRng } from '../../../lib/rng';
it('find', () => {
  for (let s = 0; s < 5000; s++) {
    const cols = 5, rows = 4;
    const m = placeMines(cols, rows, 4, 17, createRng(s));
    const full = solve(cols, rows, m, 17);
    const simple = solve(cols, rows, m, 17, { subset: false, global: false });
    const noGlobal = solve(cols, rows, m, 17, { global: false });
    if (full.solved && noGlobal.solved && !simple.solved) { console.log('FOUND', JSON.stringify(m)); break; }
  }
});
