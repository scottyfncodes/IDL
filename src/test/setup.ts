import { afterEach } from 'vitest';

afterEach(() => {
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});
