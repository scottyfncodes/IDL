import { shareText } from './share';

describe('shareText', () => {
  it('uses the native share sheet when present', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    expect(await shareText('hi', { share })).toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'hi' });
  });

  it('treats a dismissed share sheet as cancelled, not an error', async () => {
    const err = Object.assign(new Error('x'), { name: 'AbortError' });
    const clipboardWrite = vi.fn();
    expect(await shareText('hi', { share: () => Promise.reject(err), clipboardWrite })).toBe('cancelled');
    expect(clipboardWrite).not.toHaveBeenCalled();
  });

  it('falls back to the clipboard when sharing is unavailable or fails', async () => {
    const clipboardWrite = vi.fn().mockResolvedValue(undefined);
    expect(await shareText('hi', { clipboardWrite })).toBe('copied');
    expect(await shareText('hi', { share: () => Promise.reject(new Error('nope')), clipboardWrite })).toBe('copied');
  });

  it('falls back to legacy copy, then reports failure', async () => {
    expect(await shareText('hi', { clipboardWrite: () => Promise.reject(new Error('denied')), legacyCopy: () => true })).toBe('copied');
    expect(await shareText('hi', { legacyCopy: () => false })).toBe('failed');
    expect(await shareText('hi', {})).toBe('failed');
  });
});
