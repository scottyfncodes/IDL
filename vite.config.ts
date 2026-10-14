/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/** Emits /sw.js with a precache list of every built file plus /public. */
function idlServiceWorker(): Plugin {
  return {
    name: 'idl-service-worker',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const publicDir = join(__dirname, 'public');
      const walk = (dir: string): string[] =>
        readdirSync(dir).flatMap((f) => {
          const p = join(dir, f);
          return statSync(p).isDirectory() ? walk(p) : [relative(publicDir, p).split('\\').join('/')];
        });
      const publicFiles = walk(publicDir).filter((f) => !f.startsWith('.') && f !== '_headers' && f !== 'robots.txt');
      const files = ['./', './index.html', ...Object.keys(bundle).map((f) => `./${f}`), ...publicFiles.map((f) => `./${f}`)];
      const unique = [...new Set(files)].filter((f) => !f.endsWith('.map'));
      const hash = createHash('sha256');
      for (const name of Object.keys(bundle).sort()) {
        const chunk = bundle[name];
        hash.update(name);
        hash.update(chunk.type === 'chunk' ? chunk.code : typeof chunk.source === 'string' ? chunk.source : Buffer.from(chunk.source));
      }
      const version = hash.digest('hex').slice(0, 12);
      const template = readFileSync(join(__dirname, 'src/pwa/sw-template.js'), 'utf8');
      for (const marker of ['__IDL_VERSION__', '__IDL_PRECACHE__']) {
        if (template.split(marker).length !== 2) throw new Error(`sw-template.js must contain ${marker} exactly once`);
      }
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template.replace('__IDL_VERSION__', version).replace('__IDL_PRECACHE__', JSON.stringify(unique, null, 0)),
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), idlServiceWorker()],
  build: { target: 'es2020', assetsInlineLimit: 0 },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
});
