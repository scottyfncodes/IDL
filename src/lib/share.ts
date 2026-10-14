/**
 * Share with the native sheet when available, otherwise copy to the
 * clipboard, otherwise fall back to a hidden textarea + execCommand.
 */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

export interface ShareEnv {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
  clipboardWrite?: (text: string) => Promise<void>;
  legacyCopy?: (text: string) => boolean;
}

function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function browserShareEnv(): ShareEnv {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  // Desktop browsers with navigator.share often present awkward sheets; the
  // native sheet is most useful on touch devices.
  const touch = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  return {
    share: touch && nav?.share ? nav.share.bind(nav) : undefined,
    canShare: nav?.canShare?.bind(nav),
    clipboardWrite: nav?.clipboard?.writeText ? (t) => nav.clipboard.writeText(t) : undefined,
    legacyCopy,
  };
}

export async function shareText(text: string, env: ShareEnv = browserShareEnv()): Promise<ShareOutcome> {
  const data: ShareData = { text };
  if (env.share && (!env.canShare || env.canShare(data))) {
    try {
      await env.share(data);
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
      // fall through to clipboard
    }
  }
  if (env.clipboardWrite) {
    try {
      await env.clipboardWrite(text);
      return 'copied';
    } catch {
      /* fall through */
    }
  }
  if (env.legacyCopy?.(text)) return 'copied';
  return 'failed';
}
