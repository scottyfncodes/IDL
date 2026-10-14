// Builds the trimmed word lists used by Wordcraft and Wordsteps from SCOWL
// (via the `wordlist-english` package). Output is committed so the app never
// needs this package at runtime. Re-run with: node scripts/build-words.mjs
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const tier = (n) => [
  ...require(`wordlist-english/english-words-${n}.json`),
  ...require(`wordlist-english/american-words-${n}.json`),
];
const uniq = (a) => [...new Set(a)].sort();
const ofLen = (words, len) => words.filter((w) => new RegExp(`^[a-z]{${len}}$`).test(w));

// Words never used as answers or ladder steps (offensive, crude, or grim).
const BLOCK = new Set(
  'whore bitch slut sluts pussy penis vagina rapes raped rapist nigga negro dyke dykes fagot fags homo homos boobs tits titty dildo semen sperm porno pervs kills dying death deaths bombs gored nazis nazi hitler rape kill gook gooks spic spics kike kikes coon coons wank wanks twat twats cunt cunts shit shits piss fuck fart farts turd turds dick dicks cock cocks crap slay bomb dead gore porn tit boob anal anus butt arse arses jizz suck sucks crud drug drugs booze lynch whip whips gun guns'.split(' '),
);

const common = [...tier(10), ...tier(20)];
const mid = tier(35);
const valid = [...common, ...mid, ...tier(40), ...tier(50), ...tier(60)];

const looksInflected = (w) => /(?:[^s]s|ed)$/.test(w);

const answers5 = uniq(ofLen(common, 5).filter((w) => !BLOCK.has(w) && !looksInflected(w)));
const guesses5 = uniq(ofLen(valid, 5));
const common4 = uniq(ofLen([...common, ...mid], 4).filter((w) => !BLOCK.has(w) && !/[^s]s$/.test(w)));
const valid4 = uniq(ofLen(valid, 4));

const header = 'Derived from SCOWL (Copyright 2000-2016 Kevin Atkinson). See /LICENSES/SCOWL.txt';
const out = (name, data) =>
  writeFileSync(new URL(`../src/content/words/${name}.json`, import.meta.url), JSON.stringify({ source: header, words: data }));

out('answers5', answers5);
out('guesses5', guesses5);
out('common4', common4);
out('valid4', valid4);
console.log({ answers5: answers5.length, guesses5: guesses5.length, common4: common4.length, valid4: valid4.length });
