# idl quality bar

An honest look at every game, and the bar each must meet before we call it
finished. Written after a full audit (October 2026): every game was played at
iPhone size, generated content was sampled across weeks of dates, and computer
opponents were measured in simulation. Loading without errors is not evidence
that a game is good, so this document is about play.

**The principle:** a few excellent experiences beat many mediocre ones. Don't
add a game to raise the count. Don't add streaks, currencies, upgrades or
achievements by default. Add a feature only when it makes the game itself
better.

## Verdicts at a glance

| Game | Where | Verdict | One line |
|---|---|---|---|
| Couplet | Daily | **New, strong** | Domino logic with a verified engine: one answer, reachable by deduction |
| Connect Four | Room | **Strong** | Real opponent on hard, good drop feel, proper end card |
| Mines | Room | **Strong** | No-guess boards that generate instantly; long-press flag works |
| Patience | Room | **Strong** | Every deal winnable; tap and drag both reliable |
| Pocket Sudoku | Room | **Strong** | Well made, unique grids; no reason to return beyond bests |
| Wordsteps | Daily | Potential, close | Clear and satisfying; "par" isn't always true |
| Deduction | Daily | Potential, our most original daily | Charming; clues filter rather than chain |
| Linkup | Daily | Potential | Mechanics fine; content mostly flat category lists |
| Sumwise | Daily | Potential | Rounds 1 and 2 are usually trivial |
| Picture Logic | Room | Potential | Best reveal moment in idl; 10×10s fall to overlap |
| Reversi | Room | Potential, close | Strong hard opponent; easy is random; no rounds tally |
| Dots & Boxes | Room | Potential | Most distinct duo game; hard never double-deals |
| Mancala | Room | Potential | Nice sowing animation; first player has a large edge |
| Mini Battleship | Room | Potential | Careful hand-off flow; no solo mode, 3 taps a shot |
| Wordcraft | Daily | Filler with a familiar face | Works, but it is Wordle with no twist |
| Mystery Grid | Room | Leaning weak | Clues and grid never on screen together |
| Memory Match | Room | Weak solo, fine as a two-player filler | 12 motifs, no escalation |
| Tic-Tac-Toe | Room | Weak, kept as a filler | Solved game; hard always draws, easy never blocks |
| Pattern | Daily | **Retired from editions** | 68 repeated sequences in its first 90 days; reads as a quiz |

## What changed in this pass

- **Couplet** joins the daily edition (see its section below).
- **Pattern** leaves the edition. It repeated a sequence 68 times across its
  first 270 questions, its dot questions were counting chores, and its easy tier
  was trivial. Its archive still opens and old results still count on the shelf.
  The edition stays at six.
- **Edition order** leads with the strongest: Linkup, Wordsteps, Couplet,
  Deduction, Sumwise, Wordcraft.
- **Game room** is curated into three shelves, *Start here* (Connect Four,
  Mines, Patience, Pocket Sudoku), *More to play*, and *Quick fillers*
  (Tic-Tac-Toe, Memory Match). The four overlapping "collections" carousels are
  gone; the solo/two-player filter stays, with 44px chips.
- **Today's "Hand the phone over"** now features Connect Four, Dots & Boxes
  and Reversi instead of the two weakest games.
- Small fixes: Deduction's "Wrong" badge no longer truncates to "WRO…" with six
  suspects; Wordsteps no longer says "Par 4" twice; Mystery Grid's time estimate
  is honest (3–6 min, not 5–12); blurbs say what's true (e.g. every Patience
  deal can be won).

## Per game

Each entry: **hook** (why it's fun), **loop** (why the next move appeals),
**return** (a real reason to come back), **mastery** (how skill grows),
**signature** (what's memorable), **weaknesses**, and the **bar** for done.

### Couplet (daily, new)
- **Hook:** every domino has to go somewhere, and each one spends numbers that
  another region may need. Small local facts ("this = region needs three 5s")
  ripple across the board.
- **Loop:** place, watch a seal turn solved, find the next forced domino.
- **Return:** three fresh boards a day, a full archive, hints counted honestly.
- **Mastery:** spotting forced pairs, supply counting (how many 6s are left),
  using inequalities as bounds.
- **Signature:** ivory tiles on a tinted map; round serif seals that turn ink
  with a small check when a rule is met.
- **Engine:** solution-first generation; rules designed before numbers; each
  loosening kept only if an exhaustive solver still proves one answer; difficulty
  measured by solver branching (easy needs none, hard needs 12+). An independent
  checker validates every board and every player answer, and a brute-force
  enumerator confirms uniqueness on small boards in tests.
- **Weaknesses / next:** hard boards take 0.1–1s to generate (done in a
  background worker and cached on the device); the difficulty measure is a
  solver proxy, so watch real solve times and tune bands; consider a "check my
  board" affordance only if players ask.
- **Bar:** every published board unique and valid (tested over hundreds of
  days); first board approachable in under two minutes for a newcomer; hard
  never requires a guess.

### Connect Four (room, strong)
- **Hook:** tense four-in-a-row against a friend or a depth-7 opponent.
- **Weaknesses:** no medium level (easy to hard is a cliff); no undo after a loss.
- **Bar:** add a depth-3/4 medium (the search already takes a depth).

### Mines (room, strong)
- **Hook:** pure deduction with no-guess boards by default.
- **Weaknesses:** densities (15.6–18.9%) are low, so experts hit the ceiling; the
  large board scrolls on iPhone.
- **Bar:** an Expert density around 21% at the medium size.

### Patience (room, strong)
- **Hook:** Klondike that's always winnable, with reliable one-thumb moves.
- **Weaknesses:** fanned face-up cards expose only ~22px strips while 40% of the
  screen sits empty; the solver budget may bias toward easy deals.
- **Bar:** fan offsets that use the free height (at least 32px when there's room).

### Pocket Sudoku (room, strong)
- **Hook:** the classic, done cleanly, with unique grids.
- **Weaknesses:** difficulty graded mostly by clue count; instant mistake
  checking can't be turned off; nothing brings you back.
- **Bar:** grade by technique; an option to turn off instant checking.

### Wordsteps (daily, potential, close to strong)
- **Hook:** a word ladder with a visible par.
- **Weaknesses:** par is computed over common words while any valid word is
  accepted, so on about 1 day in 5 a shorter route exists; changed letters use
  the clay "error" colour; obscure endpoint words.
- **Bar:** a true par (or call it "our route"); a neutral colour for changed
  letters; endpoints from a frequency list (needs a generator version bump).

### Deduction (daily, potential, our most original daily)
- **Hook:** illustrated suspects in a lineup, solved from clues.
- **Weaknesses:** two-thirds of clues eliminate exactly one suspect, so you scan
  rather than chain; three accusations makes failure rare; the lineup and clues
  don't fit on one screen.
- **Bar:** prefer relational clues that only work in combination; a clue list
  that stays visible. Changes to clue generation need a version bump.

### Linkup (daily, potential)
- **Hook:** sixteen words, four groups.
- **Weaknesses:** groups 1–3 are usually flat category lists with no decoys; the
  share squares use the same four colours as the best-known game in the genre;
  the 194-puzzle pool wraps in about six months.
- **Bar:** every new puzzle carries two or more deliberate cross-group decoys; a
  share grid with its own identity. (Authored pools are append-only.)

### Sumwise (daily, potential)
- **Hook:** build a sum to hit a target.
- **Weaknesses:** Warm-up and Steady are often trivial (10×4×3); there's no
  stake, since Submit only enables once you're on target.
- **Bar:** at least four tiles needed in rounds 1–2 (version bump), and a small
  reward for elegance.

### Picture Logic (room, potential)
- **Hook:** nonogram logic that reveals a picture; the best completion moment in idl.
- **Weaknesses:** 10×10s are blocky and fall to overlap; 13 of the 19 small
  subjects repeat as large ones; bests are per size, not per picture.
- **Bar:** about 20 larger pictures that need real line logic; per-picture bests.

### Reversi (room, potential, close)
- **Weaknesses:** easy is effectively random; the person always plays black and
  moves first; no rounds tally.
- **Bar:** alternate first move, a rounds tally, a medium level.

### Dots & Boxes (room, potential)
- **Weaknesses:** hard never declines the last two boxes of a chain, so anyone who
  knows the long-chain rule always wins; easy hands over third sides.
- **Bar:** hard double-deals; easy avoids third sides half the time.

### Mancala (room, potential)
- **Weaknesses:** the first player has a large edge and the person always starts;
  the end card's score order contradicts its headline.
- **Bar:** alternate who starts; fix the end-card copy.

### Mini Battleship (room, potential, the biggest gap among duo games)
- **Weaknesses:** the only duo game with no computer opponent; three taps plus a
  hand-off per shot; a sinking has no moment.
- **Bar:** an idl opponent (hunt and target with parity), and a real sink moment.

### Wordcraft (daily, familiar filler)
- **Weaknesses:** no twist; its only hook is borrowed.
- **Bar:** one signature idea of its own, or accept it as the familiar door into
  the edition and invest elsewhere.

### Mystery Grid (room, leaning weak)
- **Weaknesses:** the grid and clues are never visible together on a phone; the
  three sub-grids hide behind tabs; "either/or" clues dominate tricky puzzles.
- **Bar:** clues and grid on one screen, or demote it further.

### Memory Match and Tic-Tac-Toe (room, fillers)
Kept for very short two-player moments, shelved as *Quick fillers* and not
featured. Not worth more investment unless used as teaching games.

### Pattern (retired)
Kept playable from the archive so links and history still work. Not worth
reviving without a different premise.

## Recommended next priorities

1. Deduction: relational clue chains and a visible clue list. It's our most
   original daily and the gap between charming and great is small.
2. Wordsteps: a true par and a calmer changed-letter colour.
3. Connect Four, Reversi, Tic-Tac-Toe: a medium level; Reversi and Mancala:
   alternate who starts.
4. Mini Battleship: a solo opponent.
5. Linkup: decoys in every new puzzle and its own share identity.
6. Sumwise: harder early rounds (versioned).

Each daily content change follows the stability rules in the README: authored
pools are append-only, and generator changes bump the version while old dates
keep the old generator.
