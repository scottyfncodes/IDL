/**
 * Mystery Grid themes. All original. Each theme has three categories of four
 * items; the first category is always the people. Text templates use `{}`
 * for the item.
 *
 *  - subject: how to name someone by this item at the start of a sentence
 *             ("whoever grows leeks", "Ines")
 *  - verb / negVerb + obj: the predicate ("grows" + "leeks")
 *  - ordinal: present when items are in order (index 0 comes first);
 *             phrases compare two people ("X {before} Y").
 */

export interface Category {
  name: string;
  items: [string, string, string, string];
  subject: string;
  verb: string;
  negVerb: string;
  obj: string;
  ordinal?: { before: string; justBefore: string };
}

export interface Theme {
  id: string;
  title: string;
  intro: string;
  categories: [Category, Category, Category];
}

const people = (name: string, items: Category['items']): Category => ({
  name,
  items,
  subject: '{}',
  verb: 'is',
  negVerb: 'is not',
  obj: '{}',
});

export const THEMES: Theme[] = [
  {
    id: 'allotment',
    title: 'The Allotment',
    intro: 'Four gardeners share a row of plots by the railway. Who grows what, and where?',
    categories: [
      people('Gardener', ['Ines', 'Bram', 'Odile', 'Kofi']),
      { name: 'Crop', items: ['leeks', 'pumpkins', 'beans', 'rhubarb'], subject: 'whoever grows {}', verb: 'grows', negVerb: 'doesn’t grow', obj: '{}' },
      {
        name: 'Plot',
        items: ['plot 1', 'plot 2', 'plot 3', 'plot 4'],
        subject: 'whoever tends {}',
        verb: 'tends',
        negVerb: 'doesn’t tend',
        obj: '{}',
        ordinal: { before: 'has a lower-numbered plot than', justBefore: 'tends the plot just before' },
      },
    ],
  },
  {
    id: 'supper',
    title: 'Supper Club',
    intro: 'Four friends sit along one side of a long table, each having brought a dish.',
    categories: [
      people('Guest', ['Wren', 'Tobias', 'Amara', 'Lio']),
      { name: 'Dish', items: ['onion tart', 'lentil soup', 'plum cake', 'flatbread'], subject: 'whoever brought the {}', verb: 'brought', negVerb: 'didn’t bring', obj: 'the {}' },
      {
        name: 'Seat',
        items: ['seat 1', 'seat 2', 'seat 3', 'seat 4'],
        subject: 'whoever is in {}',
        verb: 'sits in',
        negVerb: 'doesn’t sit in',
        obj: '{}',
        ordinal: { before: 'sits further left than', justBefore: 'sits directly left of' },
      },
    ],
  },
  {
    id: 'pet-show',
    title: 'The Village Pet Show',
    intro: 'Four owners, four unusual pets, four ribbons pinned at the end of the day.',
    categories: [
      people('Owner', ['Hattie', 'Rufus', 'Noor', 'Callum']),
      { name: 'Pet', items: ['tortoise', 'ferret', 'parrot', 'goldfish'], subject: 'the {} owner', verb: 'owns', negVerb: 'doesn’t own', obj: 'the {}' },
      { name: 'Ribbon', items: ['blue', 'gold', 'green', 'red'], subject: 'whoever won the {} ribbon', verb: 'won', negVerb: 'didn’t win', obj: 'the {} ribbon' },
    ],
  },
  {
    id: 'ferry',
    title: 'Morning Ferries',
    intro: 'Four passengers wait on the pier, each bound for a different island.',
    categories: [
      people('Passenger', ['Elsie', 'Marco', 'Priya', 'Dov']),
      { name: 'Island', items: ['Gull Rock', 'Haverly', 'Saltmere', 'Brannock'], subject: 'whoever is bound for {}', verb: 'is bound for', negVerb: 'isn’t bound for', obj: '{}' },
      {
        name: 'Ferry',
        items: ['7:10', '7:40', '8:10', '8:40'],
        subject: 'whoever takes the {} ferry',
        verb: 'takes',
        negVerb: 'doesn’t take',
        obj: 'the {} ferry',
        ordinal: { before: 'sails earlier than', justBefore: 'sails on the ferry just before' },
      },
    ],
  },
  {
    id: 'book-club',
    title: 'Book Club Night',
    intro: 'Four readers, four very different books, and a table of snacks.',
    categories: [
      people('Reader', ['Juno', 'Felix', 'Saoirse', 'Ade']),
      { name: 'Book', items: ['memoir', 'thriller', 'atlas', 'cookbook'], subject: 'whoever is reading the {}', verb: 'is reading', negVerb: 'isn’t reading', obj: 'the {}' },
      { name: 'Snack', items: ['figs', 'shortbread', 'olives', 'cheese straws'], subject: 'whoever brought {}', verb: 'brought', negVerb: 'didn’t bring', obj: '{}' },
    ],
  },
  {
    id: 'lessons',
    title: 'Tuesday Lessons',
    intro: 'A music teacher sees four students back to back. Who plays what, and when?',
    categories: [
      people('Student', ['Mabel', 'Theo', 'Rosa', 'Kai']),
      { name: 'Instrument', items: ['cello', 'flute', 'piano', 'trumpet'], subject: 'the {} player', verb: 'plays', negVerb: 'doesn’t play', obj: 'the {}' },
      {
        name: 'Lesson',
        items: ['3:00', '3:30', '4:00', '4:30'],
        subject: 'whoever has the {} lesson',
        verb: 'has',
        negVerb: 'doesn’t have',
        obj: 'the {} lesson',
        ordinal: { before: 'has an earlier lesson than', justBefore: 'has the lesson right before' },
      },
    ],
  },
  {
    id: 'trail',
    title: 'The Ridge Walk',
    intro: 'Four hikers set off on four different trails, each with a pack of their own colour.',
    categories: [
      people('Hiker', ['Greta', 'Sol', 'Imogen', 'Bastian']),
      { name: 'Trail', items: ['Fern Gully', 'High Tor', 'Mill Race', 'Larch Loop'], subject: 'whoever walked {}', verb: 'walked', negVerb: 'didn’t walk', obj: '{}' },
      { name: 'Pack', items: ['orange', 'navy', 'olive', 'grey'], subject: 'the hiker with the {} pack', verb: 'carries', negVerb: 'doesn’t carry', obj: 'the {} pack' },
    ],
  },
  {
    id: 'bakery',
    title: 'Saturday Market',
    intro: 'Four bakers set up stalls in a row, each famous for one loaf.',
    categories: [
      people('Baker', ['Agnes', 'Ravi', 'Lotte', 'Cyrus']),
      { name: 'Loaf', items: ['sourdough', 'rye', 'focaccia', 'brioche'], subject: 'whoever bakes the {}', verb: 'bakes', negVerb: 'doesn’t bake', obj: 'the {}' },
      {
        name: 'Stall',
        items: ['stall 1', 'stall 2', 'stall 3', 'stall 4'],
        subject: 'whoever runs {}',
        verb: 'runs',
        negVerb: 'doesn’t run',
        obj: '{}',
        ordinal: { before: 'is further up the row than', justBefore: 'runs the stall just before' },
      },
    ],
  },
  {
    id: 'flats',
    title: 'Number Nine, Linden Road',
    intro: 'Four neighbours live one above another, each with a hobby that drifts down the stairwell.',
    categories: [
      people('Neighbour', ['Pearl', 'Dmitri', 'Yusra', 'Eoin']),
      {
        name: 'Floor',
        items: ['first', 'second', 'third', 'fourth'],
        subject: 'whoever lives on the {} floor',
        verb: 'lives on',
        negVerb: 'doesn’t live on',
        obj: 'the {} floor',
        ordinal: { before: 'lives lower down than', justBefore: 'lives directly below' },
      },
      { name: 'Hobby', items: ['pottery', 'chess', 'birdwatching', 'knitting'], subject: 'the {} fan', verb: 'is into', negVerb: 'isn’t into', obj: '{}' },
    ],
  },
  {
    id: 'regatta',
    title: 'The Little Regatta',
    intro: 'Four dinghies, four skippers, one blustery race round the bay.',
    categories: [
      people('Skipper', ['Morwenna', 'Jago', 'Tilly', 'Osei']),
      { name: 'Boat', items: ['Kestrel', 'Marigold', 'Driftwood', 'Halcyon'], subject: 'the skipper of the {}', verb: 'sails', negVerb: 'doesn’t sail', obj: 'the {}' },
      {
        name: 'Finish',
        items: ['first', 'second', 'third', 'fourth'],
        subject: 'whoever finished {}',
        verb: 'finished',
        negVerb: 'didn’t finish',
        obj: '{}',
        ordinal: { before: 'finished ahead of', justBefore: 'crossed the line just ahead of' },
      },
    ],
  },
  {
    id: 'cafe',
    title: 'Corner Café',
    intro: 'Four regulars, four usual orders, four favourite tables.',
    categories: [
      people('Regular', ['Bea', 'Ansel', 'Mina', 'Quill']),
      { name: 'Order', items: ['flat white', 'chai', 'hot chocolate', 'mint tea'], subject: 'whoever orders the {}', verb: 'orders', negVerb: 'doesn’t order', obj: 'the {}' },
      { name: 'Table', items: ['window', 'corner', 'counter', 'garden'], subject: 'whoever sits at the {} table', verb: 'sits at', negVerb: 'doesn’t sit at', obj: 'the {} table' },
    ],
  },
  {
    id: 'stargazers',
    title: 'Star Party',
    intro: 'Four stargazers set up telescopes on the hill and arrive one after another.',
    categories: [
      people('Stargazer', ['Iris', 'Oren', 'Delphine', 'Nils']),
      { name: 'Target', items: ['Saturn', 'the Moon', 'Orion', 'Andromeda'], subject: 'whoever is watching {}', verb: 'is watching', negVerb: 'isn’t watching', obj: '{}' },
      {
        name: 'Arrival',
        items: ['8 pm', '9 pm', '10 pm', '11 pm'],
        subject: 'whoever arrived at {}',
        verb: 'arrived at',
        negVerb: 'didn’t arrive at',
        obj: '{}',
        ordinal: { before: 'arrived earlier than', justBefore: 'arrived an hour before' },
      },
    ],
  },
];
