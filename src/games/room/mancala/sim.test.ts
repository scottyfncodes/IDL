import { createRng } from '../../../lib/rng';
import { chooseMove, newGame, sow, isOver, legalMoves, winnerOf, HARD_DEPTH } from './logic';
test('sim', () => {
  const times: number[] = [];
  for (const strat of ['right', 'left', 'easy', 'right2']) {
    let w = 0, l = 0, d = 0;
    for (let s = 0; s < 20; s++) {
      let g = newGame(); const rng = createRng(s); const r2 = createRng(s + 99);
      while (!isOver(g)) {
        const lm = legalMoves(g);
        let m: number;
        if (g.turn === 2) { const t = performance.now(); m = chooseMove(g, 'hard', rng)!; times.push(performance.now() - t); }
        else m = strat === 'right' ? lm[lm.length - 1] : strat === 'left' ? lm[0] : strat === 'right2' ? (r2.chance(0.7) ? lm[lm.length - 1] : r2.pick(lm)) : chooseMove(g, 'easy', rng)!;
        g = sow(g, m)!.state;
      }
      const x = winnerOf(g); if (x === 2) w++; else if (x === 1) l++; else d++;
    }
    console.log(HARD_DEPTH, strat, 'hard wins', w, 'losses', l, 'draws', d);
  }
  times.sort((a, b) => a - b);
  console.log('median', times[times.length >> 1].toFixed(1), 'p90', times[Math.floor(times.length * 0.9)].toFixed(1), 'max', times[times.length - 1].toFixed(1));
});
