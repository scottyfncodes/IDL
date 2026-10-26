# idl

**A pocket of play for the time in between.** idl is a free, offline-first
collection of original daily puzzles and pass-and-play games, by HaveAnApp.

- **Today** — a daily edition of six original puzzles: Linkup, Wordsteps,
  Couplet, Deduction, Sumwise and Wordcraft.
- **Play** — the game room, curated into *Start here*, *More to play* and
  *Quick fillers*. Every game works with no connection.
- **Library** — the playable archive of every past edition, your shelf of
  results, and preferences.

No accounts, no ads, no tracking, no server. Progress is stored on the device.

## Stack

Vite + React 18 + TypeScript, plain CSS with design tokens, Vitest for unit
tests and Playwright for browser tests. There are no runtime dependencies
beyond React and two self-hosted variable fonts (Fraunces, Schibsted Grotesk).

```
npm install
npm run dev          # local dev server
npm test             # unit tests (game logic, content validation, storage…)
npm run lint
npm run typecheck
npm run build        # production build → dist/ (includes sw.js)
npm run e2e          # builds, serves and runs browser tests (iPhone + desktop sizes, offline)
```

## Layout

```
src/
  app/            shell: router (hash-based), tab layout, error boundary
  pages/          Today, Play, Library, edition + game routes
  ui/             shared primitives: GameScreen, Sheet, Button, Keyboard, icons…
  styles/         tokens.css (design tokens), base, ui, app
  lib/            date (edition keys), rng (seeded), storage, share, settings
  daily/          daily registry, types, progress store, share text
  room/           game-room registry and collections
  games/daily/*   each daily puzzle: logic.ts (pure) + tests + content + UI
  games/room/*    each game-room game: logic.ts (pure) + tests + UI
  content/words/  word lists derived from SCOWL (see LICENSES/SCOWL.txt)
  pwa/            service worker template + registration
scripts/          build-words.mjs, build-icons.mjs
e2e/              Playwright tests
```

## Daily editions

- An edition is keyed by a calendar date string `YYYY-MM-DD`. A player's
  "today" is their **local** calendar date, so the new edition arrives at
  local midnight; the puzzle for a given date is identical for every player.
  (We chose local dates over a single UTC rollover so nobody gets tomorrow's
  puzzle in the late afternoon.) Date arithmetic on keys is done in UTC on the
  string, so time zones and DST can never change which puzzle a date maps to.
- The archive starts at `LAUNCH_DATE` (2026-09-01) and future dates are never
  playable.
- Each game's `getPuzzle(date)` is deterministic: either an authored pool
  indexed by `dayNumber(date) % pool.length`, or seeded generation from
  `createRng('<game>:v1:<date>')` with verification. Never use `Math.random`
  for daily content.
- **Stability rules:** authored pools are append-only (never reorder or edit
  published entries). Appending only changes the mapping for days at or beyond
  the old pool length, so extend pools before they wrap. Generators are
  versioned in their seed (`v1`); changing a generator means bumping the
  version *and* keeping old dates on the old version. Each game has tests that
  pin specific dates to specific puzzles so accidental changes fail CI.
- Every published puzzle is validated in tests (authored pools: every entry;
  generated: hundreds of consecutive days).
- **Retiring a daily game:** mark it `retired: true` in `src/daily/registry.ts`.
  It leaves new editions (`EDITION_GAMES`) but its archive still opens, so old
  links and results keep working.

## Couplet's puzzle engine

Couplet (`src/games/daily/couplet`) generates three boards a day and proves
each one has exactly one answer before anyone sees it.

1. Grow a connected board out of placed dominoes (that tiling is the answer).
2. Carve the bare board into regions and choose which will be "all equal",
   then assign pip values to fit that design with every domino distinct
   (rules are designed before numbers, which keeps big regions meaningful).
3. **Tighten:** while a rival answer exists, split the region where it differs
   (choosing, among candidate splits, the one that removes the most ambiguity).
4. **Loosen:** turn exact rules into `<`, `>`, `≠`, merges or free cells one at
   a time, keeping each change only if the solver still proves one answer.
5. Accept the board only if its difficulty (solver branching: easy 0, medium
   1–6, hard 12–80) and shape rules (few single-cell clues) fit the tier.

`solve()` is the solver; `solutionProblems()`/`boardProblems()` check answers
and boards independently of it; the tests add a brute-force enumerator that
confirms uniqueness on small boards. Boards are built per tier on demand, in a
Web Worker where available, and cached on the device. The seed is
`couplet:v1:<date>:<tier>`; bump `GENERATOR_VERSION` to change the generator.

See `docs/QUALITY.md` for the quality bar every game is held to.

## Illustration

idl's art direction is "paper hours": every game has a cut-paper cover scene
built from its own mechanic, daily puzzles in morning light and game-room games
in lamp-lit evening, with the wordmark's clay dot as the sun. The Today
masthead follows the reader's local hour. All art is inline SVG in `src/art/`
(no image files), so it scales cleanly and works offline. The rules every new
scene must follow are at the top of `src/art/kit.tsx`.

## Offline & PWA

- `sw.js` is generated at build time by a small Vite plugin
  (`vite.config.ts`) that precaches **every** built file — app shell, all game
  chunks, fonts, icons — under a content-hashed cache name. Old caches are
  deleted on activation.
- Navigations are served from the cached shell; assets are cache-first. New
  versions install in the background and wait; the app offers a "Reload"
  prompt so a game is never interrupted mid-move.
- The first visit (or install) needs a connection. After that, the app and
  all games launch and play with no network.
- Progress lives in `localStorage` under `idl:` keys with a versioned
  envelope. The app asks for persistent storage (no prompt in mainstream
  browsers) but browsers — Safari in particular — can still evict data, which
  the Library page explains.

## Deploying

Static hosting. `vercel.json` sets the build command, output directory and
cache headers (`sw.js` and `index.html` are never cached by the CDN; hashed
assets are immutable). Any static host works with equivalent headers.

## Content & licences

All puzzles, clues and copy are original. Word lists are derived from SCOWL
(© Kevin Atkinson, permissive licence in `LICENSES/SCOWL.txt`). Fonts are
Fraunces and Schibsted Grotesk (SIL Open Font License) via Fontsource.
