/**
 * Linkup puzzle pool. ORIGINAL content, written for idl.
 *
 * APPEND-ONLY: the puzzle for a date is POOL[dayNumber(date) % POOL.length].
 * Never reorder, edit the words of, or remove a published entry — doing so
 * changes past editions. Add new puzzles at the end.
 *
 * Each puzzle lists its groups from level 0 (straightforward) to level 3
 * (wordplay). Words are 'A|B|C|D'. Every puzzle was checked so that the
 * intended split is the only way to make four complete groups, even where a
 * word is a deliberate red herring.
 */
import type { Level, LinkupPuzzle } from './logic';

type G = [label: string, words: string];

function P(id: string, ...groups: [G, G, G, G]): LinkupPuzzle {
  return {
    id,
    groups: groups.map(([label, words], level) => ({ label, words: words.split('|'), level: level as Level })),
  };
}

export const POOL: LinkupPuzzle[] = [
  P('L001', ['Fruits', 'APPLE|MANGO|PEAR|PLUM'], ['Shades of blue', 'NAVY|TEAL|COBALT|AZURE'], ['Card games', 'SNAP|POKER|BRIDGE|RUMMY'], ['___ cake', 'CUP|PAN|CHEESE|SPONGE']),
  P('L002', ['Weather', 'RAIN|SNOW|HAIL|FOG'], ['Kitchen utensils', 'WHISK|LADLE|SPATULA|TONGS'], ['Chess pieces', 'KING|QUEEN|ROOK|BISHOP'], ['Hidden animals', 'SCATTER|BOWLING|DOGMA|BEARD']),
  P('L003', ['Planets', 'MARS|VENUS|SATURN|MERCURY'], ['Dog breeds', 'BEAGLE|POODLE|BOXER|HUSKY'], ['Things with strings', 'KITE|PUPPET|HARP|YO-YO'], ['___ bar', 'CROW|SAND|MINI|SALAD']),
  P('L004', ['Vegetables', 'CARROT|LEEK|ONION|CELERY'], ['Brass instruments', 'TRUMPET|TUBA|TROMBONE|BUGLE'], ['Units of time', 'SECOND|MINUTE|DECADE|CENTURY'], ['___ band', 'RUBBER|HEAD|WRIST|BOY']),
  P('L005', ['Ocean creatures', 'SHARK|WHALE|SQUID|OCTOPUS'], ['Royal titles', 'KING|EMPEROR|SULTAN|TSAR'], ['Racket sports', 'TENNIS|SQUASH|BADMINTON|PADEL'], ['___fish', 'STAR|SWORD|CAT|GOLD']),
  P('L006', ['Breakfast foods', 'TOAST|CEREAL|BACON|PORRIDGE'], ['Flowers', 'ROSE|TULIP|DAISY|LILY'], ['Board games', 'CHESS|CHECKERS|GO|BACKGAMMON'], ['Sound like letters', 'BEE|SEA|TEA|EYE']),
  P('L007', ['Colours of the rainbow', 'RED|ORANGE|YELLOW|VIOLET'], ['Trees', 'OAK|ASH|BIRCH|WILLOW'], ['Shapes', 'CIRCLE|SQUARE|TRIANGLE|HEXAGON'], ['___box', 'JUKE|SAND|SOAP|LUNCH']),
  P('L008', ['Joints', 'ELBOW|KNEE|ANKLE|WRIST'], ['Desserts', 'TRIFLE|MOUSSE|SUNDAE|CRUMBLE'], ['In the toolbox', 'HAMMER|WRENCH|CHISEL|PLIERS'], ['Hidden body parts', 'SHINE|CHIPS|SPEAR|CHARM']),
  P('L009', ['Birds', 'ROBIN|SPARROW|EAGLE|PIGEON'], ['Pasta shapes', 'PENNE|FUSILLI|RIGATONI|LINGUINE'], ['Up in the sky', 'CLOUD|RAINBOW|MOON|COMET'], ['___ball', 'FOOT|SNOW|EYE|MEAT']),
  P('L010', ['Currencies', 'EURO|DOLLAR|YEN|RUPEE'], ['Insects', 'BEETLE|WASP|MOTH|CRICKET'], ['On the beach', 'SAND|SHELL|TOWEL|PEBBLE'], ['___bug', 'LADY|BED|LITTER|JITTER']),
  P('L011', ['Music genres', 'JAZZ|BLUES|REGGAE|FOLK'], ['Spices', 'CUMIN|NUTMEG|PAPRIKA|SAFFRON'], ['Parts of a ship', 'HULL|MAST|DECK|RUDDER'], ['Hidden numbers', 'CANINE|OFTEN|STONE|WEIGHT']),
  P('L012', ['Australian animals', 'KANGAROO|KOALA|WOMBAT|PLATYPUS'], ['Cheeses', 'BRIE|CHEDDAR|GOUDA|FETA'], ['In your wallet', 'CASH|CARD|RECEIPT|COIN'], ['___ star', 'ROCK|POP|FILM|NORTH']),
  P('L013', ['Kitchen appliances', 'TOASTER|KETTLE|BLENDER|OVEN'], ['Gemstones', 'RUBY|EMERALD|SAPPHIRE|OPAL'], ['Rivers', 'NILE|AMAZON|DANUBE|THAMES'], ['Anagrams of POST', 'POTS|TOPS|SPOT|STOP']),
  P('L014', ['Footwear', 'BOOT|SANDAL|SLIPPER|SNEAKER'], ['Shades of red', 'CRIMSON|SCARLET|MAROON|RUBY'], ['Units of length', 'INCH|FOOT|YARD|MILE'], ['Things you can cast', 'SPELL|SHADOW|VOTE|NET']),
  P('L015', ['Citrus fruits', 'LEMON|LIME|ORANGE|GRAPEFRUIT'], ['Ballroom dances', 'WALTZ|TANGO|FOXTROT|SAMBA'], ['For writing or drawing', 'PEN|PENCIL|CRAYON|MARKER'], ['Radio alphabet code words', 'HOTEL|VICTOR|OSCAR|JULIET']),
  P('L016', ['In the garden', 'SHED|HOSE|LAWN|PATIO'], ['Big cats', 'TIGER|JAGUAR|LEOPARD|PUMA'], ['Have a shell', 'SNAIL|TORTOISE|EGG|OYSTER'], ['Sea ___', 'HORSE|WEED|LION|GULL']),
  P('L017', ['Vehicles', 'BUS|TRAIN|TRUCK|TRAM'], ['Herbs', 'BASIL|MINT|THYME|PARSLEY'], ['Things you can read', 'BOOK|MAP|PALM|LIPS'], ['___cap', 'KNEE|ICE|NIGHT|BOTTLE']),
  P('L018', ['Seasons', 'SPRING|SUMMER|AUTUMN|WINTER'], ['Breads', 'BAGEL|BAGUETTE|PITTA|BRIOCHE'], ['Have needles', 'PINE|CACTUS|COMPASS|HEDGEHOG'], ['___board', 'SKATE|CUP|CHALK|SURF']),
  P('L019', ['Farm animals', 'COW|SHEEP|GOAT|HEN'], ['In the bathroom', 'SINK|TOWEL|MIRROR|SHOWER'], ['Martial arts', 'JUDO|KARATE|KUNG FU|TAEKWONDO'], ['___tail', 'PONY|PIG|DOVE|FISH']),
  P('L020', ['Clothing', 'SHIRT|JACKET|SCARF|SOCK'], ['South American countries', 'PERU|CHILE|BRAZIL|ARGENTINA'], ['Things you can pitch', 'TENT|IDEA|BALL|STORY'], ['___ point', 'MATCH|VIEW|NEEDLE|GUN']),
  P('L021', ['Coffee drinks', 'LATTE|MOCHA|ESPRESSO|CAPPUCCINO'], ['Ways to cook', 'BAKE|ROAST|FRY|POACH'], ['Mountains', 'EVEREST|FUJI|KILIMANJARO|ETNA'], ['___boat', 'ROW|GRAVY|STEAM|HOUSE']),
  P('L022', ['Snakes', 'COBRA|PYTHON|VIPER|ADDER'], ['Sweet stuff', 'SUGAR|CANDY|SYRUP|TOFFEE'], ['In the bedroom', 'PILLOW|DUVET|WARDROBE|LAMP'], ['___moon', 'HALF|FULL|BLUE|HONEY']),
  P('L023', ['Stationery', 'STAPLER|ERASER|NOTEPAD|SCISSORS'], ['Rodents', 'HAMSTER|SQUIRREL|BEAVER|RAT'], ['Computer hardware', 'MONITOR|KEYBOARD|SPEAKER|MOUSE'], ['___room', 'MUSH|BALL|BATH|CLASS']),
  P('L024', ['Dairy', 'MILK|YOGURT|CREAM|CHEESE'], ['Units of weight', 'OUNCE|POUND|GRAM|TON'], ['They tick', 'CLOCK|METRONOME|TIMER|WATCH'], ['___fly', 'BUTTER|DRAGON|FIRE|HOUSE']),
  P('L025', ['Birds of prey', 'HAWK|FALCON|OWL|EAGLE'], ['Fabrics', 'COTTON|WOOL|DENIM|LINEN'], ['Have buttons', 'SHIRT|REMOTE|ELEVATOR|CALCULATOR'], ['___worm', 'BOOK|GLOW|EAR|SILK']),
  P('L026', ['Fast food', 'BURGER|PIZZA|FRIES|HOT DOG'], ['Jobs', 'DOCTOR|TEACHER|NURSE|PILOT'], ['Things you blow', 'BUBBLE|WHISTLE|KISS|NOSE'], ['Things you can draw', 'CURTAINS|BATH|SWORD|BREATH']),
  P('L027', ['Pets', 'RABBIT|GOLDFISH|HAMSTER|PARROT'], ['Art supplies', 'BRUSH|EASEL|CANVAS|PALETTE'], ['Very big', 'HUGE|VAST|GIANT|MASSIVE'], ['___walk', 'CAKE|MOON|SIDE|CAT']),
  P('L028', ['Cutlery', 'FORK|SPOON|KNIFE|CHOPSTICK'], ['Mythical creatures', 'DRAGON|UNICORN|GRIFFIN|PHOENIX'], ['Have pages', 'BOOK|DIARY|MAGAZINE|ATLAS'], ['___lift', 'FACE|SKI|SHOP|AIR']),
  P('L029', ['Car parts', 'ENGINE|WHEEL|BRAKE|BUMPER'], ['Fish we eat', 'SALMON|TUNA|COD|TROUT'], ['Happy', 'GLAD|MERRY|CHEERFUL|JOLLY'], ['Silent first letter', 'KNOT|KNEEL|KNACK|KNIT']),
  P('L030', ['Toys', 'DOLL|KITE|YO-YO|TEDDY'], ['In the desert', 'CACTUS|DUNE|OASIS|CAMEL'], ['Things you hatch', 'EGG|PLAN|PLOT|SCHEME'], ['___ fight', 'PILLOW|FOOD|FIST|DOG']),
  P('L031', ['Tableware', 'PLATE|BOWL|CUP|SAUCER'], ['Metals', 'IRON|COPPER|SILVER|ZINC'], ['Golf scores', 'PAR|BIRDIE|EAGLE|BOGEY'], ['___smith', 'BLACK|LOCK|WORD|GOLD']),
  P('L032', ['Ice cream flavours', 'VANILLA|CHOCOLATE|STRAWBERRY|PISTACHIO'], ['In a hospital', 'WARD|STRETCHER|SCALPEL|BANDAGE'], ['Punctuation', 'COMMA|COLON|HYPHEN|DASH'], ['Move fast', 'SPRINT|RACE|BOLT|ZOOM']),
  P('L033', ['Bodies of water', 'LAKE|POND|RIVER|OCEAN'], ['Hairstyles', 'BOB|BUN|BRAID|MOHAWK'], ['Computer keys', 'SPACE|SHIFT|ENTER|TAB'], ['Palindromes', 'KAYAK|LEVEL|RADAR|CIVIC']),
  P('L034', ['Birthday party', 'CAKE|CANDLES|BALLOONS|PRESENTS'], ['Large birds', 'OSTRICH|EMU|PELICAN|SWAN'], ['Things you can break', 'RECORD|PROMISE|SILENCE|NEWS'], ['___ party', 'HEN|TEA|SEARCH|BLOCK']),
  P('L035', ['String instruments', 'GUITAR|VIOLIN|CELLO|BANJO'], ['Out in space', 'GALAXY|NEBULA|ASTEROID|COMET'], ['Things that run', 'NOSE|TAP|ENGINE|MASCARA'], ['Rhymes with MOON', 'SPOON|TUNE|DUNE|JUNE']),
  P('L036', ['Green vegetables', 'BROCCOLI|SPINACH|KALE|CABBAGE'], ['Sports gear', 'RACKET|HELMET|NET|CLUB'], ['Nocturnal creatures', 'OWL|BAT|BADGER|MOTH'], ['___nut', 'PEA|DOUGH|CHEST|HAZEL']),
  P('L037', ['Bakery treats', 'CROISSANT|MUFFIN|SCONE|DOUGHNUT'], ['On wheels', 'BICYCLE|WAGON|SCOOTER|TROLLEY'], ['Things you fold', 'NAPKIN|ORIGAMI|LAUNDRY|MAP'], ['Hidden drinks', 'STEAK|COLANDER|POPLAR|CHAIR']),
  P('L038', ['Jungle animals', 'MONKEY|GORILLA|PARROT|TOUCAN'], ['First aid kit', 'PLASTER|GAUZE|TWEEZERS|ANTISEPTIC'], ['Kinds of tea', 'GREEN|MINT|CHAI|EARL GREY'], ['___bread', 'GINGER|SHORT|CORN|FLAT']),
  P('L039', ['Nuts', 'ALMOND|CASHEW|WALNUT|PECAN'], ['Cleaning kit', 'MOP|SPONGE|DUSTER|BUCKET'], ['A fight', 'BRAWL|SCUFFLE|CLASH|SCRAP'], ['___stick', 'CHOP|LIP|JOY|BROOM']),
  P('L040', ['Marine mammals', 'DOLPHIN|SEAL|WALRUS|OTTER'], ['Sticky', 'GLUE|TAPE|HONEY|GUM'], ['Things you tune', 'PIANO|RADIO|ENGINE|GUITAR'], ['Add B to the front', 'RAIN|LOOM|RUSH|LACK']),
  P('L041', ['Tropical fruits', 'PINEAPPLE|PAPAYA|COCONUT|GUAVA'], ['Hello', 'HI|HEY|HOWDY|GREETINGS'], ['Parts of a plant', 'PETAL|STEM|LEAF|ROOT'], ['___hood', 'CHILD|BROTHER|FALSE|KNIGHT']),
  P('L042', ['Furniture', 'SOFA|CHAIR|DRESSER|STOOL'], ['Big storms', 'BLIZZARD|TORNADO|HURRICANE|MONSOON'], ['Striped', 'ZEBRA|BARCODE|CANDY CANE|BUMBLEBEE'], ['___top', 'DESK|LAP|ROOF|TABLE']),
  P('L043', ['Things you send', 'LETTER|POSTCARD|EMAIL|MEMO'], ['Can sting', 'BEE|NETTLE|WASP|JELLYFISH'], ['Things you sharpen', 'PENCIL|KNIFE|AXE|CLAWS'], ['Hidden colours', 'BORED|STAND|GREYHOUND|STEAL']),
  P('L044', ['Camping kit', 'TENT|LANTERN|COMPASS|SLEEPING BAG'], ['Hats', 'BERET|FEDORA|BEANIE|BOWLER'], ['Electrical units', 'VOLT|WATT|AMP|OHM'], ['___fire', 'CAMP|BON|WILD|GUN']),
  P('L045', ['Grains', 'OATS|WHEAT|BARLEY|RICE'], ['Boats', 'YACHT|CANOE|FERRY|RAFT'], ['Party games', 'CHARADES|BINGO|SARDINES|TAG'], ['___ship', 'FRIEND|HARD|WAR|LEADER']),
  P('L046', ['Salty snacks', 'CHIPS|PRETZEL|CRACKER|NACHOS'], ['On the farm', 'TRACTOR|BARN|SILO|PLOUGH'], ['Things you crack', 'EGG|KNUCKLE|WHIP|CODE'], ['___corn', 'PEPPER|SWEET|CANDY|POP']),
  P('L047', ['European countries', 'FRANCE|SPAIN|ITALY|GREECE'], ['Shades of green', 'OLIVE|JADE|MINT|EMERALD'], ['Things you ride', 'WAVE|BIKE|HORSE|BUS'], ['___stone', 'MILE|KEY|HAIL|LIME']),
  P('L048', ['At the pond', 'FROG|DUCK|NEWT|REEDS'], ['Knitting', 'YARN|NEEDLE|PATTERN|STITCH'], ['Things you pull', 'STRINGS|LEG|MUSCLE|PRANK'], ['___pad', 'LILY|LAUNCH|NOTE|KEY']),
  P('L049', ['Soups', 'TOMATO|MINESTRONE|CHOWDER|BROTH'], ['Parts of a shoe', 'SOLE|HEEL|LACE|TONGUE'], ['Tired', 'WEARY|SLEEPY|DROWSY|DRAINED'], ['Also a fish', 'PERCH|BASS|CARP|PIKE']),
  P('L050', ['Primates', 'GORILLA|CHIMP|LEMUR|BABOON'], ['Parts of a book', 'CHAPTER|COVER|SPINE|PAGE'], ['Have blades', 'FAN|SKATE|KNIFE|HELICOPTER'], ['___ finger', 'LADY|FISH|RING|INDEX']),
  P('L051', ['Root vegetables', 'POTATO|TURNIP|RADISH|PARSNIP'], ['Music terms', 'TEMPO|CHORD|MELODY|RHYTHM'], ['Things that pop', 'CORK|BUBBLE|BALLOON|EARS'], ['___root', 'SQUARE|GRASS|TAP|BEET']),
  P('L052', ['Garden tools', 'RAKE|HOE|TROWEL|SHEARS'], ['At the seaside', 'CORAL|REEF|TIDE|WAVE'], ['Card suits', 'HEARTS|CLUBS|DIAMONDS|SPADES'], ['___breaker', 'ICE|JAW|TIE|LAW']),
  P('L053', ['Sweets', 'TOFFEE|FUDGE|LOLLIPOP|LICORICE'], ['Rooms', 'KITCHEN|ATTIC|CELLAR|HALLWAY'], ['Whodunnit', 'CLUE|SUSPECT|ALIBI|MOTIVE'], ['___paper', 'NEWS|SAND|WALL|TISSUE']),
  P('L054', ['Drinks', 'JUICE|COCOA|MILK|SMOOTHIE'], ['Winter wear', 'GLOVES|MITTENS|SCARF|EARMUFFS'], ['Have lids', 'JAR|BOX|EYE|KETTLE'], ['___pot', 'JACK|FLOWER|HONEY|TEA']),
  P('L055', ['Team sports', 'RUGBY|HOCKEY|NETBALL|BASEBALL'], ['Forest floor', 'MOSS|FERN|MUSHROOM|PINE CONE'], ['Things you catch', 'COLD|BUS|BREATH|FISH'], ['Black___', 'BOARD|BIRD|SMITH|MAIL']),
  P('L056', ['Dog commands', 'SIT|STAY|FETCH|HEEL'], ['Flowers', 'PANSY|POPPY|ORCHID|IRIS'], ['Parts of the eye', 'PUPIL|LENS|RETINA|CORNEA'], ['Rhymes with DAY', 'HAY|CLAY|TRAY|SLEIGH']),
  P('L057', ['Herbs', 'ROSEMARY|SAGE|OREGANO|DILL'], ['Woodwind', 'FLUTE|CLARINET|OBOE|SAXOPHONE'], ['Clever', 'BRIGHT|SHARP|SMART|ASTUTE'], ['___dust', 'STAR|SAW|GOLD|PIXIE']),
  P('L058', ['Berries', 'CRANBERRY|BLUEBERRY|RASPBERRY|GOOSEBERRY'], ['Cold-climate animals', 'POLAR BEAR|SEAL|PENGUIN|ARCTIC FOX'], ['At the gym', 'TREADMILL|DUMBBELL|YOGA MAT|BARBELL'], ['___bag', 'BEAN|TEA|SAND|HAND']),
  P('L059', ['Picnic', 'BLANKET|BASKET|SANDWICH|FLASK'], ['At the circus', 'CLOWN|ACROBAT|JUGGLER|TRAPEZE'], ['Have rings', 'TREE|SATURN|PHONE|ONION'], ['___man', 'SNOW|SAND|CAVE|MILK']),
  P('L060', ['Measuring tools', 'RULER|SCALE|THERMOMETER|PROTRACTOR'], ['Sauces', 'KETCHUP|MAYO|PESTO|GRAVY'], ['Dances', 'TANGO|WALTZ|POLKA|SALSA'], ['Have scales', 'FISH|PIANO|MAP|SNAKE']),
  P('L061', ['Baby animals', 'PUPPY|KITTEN|CALF|FOAL'], ['Celebrations', 'FEAST|FIESTA|GALA|BASH'], ['Shades of brown', 'TAN|BEIGE|KHAKI|FAWN'], ['Have tails', 'COIN|COMET|KITE|TUXEDO']),
  P('L062', ['Jewellery', 'NECKLACE|BRACELET|EARRING|BROOCH'], ['Shades of yellow', 'LEMON|GOLD|CANARY|SAFFRON'], ['Boxing', 'JAB|HOOK|UPPERCUT|RING'], ['___seed', 'MUSTARD|SESAME|POPPY|BIRD']),
  P('L063', ['Ways to travel', 'WALK|CYCLE|FLY|SAIL'], ['Races', 'SPRINT|MARATHON|RELAY|HURDLES'], ['Puzzles', 'JIGSAW|CROSSWORD|SUDOKU|RIDDLE'], ['Hidden vehicles', 'SCARF|BUSTLE|VANITY|CABIN']),
  P('L064', ['Stone fruits', 'CHERRY|PEACH|APRICOT|NECTARINE'], ['Percussion', 'DRUM|CYMBAL|XYLOPHONE|GONG'], ['Shapes', 'SQUARE|OVAL|DIAMOND|TRIANGLE'], ['Rhymes with SUM', 'THUMB|CRUMB|GUM|PLUM']),
  P('L065', ['Pizza toppings', 'PEPPERONI|MUSHROOM|OLIVE|HAM'], ['Get in touch', 'CALL|TEXT|LETTER|EMAIL'], ['Have tentacles', 'OCTOPUS|SQUID|JELLYFISH|ANEMONE'], ['___ ring', 'ONION|EAR|KEY|BOXING']),
  P('L066', ['Organs', 'HEART|LUNG|LIVER|BRAIN'], ['Shades of purple', 'LILAC|VIOLET|LAVENDER|MAUVE'], ['Things you trim', 'HEDGE|BEARD|NAILS|WICK'], ['___ bean', 'KIDNEY|JELLY|COFFEE|BROAD']),
  P('L067', ['Baking basics', 'FLOUR|SUGAR|EGGS|BUTTER'], ['Seashore creatures', 'CRAB|STARFISH|LIMPET|CLAM'], ['Things that flow', 'RIVER|LAVA|TRAFFIC|CONVERSATION'], ['Sound like body parts', 'HARE|KNOWS|HEAL|MUSSEL']),
  P('L068', ['Sports venues', 'STADIUM|ARENA|TRACK|RINK'], ['Weather', 'DRIZZLE|SLEET|THUNDER|MIST'], ['Royalty', 'CROWN|THRONE|SCEPTRE|COURT'], ['Hidden weather', 'BRAIN|SUNDAY|MISTAKE|WINDOW']),
  P('L069', ['Classroom', 'WHITEBOARD|DESK|TEXTBOOK|BACKPACK'], ['Flightless birds', 'OSTRICH|EMU|PENGUIN|DODO'], ['Fruits', 'KIWI|LYCHEE|FIG|DATE'], ['___case', 'BOOK|BRIEF|SUIT|PILLOW']),
  P('L070', ['At the playground', 'BENCH|SWING|FOUNTAIN|SANDPIT'], ['Shades of grey', 'SLATE|CHARCOAL|PEWTER|GRAPHITE'], ['Have screens', 'PHONE|TELEVISION|LAPTOP|TABLET'], ['___ show', 'SLIDE|ROAD|TALK|GAME']),
  P('L071', ['Cold things', 'SNOW|FROST|GLACIER|BLIZZARD'], ['Beach fun', 'SURFING|SNORKELLING|SUNBATHING|DIVING'], ['Winter sports', 'CURLING|HOCKEY|SKATING|BOBSLEIGH'], ['___ cream', 'ICE|SOUR|SHAVING|HAND']),
  P('L072', ['Aircraft', 'GLIDER|HELICOPTER|BLIMP|DRONE'], ['In the newspaper', 'HEADLINE|COLUMN|EDITORIAL|HOROSCOPE'], ['Leave', 'DEPART|EXIT|QUIT|SPLIT'], ['___stream', 'JET|MAIN|DOWN|GULF']),
  P('L073', ['Containers', 'CARTON|TUB|BUCKET|CRATE'], ['Animal sounds', 'MOO|OINK|HOOT|NEIGH'], ['Parts of a tree', 'ROOT|BRANCH|TRUNK|BARK'], ['Have necks', 'GUITAR|GIRAFFE|SHIRT|BOTTLE']),
  P('L074', ['Big animals', 'ELEPHANT|RHINO|HIPPO|GIRAFFE'], ['Eaten with a spoon', 'SOUP|CEREAL|YOGURT|CUSTARD'], ['Small', 'TINY|PETITE|MINI|WEE'], ['___horn', 'SHOE|FOG|BULL|GREEN']),
  P('L075', ['Salad', 'LETTUCE|TOMATO|RADISH|CELERY'], ['Dog breeds', 'COLLIE|LABRADOR|SPANIEL|TERRIER'], ['Things you roll', 'DICE|DOUGH|EYES|SLEEVES'], ['Ends of similes', 'CUCUMBER|FIDDLE|PANCAKE|FEATHER']),
  P('L076', ['Legwear', 'JEANS|SHORTS|LEGGINGS|TROUSERS'], ['Rainforest animals', 'SLOTH|TOUCAN|JAGUAR|ANACONDA'], ['Have pockets', 'POOL TABLE|APRON|KANGAROO|PITTA'], ['___drop', 'RAIN|DEW|NAME|EAVES']),
  P('L077', ['Potato dishes', 'HASH BROWN|MASH|GNOCCHI|JACKET'], ['Garden jobs', 'WEEDING|PRUNING|MOWING|PLANTING'], ['Shoes', 'LOAFER|CLOG|STILETTO|WEDGES'], ['___mill', 'WIND|SAW|TREAD|PEPPER']),
  P('L078', ['Bedtime', 'PYJAMAS|BLANKET|NIGHTLIGHT|TEDDY'], ['Exercises', 'SQUAT|LUNGE|PUSH-UP|PLANK'], ['Pirate gear', 'PARROT|TREASURE|EYEPATCH|CUTLASS'], ['___ talk', 'PILLOW|SMALL|PEP|BABY']),
  P('L079', ['Continents', 'AFRICA|ASIA|EUROPE|ANTARCTICA'], ['Singing voices', 'SOPRANO|ALTO|TENOR|BARITONE'], ['Fish', 'TROUT|HADDOCK|PIKE|BASS'], ['___pipe', 'BAG|DRAIN|BLOW|WIND']),
  P('L080', ['On your face', 'NOSE|CHIN|BROW|LIPS'], ['Shades of white', 'IVORY|CREAM|PEARL|LINEN'], ['Things you set', 'TABLE|ALARM|SUN|JELLY'], ['___bone', 'WISH|BACK|FUNNY|CHEEK']),
  P('L081', ['Garden birds', 'WREN|THRUSH|FINCH|ROBIN'], ['Luggage', 'SUITCASE|RUCKSACK|HOLDALL|DUFFEL'], ['Things that fly', 'TIME|KITE|SPARKS|FLAG'], ['Hidden birds', 'TOWEL|CROWD|LANTERN|SWANKY']),
  P('L082', ['Pans and pots', 'SAUCEPAN|WOK|SKILLET|CASSEROLE'], ['Shades of orange', 'CORAL|PEACH|AMBER|TANGERINE'], ['Parts of speech', 'NOUN|VERB|ADJECTIVE|ADVERB'], ['___fruit', 'STAR|PASSION|DRAGON|GRAPE']),
  P('L083', ['Small insects', 'FLY|BEE|GNAT|MOTH'], ['Goodbye', 'FAREWELL|BYE|ADIEU|CHEERIO'], ['Have eyes', 'STORM|NEEDLE|POTATO|PEACOCK'], ['___hill', 'MOLE|DOWN|UP|ANT']),
  P('L084', ['Winter activities', 'SKIING|SLEDGING|SKATING|CURLING'], ['Castle parts', 'MOAT|TOWER|KEEP|DRAWBRIDGE'], ['Things you hold', 'BREATH|GRUDGE|HANDS|TUNE'], ['___line', 'DEAD|PUNCH|SKY|CLOTHES']),
];
