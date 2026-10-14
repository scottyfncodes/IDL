// Renders idl's app icons (PNG) from the Fraunces wordmark using Playwright's
// bundled Chromium. Re-run with: node scripts/build-icons.mjs
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const font = readFileSync(new URL('../node_modules/@fontsource-variable/fraunces/files/fraunces-latin-soft-normal.woff2', import.meta.url)).toString('base64');

const html = (size, scale, radius) => `<!doctype html><html><head><style>
@font-face { font-family: F; src: url(data:font/woff2;base64,${font}) format('woff2'); font-weight: 100 900; }
html,body { margin:0; width:${size}px; height:${size}px; background: transparent; }
.bg { width:${size}px; height:${size}px; background:#1c2420; border-radius:${radius}px; display:grid; place-items:center; overflow:hidden; }
.w { font-family: F; font-weight: 640; font-variation-settings: 'SOFT' 100, 'opsz' 144; color:#f5efe3; font-size:${size * 0.4 * scale}px; letter-spacing:-0.035em; line-height:1; transform: translateY(-3%); }
.i { position: relative; display:inline-block; }
.d { position:absolute; left:50%; top:0.02em; width:0.2em; height:0.2em; margin-left:-0.1em; border-radius:50%; background:#e07a55; }
</style></head><body><div class="bg"><span class="w"><span class="i">ı<span class="d"></span></span>dl</span></div></body></html>`;

const targets = [
  { file: 'public/icons/icon-192.png', size: 192, scale: 1, radius: 0 },
  { file: 'public/icons/icon-512.png', size: 512, scale: 1, radius: 0 },
  { file: 'public/icons/icon-maskable-512.png', size: 512, scale: 0.78, radius: 0 },
  { file: 'public/icons/apple-touch-icon.png', size: 180, scale: 1, radius: 0 },
  { file: 'public/icons/favicon-64.png', size: 64, scale: 1.05, radius: 14 },
];

const browser = await chromium.launch();
for (const t of targets) {
  const page = await browser.newPage({ viewport: { width: t.size, height: t.size } });
  await page.setContent(html(t.size, t.scale, t.radius));
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: t.file, omitBackground: true });
  await page.close();
  console.log('wrote', t.file);
}
await browser.close();
