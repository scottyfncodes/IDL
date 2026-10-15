/**
 * Content audits for the Linkup pool. These catch *mechanical* ambiguity —
 * the kind a machine can see — so human review can focus on meaning.
 *
 * Cross-fit check: every group whose label names a broad family (fruit,
 * birds, colours…) contributes its words to that family's lexicon, built from
 * the whole pool. If a puzzle has a group in family F and a word from a
 * *different* group is known to be an F, that word could plausibly be
 * claimed by the F group — an accidental alternate grouping. Each such hit
 * must either be fixed or listed in REVIEWED_RED_HERRINGS with a reason why
 * the intended split is still the only full solution.
 */
import { wordKey, type LinkupPuzzle } from './logic';

/** Families keyed by a label pattern. Wordplay labels (with ___) never count. */
const FAMILIES: [family: string, pattern: RegExp][] = [
  ['fruit', /\bfruits?\b|\bberries\b/i],
  ['vegetable', /\bvegetables?\b|\bveg\b/i],
  ['bird', /\bbirds?\b/i],
  ['fish', /\bfish\b/i],
  ['dog', /\bdog breeds?\b/i],
  ['insect', /\binsects?\b/i],
  ['tree', /\btrees?\b/i],
  ['flower', /\bflowers?\b/i],
  ['herb-spice', /\bherbs?\b|\bspices?\b/i],
  ['colour', /\bshades? of\b|\bcolou?rs?\b/i],
  ['metal', /\bmetals?\b/i],
  ['gem', /\bgem(stone)?s?\b/i],
  ['country', /\bcountries\b/i],
  ['instrument', /\binstruments?\b|\bwoodwind\b|\bbrass\b|\bpercussion\b/i],
  ['dance', /\bdances?\b/i],
  ['weather', /\bweather\b|\bstorms?\b/i],
  ['sport', /\bsports?\b/i],
  ['cheese', /\bcheeses?\b/i],
  ['nut', /\bnuts\b/i],
  ['clothing', /\bclothing\b|\bwinter wear\b|\blegwear\b/i],
  ['footwear', /\bshoes\b|\bfootwear\b/i],
  ['hat', /\bhats\b/i],
  ['tool', /\btools?\b|\btoolbox\b/i],
  ['vehicle', /\bvehicles?\b|\baircraft\b|\bboats?\b/i],
  ['body', /\bbody\b|\bjoints\b|\borgans\b|\bon your face\b/i],
  ['currency', /\bcurrenc(y|ies)\b/i],
  ['planet', /\bplanets?\b/i],
  // Animals are grouped by habitat/kind in this pool, so there is no generic
  // "animal" family: a kangaroo is an animal but not a rainforest animal.
  ['rodent', /\brodents\b/i],
  ['snake', /\bsnakes\b/i],
  ['big cat', /\bbig cats\b/i],
];

export function familiesOf(label: string): string[] {
  if (label.includes('___') || /\bhidden\b|\bsound(s)? like\b|\banagram|\brhymes?\b|\bpalindrome/i.test(label)) return [];
  return FAMILIES.filter(([, re]) => re.test(label)).map(([f]) => f);
}

export type Lexicon = Map<string, Set<string>>;

export function buildLexicon(pool: readonly LinkupPuzzle[]): Lexicon {
  const lex: Lexicon = new Map();
  for (const p of pool)
    for (const g of p.groups)
      for (const f of familiesOf(g.label)) {
        if (!lex.has(f)) lex.set(f, new Set());
        for (const w of g.words) lex.get(f)!.add(wordKey(w));
      }
  return lex;
}

export interface CrossFit {
  puzzle: string;
  word: string;
  /** Label of the group the word belongs to. */
  from: string;
  /** Label of the group it could also be claimed by. */
  alsoFits: string;
}

export function crossFits(pool: readonly LinkupPuzzle[], lex: Lexicon = buildLexicon(pool)): CrossFit[] {
  const out: CrossFit[] = [];
  for (const p of pool)
    for (const target of p.groups)
      for (const f of familiesOf(target.label)) {
        const known = lex.get(f)!;
        for (const other of p.groups) {
          if (other === target || familiesOf(other.label).includes(f)) continue;
          for (const w of other.words)
            if (known.has(wordKey(w))) out.push({ puzzle: p.id, word: wordKey(w), from: other.label, alsoFits: target.label });
        }
      }
  return out;
}

/** Pairs of groups (anywhere in the pool) that share three or more words. */
export function nearDuplicateGroups(pool: readonly LinkupPuzzle[]): string[] {
  const groups = pool.flatMap((p) => p.groups.map((g) => ({ id: p.id, label: g.label, words: new Set(g.words.map(wordKey)) })));
  const out: string[] = [];
  for (let i = 0; i < groups.length; i++)
    for (let j = i + 1; j < groups.length; j++) {
      const a = groups[i];
      const b = groups[j];
      if (a.id === b.id) continue;
      const shared = [...a.words].filter((w) => b.words.has(w));
      if (shared.length >= 3) out.push(`${a.id} "${a.label}" ~ ${b.id} "${b.label}": ${shared.join(', ')}`);
    }
  return out;
}

/** Canonical one-line form, matching published.json. */
export function fingerprint(p: LinkupPuzzle): string {
  return `${p.id} — ${p.groups.map((g) => `${g.label}: ${g.words.join(', ')}`).join(' / ')}`;
}

/**
 * Cross-fits a human has checked: the word really could suit the other
 * group's label, but the intended split is still the only way to make four
 * complete groups. Key is `${puzzleId}:${WORD}`; the value says why.
 */
export const REVIEWED_RED_HERRINGS: Record<string, string> = {
  'L064:PLUM': 'Plum is a stone fruit, but the stone-fruit group is complete without it and "Rhymes with SUM" has no other fourth (DRUM is needed for Percussion).',
};
