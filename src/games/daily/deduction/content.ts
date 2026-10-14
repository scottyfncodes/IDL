/**
 * Authored flavour for Deduction. Original text. Append-only: the generator
 * picks from these with a seeded RNG, so reordering would change published
 * editions.
 */

export interface Scenario {
  title: string;
  /** One or two short sentences setting the scene. */
  text: string;
}

export const SCENARIOS: readonly Scenario[] = [
  { title: 'The last lemon tart', text: 'The last lemon tart vanished from the allotment bake sale before the judging. The stallholders lined up by the shed.' },
  { title: 'The missing logbook', text: 'The lighthouse logbook has gone from its shelf on the stairs. Everyone on the evening tour was asked to stand in a row.' },
  { title: 'The open greenhouse', text: 'Somebody left the greenhouse door open overnight and the tomatoes caught a chill. The gardeners gathered on the path.' },
  { title: 'The rearranged chess set', text: 'Halfway through the club tournament, someone quietly moved a bishop. The players lined up by the tea urn.' },
  { title: 'The silent church bell', text: 'The bell rope at St Brannock’s was tied up in a knot nobody can undo. The bell-ringers stood in a line by the font.' },
  { title: 'The borrowed canoe', text: 'A canoe went for a paddle without its owner and came back muddy. The boathouse regulars lined up on the jetty.' },
  { title: 'The jam with no label', text: 'A jar of bramble jam turned up on the village show table with no label and no entry form. The entrants were asked to step forward.' },
  { title: 'The library hush', text: 'Someone set the reading-room clock forty minutes fast, and the library shut early. The last visitors lined up at the desk.' },
  { title: 'The extra snowman', text: 'Overnight a seventh snowman appeared on the green, wearing the caretaker’s scarf. The early walkers stood along the fence.' },
  { title: 'The swapped name badges', text: 'Every name badge at the beekeepers’ meeting was swapped around. The attendees lined up by the honey stand.' },
  { title: 'The kite in the oak', text: 'A bright kite is stuck at the top of the old oak, and nobody will say whose it is. The picnickers gathered in a row.' },
  { title: 'The crossword in pen', text: 'Someone finished the café’s shared crossword — in pen, with three wrong answers. The regulars stood by the counter.' },
  { title: 'The missing trophy polish', text: 'The bowls club’s trophy polish is gone, and the cup is looking dull. The members lined up along the green.' },
  { title: 'The midnight piano', text: 'The hall piano was heard playing a waltz at midnight. The choir members stood in a line on the stage.' },
  { title: 'The painted gnome', text: 'The garden gnome at number nine was repainted in stripes. The neighbours gathered along the hedge.' },
  { title: 'The vanished tide table', text: 'The harbour’s printed tide table disappeared from the noticeboard. The morning fishers lined up on the slipway.' },
  { title: 'The odd sock', text: 'One odd sock has been pegged to the community washing line every morning this week. The suspects stood in a row by the laundry.' },
  { title: 'The empty biscuit tin', text: 'The rehearsal biscuit tin was full at seven and empty at eight. The cast lined up in front of the curtain.' },
  { title: 'The rogue sunflower', text: 'A sunflower now towers over the bowling green, planted without permission. The groundskeepers stood in a line.' },
  { title: 'The muddled map', text: 'Someone turned the walking group’s map upside down at the trailhead. The ramblers lined up by the stile.' },
  { title: 'The unwound clock', text: 'The station clock stopped at ten past three because someone forgot — or chose not — to wind it. The commuters stood along the platform.' },
  { title: 'The extra raffle ticket', text: 'The fete raffle drew a ticket number that was never sold. The helpers lined up behind the prize table.' },
  { title: 'The muddy footprints', text: 'Muddy footprints lead across the freshly mopped museum floor. The visitors stood in a row by the fossils.' },
  { title: 'The repainted bench', text: 'The memorial bench is suddenly bright teal, with the paint still a little wet. The park regulars gathered by the pond.' },
];

/** Short given names from many cultures; ≤ 6 letters to fit the lineup. */
export const NAMES: readonly string[] = [
  'Ada', 'Bram', 'Chidi', 'Dara', 'Elif', 'Femi', 'Greta', 'Hiro', 'Ines', 'Jonah',
  'Kemi', 'Lars', 'Mina', 'Nico', 'Odile', 'Priya', 'Quinn', 'Rafa', 'Sunny', 'Tomas',
  'Uma', 'Vik', 'Wen', 'Yusuf', 'Zara', 'Aiko', 'Bea', 'Cyrus', 'Dev', 'Esme',
  'Farid', 'Gus', 'Hana', 'Ivo', 'Juno', 'Kofi', 'Lena', 'Mateo', 'Noor', 'Oskar',
  'Pilar', 'Ravi', 'Teo', 'Ulla', 'Wanda', 'Xavi', 'Yara', 'Aroha', 'Bodhi', 'Mei',
];
