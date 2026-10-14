import { dailyState, datesWithProgress, loadDaily, saveDaily } from './progress';
import { buildShareText } from './shareText';

describe('daily progress', () => {
  it('saves, reloads and reports state', () => {
    expect(dailyState('linkup', '2026-10-14')).toBe('unplayed');
    saveDaily('linkup', '2026-10-14', { status: 'playing', state: { picks: [1] } });
    expect(dailyState('linkup', '2026-10-14')).toBe('playing');
    expect(loadDaily<{ picks: number[] }>('linkup', '2026-10-14')?.state.picks).toEqual([1]);
    expect(datesWithProgress()).toEqual(new Set(['2026-10-14']));
  });

  it('never reopens a finished puzzle', () => {
    saveDaily('wordcraft', '2026-10-14', { status: 'won', state: 'final', result: { score: '3/6' } });
    const r = saveDaily('wordcraft', '2026-10-14', { status: 'playing', state: 'stale' });
    expect(r.status).toBe('won');
    expect(loadDaily('wordcraft', '2026-10-14')?.state).toBe('final');
  });

  it('keeps editions separate per date', () => {
    saveDaily('pattern', '2026-10-13', { status: 'lost', state: null });
    expect(dailyState('pattern', '2026-10-14')).toBe('unplayed');
  });
});

describe('share text', () => {
  it('contains the label, score and grid only', () => {
    const text = buildShareText('Wordcraft', '2026-10-14', { score: '4/6', grid: ['⬜🟨⬜⬜⬜', '🟩🟩🟩🟩🟩'] });
    expect(text).toBe('idl Wordcraft · No. 44\n4/6\n\n⬜🟨⬜⬜⬜\n🟩🟩🟩🟩🟩');
  });
});
