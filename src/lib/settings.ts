import { useEffect } from 'react';
import { usePersistentState } from './storage';

export type ThemePref = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemePref;
}

const DEFAULTS: Settings = { theme: 'system' };

export function useSettings() {
  return usePersistentState<Settings>('settings', DEFAULTS, 1);
}

/** Keep <html data-theme> in sync with the preference and the OS. */
export function useApplyTheme(pref: ThemePref) {
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = pref === 'dark' || (pref === 'system' && !!mq?.matches);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute('content', dark ? '#141a17' : '#f5efe3');
    };
    apply();
    mq?.addEventListener?.('change', apply);
    return () => mq?.removeEventListener?.('change', apply);
  }, [pref]);
}
