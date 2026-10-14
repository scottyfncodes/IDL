/**
 * Minimal hash router. Hash routing keeps every screen at index.html, which
 * makes offline navigation trivial for the service worker and works on any
 * static host without rewrite rules.
 */
import { useEffect, useState } from 'react';

export interface Route {
  path: string; // e.g. '/daily/linkup/2026-10-14'
  segments: string[];
  query: URLSearchParams;
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#/, '') || '/today';
  const [pathPart, queryPart = ''] = raw.split('?');
  const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  return { path, segments: path.split('/').filter(Boolean), query: new URLSearchParams(queryPart) };
}

let depth = 0; // in-app navigations since load, so Back can use history safely

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const hash = `#${to}`;
  if (opts.replace) {
    history.replaceState(history.state, '', hash);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    depth++;
    window.location.hash = to;
  }
}

/** Go back within the app if possible, else to `fallback`. */
export function goBack(fallback: string) {
  if (depth > 0) {
    depth--;
    history.back();
  } else navigate(fallback, { replace: true });
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export const href = (to: string) => `#${to}`;
