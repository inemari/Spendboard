import {
  Anchor,
  Apple,
  Baby,
  Banknote,
  Bath,
  Bed,
  Beer,
  Bike,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  Cake,
  Calculator,
  Camera,
  Car,
  Carrot,
  Cigarette,
  Cloud,
  Coffee,
  CreditCard,
  Croissant,
  Dog,
  Droplet,
  Drumstick,
  Dumbbell,
  Film,
  Fish,
  Flame,
  Flower2,
  Footprints,
  Fuel,
  Gamepad2,
  Gift,
  Glasses,
  GraduationCap,
  Hammer,
  Heart,
  HeartPulse,
  Hospital,
  House,
  Key,
  Landmark,
  Laptop,
  Leaf,
  Lightbulb,
  Martini,
  Milk,
  Music,
  Newspaper,
  Package,
  Palette,
  PawPrint,
  PiggyBank,
  Pill,
  Pizza,
  Plane,
  Plug,
  Popcorn,
  Puzzle,
  Receipt,
  Recycle,
  Repeat,
  Rocket,
  Salad,
  School,
  Scissors,
  Server,
  Shapes,
  Shield,
  Ship,
  Shirt,
  ShoppingBag,
  ShoppingBasket,
  ShoppingCart,
  Smartphone,
  Snowflake,
  Sofa,
  Sparkles,
  SprayCan,
  Sprout,
  Stethoscope,
  Sun,
  Tag,
  Tent,
  Ticket,
  TrainFront,
  TreePine,
  Trophy,
  Truck,
  Tv,
  Umbrella,
  UtensilsCrossed,
  Wallet,
  Watch,
  Wifi,
  Wine,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * The icon a user can pin to one of their categories, shown in the overview's
 * "Where it went" sidebar.
 *
 * Keys are our own stable slugs, not lucide's export names: the slug is what
 * lands in `categories.icon` in the database, so renaming or swapping the
 * underlying lucide component (they do get renamed between major versions —
 * `CircleHelp` no longer exists in the version this app pins) must not
 * invalidate rows users already saved. An unknown or missing slug always
 * degrades to a guess-then-fallback (see `categoryIcon`) rather than rendering
 * nothing.
 */
export type CategoryIconKey = string;

const ICONS: Record<string, LucideIcon> = {
  // Food & drink
  "shopping-cart": ShoppingCart,
  "shopping-basket": ShoppingBasket,
  utensils: UtensilsCrossed,
  coffee: Coffee,
  wine: Wine,
  beer: Beer,
  martini: Martini,
  pizza: Pizza,
  cake: Cake,
  croissant: Croissant,
  salad: Salad,
  carrot: Carrot,
  apple: Apple,
  fish: Fish,
  drumstick: Drumstick,
  milk: Milk,

  // Home & bills
  house: House,
  sofa: Sofa,
  bed: Bed,
  bath: Bath,
  lightbulb: Lightbulb,
  plug: Plug,
  zap: Zap,
  flame: Flame,
  droplet: Droplet,
  wrench: Wrench,
  hammer: Hammer,
  recycle: Recycle,
  leaf: Leaf,
  sprout: Sprout,
  wifi: Wifi,
  server: Server,
  cloud: Cloud,

  // Getting around
  car: Car,
  bus: Bus,
  train: TrainFront,
  fuel: Fuel,
  plane: Plane,
  bike: Bike,
  truck: Truck,
  ship: Ship,
  anchor: Anchor,
  rocket: Rocket,
  package: Package,
  tent: Tent,
  "tree-pine": TreePine,

  // Health & care
  "heart-pulse": HeartPulse,
  stethoscope: Stethoscope,
  pill: Pill,
  hospital: Hospital,
  dumbbell: Dumbbell,
  scissors: Scissors,
  "spray-can": SprayCan,
  sparkles: Sparkles,
  flower: Flower2,
  glasses: Glasses,
  cigarette: Cigarette,

  // Fun & culture
  film: Film,
  music: Music,
  tv: Tv,
  gamepad: Gamepad2,
  ticket: Ticket,
  camera: Camera,
  palette: Palette,
  trophy: Trophy,
  puzzle: Puzzle,
  popcorn: Popcorn,
  "book-open": BookOpen,
  newspaper: Newspaper,

  // People & things
  shirt: Shirt,
  "shopping-bag": ShoppingBag,
  footprints: Footprints,
  watch: Watch,
  gift: Gift,
  heart: Heart,
  umbrella: Umbrella,
  sun: Sun,
  snowflake: Snowflake,
  baby: Baby,
  dog: Dog,
  "paw-print": PawPrint,
  smartphone: Smartphone,
  laptop: Laptop,

  // Money & work
  "credit-card": CreditCard,
  wallet: Wallet,
  banknote: Banknote,
  "piggy-bank": PiggyBank,
  landmark: Landmark,
  receipt: Receipt,
  calculator: Calculator,
  repeat: Repeat,
  briefcase: Briefcase,
  building: Building2,
  "graduation-cap": GraduationCap,
  school: School,
  shield: Shield,
  key: Key,
  tag: Tag,
  shapes: Shapes,
};

/** Picker layout: the same slugs as `ICONS`, grouped so a user scans a short
 *  labelled block rather than one undifferentiated wall of 100 glyphs. */
export const CATEGORY_ICON_GROUPS: { label: string; keys: string[] }[] = [
  {
    label: "Food & drink",
    keys: [
      "shopping-cart", "shopping-basket", "utensils", "coffee", "wine", "beer", "martini",
      "pizza", "cake", "croissant", "salad", "carrot", "apple", "fish", "drumstick", "milk",
    ],
  },
  {
    label: "Home & bills",
    keys: [
      "house", "sofa", "bed", "bath", "lightbulb", "plug", "zap", "flame", "droplet",
      "wrench", "hammer", "recycle", "leaf", "sprout", "wifi", "server", "cloud",
    ],
  },
  {
    label: "Getting around",
    keys: [
      "car", "bus", "train", "fuel", "plane", "bike", "truck", "ship", "anchor", "rocket",
      "package", "tent", "tree-pine",
    ],
  },
  {
    label: "Health & care",
    keys: [
      "heart-pulse", "stethoscope", "pill", "hospital", "dumbbell", "scissors", "spray-can",
      "sparkles", "flower", "glasses", "cigarette",
    ],
  },
  {
    label: "Fun & culture",
    keys: [
      "film", "music", "tv", "gamepad", "ticket", "camera", "palette", "trophy", "puzzle",
      "popcorn", "book-open", "newspaper",
    ],
  },
  {
    label: "People & things",
    keys: [
      "shirt", "shopping-bag", "footprints", "watch", "gift", "heart", "umbrella", "sun",
      "snowflake", "baby", "dog", "paw-print", "smartphone", "laptop",
    ],
  },
  {
    label: "Money & work",
    keys: [
      "credit-card", "wallet", "banknote", "piggy-bank", "landmark", "receipt", "calculator",
      "repeat", "briefcase", "building", "graduation-cap", "school", "shield", "key", "tag",
      "shapes",
    ],
  },
];

/** What a category with no icon of its own falls back to. */
export const FALLBACK_CATEGORY_ICON = Tag;

/**
 * Name → icon guesses, for categories created before icons existed (and for
 * pre-filling the picker when someone types a name it recognizes). Matched as
 * substrings against the lowercased name padded with spaces, first hit wins,
 * so the more specific entries have to come first — "matbutikk" before "mat",
 * "billett" before "bil". Short needles that are also the start of an unrelated
 * word carry their own spaces (`" bar "`, not `"bar"`, or "Barnetøy" would come
 * back as a beer glass); the padding is what makes those anchor to the whole
 * name. Norwegian and English side by side, since the app's own default
 * categories are English but real users here name theirs in Norwegian.
 */
const NAME_HINTS: [needle: string, key: string][] = [
  ["matbutikk", "shopping-cart"],
  ["dagligvare", "shopping-cart"],
  ["grocer", "shopping-cart"],
  [" mat ", "utensils"],
  ["restaurant", "utensils"],
  ["dining", "utensils"],
  ["takeaway", "pizza"],
  ["kafe", "coffee"],
  ["café", "coffee"],
  ["coffee", "coffee"],
  ["kaffe", "coffee"],
  ["alkohol", "wine"],
  ["vinmono", "wine"],
  [" bar ", "beer"],
  ["bolig", "house"],
  ["hus", "house"],
  ["hjem", "house"],
  ["hjemme", "house"],
  ["housing", "house"],
  ["rent", "house"],
  ["husleie", "house"],
  ["home", "house"],
  ["møbler", "sofa"],
  ["furniture", "sofa"],
  ["strøm", "zap"],
  ["electric", "zap"],
  ["utilit", "zap"],
  ["billett", "ticket"],
  ["transport", "car"],
  [" bil", "car"],
  [" car", "car"],
  ["buss", "bus"],
  ["bus", "bus"],
  [" tog ", "train"],
  ["train", "train"],
  ["bensin", "fuel"],
  ["drivstoff", "fuel"],
  ["fuel", "fuel"],
  ["reise", "plane"],
  ["travel", "plane"],
  ["ferie", "plane"],
  ["fly", "plane"],
  ["sykkel", "bike"],
  ["helse", "heart-pulse"],
  ["health", "heart-pulse"],
  ["lege", "stethoscope"],
  ["apotek", "pill"],
  ["pharmac", "pill"],
  ["trening", "dumbbell"],
  ["gym", "dumbbell"],
  ["fitness", "dumbbell"],
  ["frisør", "scissors"],
  ["hår", "scissors"],
  ["hud", "spray-can"],
  ["pleie", "sparkles"],
  ["care", "sparkles"],
  ["beauty", "sparkles"],
  ["kino", "film"],
  ["film", "film"],
  ["movie", "film"],
  ["musikk", "music"],
  ["music", "music"],
  ["spill", "gamepad"],
  ["game", "gamepad"],
  ["underhold", "popcorn"],
  ["entertain", "popcorn"],
  ["bok", "book-open"],
  ["book", "book-open"],
  ["klær", "shirt"],
  ["cloth", "shirt"],
  [" sko ", "footprints"],
  ["shoe", "footprints"],
  ["shopping", "shopping-bag"],
  ["gave", "gift"],
  ["gift", "gift"],
  ["barn", "baby"],
  ["kid", "baby"],
  ["baby", "baby"],
  ["kjæledyr", "paw-print"],
  ["pet", "paw-print"],
  ["hund", "dog"],
  ["mobil", "smartphone"],
  ["telefon", "smartphone"],
  ["phone", "smartphone"],
  ["abonnement", "repeat"],
  ["subscription", "repeat"],
  ["strømming", "tv"],
  ["streaming", "tv"],
  ["forsikring", "shield"],
  ["insurance", "shield"],
  ["sparing", "piggy-bank"],
  ["saving", "piggy-bank"],
  ["lån", "landmark"],
  ["loan", "landmark"],
  ["bank", "landmark"],
  ["skatt", "receipt"],
  ["tax", "receipt"],
  ["regning", "receipt"],
  ["bill", "receipt"],
  ["jobb", "briefcase"],
  ["work", "briefcase"],
  ["skole", "school"],
  ["school", "school"],
  ["studie", "graduation-cap"],
  ["annet", "shapes"],
  ["other", "shapes"],
  ["diverse", "shapes"],
];

/** The icon a category with no saved icon should show, guessed from its name.
 *  Null when nothing matches — the caller falls back to the generic tag. */
export function guessCategoryIconKey(name: string): string | null {
  const haystack = ` ${name.toLowerCase().trim()} `;
  for (const [needle, key] of NAME_HINTS) {
    if (haystack.includes(needle)) return key;
  }
  return null;
}

/**
 * Resolve what to actually render for a category: its own saved icon, else a
 * guess from its name (so categories that predate this feature aren't all
 * identical grey tags), else the generic tag.
 */
export function categoryIcon(icon: string | null | undefined, name?: string): LucideIcon {
  if (icon && ICONS[icon]) return ICONS[icon];
  if (name) {
    const guessed = guessCategoryIconKey(name);
    if (guessed) return ICONS[guessed];
  }
  return FALLBACK_CATEGORY_ICON;
}

/** Strict lookup for the picker itself, which only ever holds real keys. */
export function iconForKey(key: string): LucideIcon {
  return ICONS[key] ?? FALLBACK_CATEGORY_ICON;
}
