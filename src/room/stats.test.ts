import { applyResult, emptyRoomStats, loadRoomStats, recordRoomResult } from './stats';

describe('room stats', () => {
  it('counts friend games without picking a side', () => {
    const [s] = applyResult(emptyRoomStats(), { outcome: 'complete', opponent: 'friend' }, 1);
    expect(s).toMatchObject({ played: 1, vsFriend: 1, completed: 0, lastPlayed: 1 });
  });

  it('tallies games against the computer by difficulty', () => {
    let s = emptyRoomStats();
    [s] = applyResult(s, { outcome: 'win', opponent: 'hard' });
    [s] = applyResult(s, { outcome: 'loss', opponent: 'hard' });
    [s] = applyResult(s, { outcome: 'draw', opponent: 'easy' });
    expect(s.vsComputer.hard).toEqual({ played: 2, wins: 1, losses: 1, draws: 0 });
    expect(s.vsComputer.easy).toEqual({ played: 1, wins: 0, losses: 0, draws: 1 });
    expect(s.played).toBe(3);
  });

  it('keeps personal bests per variant in the right direction', () => {
    let s = emptyRoomStats();
    let best: boolean;
    [s, best] = applyResult(s, { outcome: 'win', score: { variant: 'easy', value: 300, better: 'lower', label: '5:00' } });
    expect(best).toBe(true);
    [s, best] = applyResult(s, { outcome: 'win', score: { variant: 'easy', value: 320, better: 'lower', label: '5:20' } });
    expect(best).toBe(false);
    [s, best] = applyResult(s, { outcome: 'win', score: { variant: 'easy', value: 250, better: 'lower', label: '4:10' } });
    expect(best).toBe(true);
    expect(s.best.easy.label).toBe('4:10');
    expect(s.completed).toBe(3);
  });

  it('persists through storage', () => {
    recordRoomResult('sudoku', { outcome: 'win' });
    expect(loadRoomStats('sudoku').completed).toBe(1);
  });
});
