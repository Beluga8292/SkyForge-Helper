/**
 * Turns Hypixel item / bazaar ids into readable names.
 * `ENCHANTED_DIAMOND` -> `Enchanted Diamond`, `INK_SACK:3` -> `Ink Sack: 3`.
 * A curated set of overrides covers ids that are not plain English.
 */
const OVERRIDES: Record<string, string> = {
  ENCHANTED_DIAMOND: "Enchanted Diamond",
  ENCHANTED_GOLD: "Enchanted Gold",
  ENCHANTED_GOLD_BLOCK: "Enchanted Gold Block",
  ENCHANTED_IRON: "Enchanted Iron",
  ENCHANTED_IRON_BLOCK: "Enchanted Iron Block",
  ENCHANTED_LAPIS_LAZULI: "Enchanted Lapis Lazuli",
  ENCHANTED_LAPIS_LAZULI_BLOCK: "Enchanted Lapis Lazuli Block",
  ENCHANTED_REDSTONE: "Enchanted Redstone",
  ENCHANTED_REDSTONE_BLOCK: "Enchanted Redstone Block",
  ENCHANTED_EMERALD: "Enchanted Emerald",
  ENCHANTED_EMERALD_BLOCK: "Enchanted Emerald Block",
  ENCHANTED_COAL: "Enchanted Coal",
  ENCHANTED_CHARCOAL: "Enchanted Charcoal",
  ENCHANTED_COAL_BLOCK: "Enchanted Coal Block",
  ENCHANTED_QUARTZ: "Enchanted Quartz",
  ENCHANTED_QUARTZ_BLOCK: "Enchanted Quartz Block",
  ENCHANTED_GLOWSTONE_DUST: "Enchanted Glowstone Dust",
  ENCHANTED_GLOWSTONE: "Enchanted Glowstone",
  ENCHANTED_HOPPER: "Enchanted Hopper",
  ENCHANTED_LAVA_BUCKET: "Enchanted Lava Bucket",
  ENCHANTED_WATER_LILY: "Enchanted Water Lily",
  ENCHANTED_CACTUS_GREEN: "Enchanted Cactus Green",
  ENCHANTED_BAKED_POTATO: "Enchanted Baked Potato",
  ENCHANTED_POTATO: "Enchanted Potato",
  ENCHANTED_CARROT: "Enchanted Carrot",
  ENCHANTED_CARROT_STICK: "Enchanted Carrot on a Stick",
  ENCHANTED_HAY_BLOCK: "Enchanted Hay Bale",
  ENCHANTED_HAY: "Enchanted Hay Bale",
  ENCHANTED_MELON: "Enchanted Melon",
  ENCHANTED_MELON_BLOCK: "Enchanted Melon Block",
  ENCHANTED_PUMPKIN: "Enchanted Pumpkin",
  ENCHANTED_SEEDS: "Enchanted Seeds",
  ENCHANTED_COCOA: "Enchanted Cocoa Beans",
  ENCHANTED_NETHER_STALK: "Enchanted Nether Wart",
  ENCHANTED_BROWN_MUSHROOM: "Enchanted Brown Mushroom",
  ENCHANTED_RED_MUSHROOM: "Enchanted Red Mushroom",
  ENCHANTED_BROWN_MUSHROOM_BLOCK: "Enchanted Brown Mushroom Block",
  ENCHANTED_RED_MUSHROOM_BLOCK: "Enchanted Red Mushroom Block",
  ENCHANTED_SAND: "Enchanted Sand",
  ENCHANTED_CLAY_BALL: "Enchanted Clay",
  ENCHANTED_FLINT: "Enchanted Flint",
  ENCHANTED_OBSIDIAN: "Enchanted Obsidian",
  ENCHANTED_ICE: "Enchanted Ice",
  ENCHANTED_SNOW_BLOCK: "Enchanted Snow Block",
  ENCHANTED_PACKED_ICE: "Enchanted Packed Ice",
  ENCHANTED_STRING: "Enchanted String",
  ENCHANTED_SPIDER_EYE: "Enchanted Spider Eye",
  ENCHANTED_FERMENTED_SPIDER_EYE: "Enchanted Fermented Spider Eye",
  ENCHANTED_ROTTEN_FLESH: "Enchanted Rotten Flesh",
  ENCHANTED_BONE: "Enchanted Bone",
  ENCHANTED_GUNPOWDER: "Enchanted Gunpowder",
  ENCHANTED_SLIME_BALL: "Enchanted Slimeball",
  ENCHANTED_SLIME_BLOCK: "Enchanted Slime Block",
  ENCHANTED_ENDER_PEARL: "Enchanted Ender Pearl",
  ENCHANTED_EYE_OF_ENDER: "Enchanted Eye of Ender",
  ENCHANTED_BLAZE_POWDER: "Enchanted Blaze Powder",
  ENCHANTED_BLAZE_ROD: "Enchanted Blaze Rod",
  ENCHANTED_MAGMA_CREAM: "Enchanted Magma Cream",
  ENCHANTED_GHAST_TEAR: "Enchanted Ghast Tear",
  ENCHANTED_SUGAR: "Enchanted Sugar",
  ENCHANTED_SUGAR_CANE: "Enchanted Sugar Cane",
  ENCHANTED_BOOK: "Enchanted Book",
  ENCHANTED_PAPER: "Enchanted Paper",
  ENCHANTED_LEATHER: "Enchanted Leather",
  ENCHANTED_RABBIT_HIDE: "Enchanted Rabbit Hide",
  ENCHANTED_RABBIT_FOOT: "Enchanted Rabbit Foot",
  ENCHANTED_FEATHER: "Enchanted Feather",
  ENCHANTED_WOOL: "Enchanted Wool",
  ENCHANTED_MUTTON: "Enchanted Mutton",
  ENCHANTED_PORK: "Enchanted Pork",
  ENCHANTED_CHICKEN: "Enchanted Chicken",
  ENCHANTED_RAW_FISH: "Enchanted Raw Fish",
  ENCHANTED_COOKED_FISH: "Enchanted Cooked Fish",
  ENCHANTED_PRISMARINE_SHARD: "Enchanted Prismarine Shard",
  ENCHANTED_PRISMARINE_CRYSTALS: "Enchanted Prismarine Crystals",
  ENCHANTED_CLOWNFISH: "Enchanted Clownfish",
  ENCHANTED_PUFFERFISH: "Enchanted Pufferfish",
  ENCHANTED_SPONGE: "Enchanted Sponge",
  ENCHANTED_WET_SPONGE: "Enchanted Wet Sponge",
  ENCHANTED_BIRCH_WOOD: "Enchanted Birch Wood",
  ENCHANTED_OAK_WOOD: "Enchanted Oak Wood",
  ENCHANTED_SPRUCE_WOOD: "Enchanted Spruce Wood",
  ENCHANTED_DARK_OAK_WOOD: "Enchanted Dark Oak Wood",
  ENCHANTED_ACACIA_WOOD: "Enchanted Acacia Wood",
  ENCHANTED_JUNGLE_WOOD: "Enchanted Jungle Wood",
  ENCHANTED_BIRCH_LOG: "Enchanted Birch Log",
  ENCHANTED_OAK_LOG: "Enchanted Oak Log",
  ENCHANTED_SPRUCE_LOG: "Enchanted Spruce Log",
  ENCHANTED_DARK_OAK_LOG: "Enchanted Dark Oak Log",
  ENCHANTED_ACACIA_LOG: "Enchanted Acacia Log",
  ENCHANTED_JUNGLE_LOG: "Enchanted Jungle Log",
  BOOSTER_COOKIE: "Booster Cookie",
  STOCK_OF_STONKS: "Stock of Stonks",
  HYPERION: "Hyperion",
  NECRON_HANDLE: "Necron's Handle",
  WITHER_SCROLL: "Wither Scroll",
  IMPLOSION_SCROLL: "Implosion Scroll",
  SHADOW_WARP_SCROLL: "Shadow Warp Scroll",
  FROZEN_SCYTHE: "Frozen Scythe",
  ASPECT_OF_THE_END: "Aspect of the End",
  ASPECT_OF_THE_DRAGON: "Aspect of the Dragons",
  GIANTS_SWORD: "Giant's Sword",
  MIDAS_STAFF: "Midas Staff",
  MIDAS_SWORD: "Midas' Sword",
  ATOMSPLIT_KATANA: "Atomsplit Katana",
  JUJU_SHORTBOW: "Juju Shortbow",
  TERMINATOR: "Terminator",
  DARK_CLAYMORE: "Dark Claymore",
  NECRONS_BLADE: "Necron's Blade",
  NECRONS_HANDLE: "Necron's Handle",
  ELEGANT_TUXEDO_CHESTPLATE: "Elegant Tuxedo Jacket",
  ELEGANT_TUXEDO_LEGGINGS: "Elegant Tuxedo Pants",
  TUXEDO_CHESTPLATE: "Tuxedo Jacket",
  TUXEDO_LEGGINGS: "Tuxedo Pants",
  RABBIT_HAT: "Rabbit Hat",
  COW_HAT: "Cow Hat",
  BAT_PERSON: "Bat Person",
  SNOW_SUIT: "Snow Suit",
  FARM_ARMOR: "Farm Armor",
  FARM_ARMOR_CHESTPLATE: "Farm Armor Chestplate",
  FARM_ARMOR_LEGGINGS: "Farm Armor Leggings",
  FARM_ARMOR_BOOTS: "Farm Armor Boots",
  RANCHERS_BOOTS: "Rancher's Boots",
  YOUNG_DRAGON: "Young Dragon",
  YOUNG_DRAGON_CHESTPLATE: "Young Dragon Chestplate",
  YOUNG_DRAGON_LEGGINGS: "Young Dragon Leggings",
  YOUNG_DRAGON_BOOTS: "Young Dragon Boots",
  SUPERIOR_DRAGON: "Superior Dragon",
  SUPERIOR_DRAGON_CHESTPLATE: "Superior Dragon Chestplate",
  SUPERIOR_DRAGON_LEGGINGS: "Superior Dragon Leggings",
  SUPERIOR_DRAGON_BOOTS: "Superior Dragon Boots",
  STRONG_DRAGON: "Strong Dragon",
  STRONG_DRAGON_CHESTPLATE: "Strong Dragon Chestplate",
  STRONG_DRAGON_LEGGINGS: "Strong Dragon Leggings",
  STRONG_DRAGON_BOOTS: "Strong Dragon Boots",
  WISE_DRAGON: "Wise Dragon",
  WISE_DRAGON_CHESTPLATE: "Wise Dragon Chestplate",
  WISE_DRAGON_LEGGINGS: "Wise Dragon Leggings",
  WISE_DRAGON_BOOTS: "Wise Dragon Boots",
  UNSTABLE_DRAGON: "Unstable Dragon",
  UNSTABLE_DRAGON_CHESTPLATE: "Unstable Dragon Chestplate",
  UNSTABLE_DRAGON_LEGGINGS: "Unstable Dragon Leggings",
  UNSTABLE_DRAGON_BOOTS: "Unstable Dragon Boots",
  HOLY_DRAGON: "Holy Dragon",
  OLD_DRAGON: "Old Dragon",
  PROTECTOR_DRAGON: "Protector Dragon",
  ENCHANTED_DIAMOND_BLOCK: "Enchanted Diamond Block",
  DIAMOND_BLOCK: "Block of Diamond",
  GOLD_BLOCK: "Block of Gold",
  IRON_BLOCK: "Block of Iron",
  EMERALD_BLOCK: "Block of Emerald",
  LAPIS_BLOCK: "Block of Lapis Lazuli",
  REDSTONE_BLOCK: "Block of Redstone",
  COAL_BLOCK: "Block of Coal",
  QUARTZ_BLOCK: "Block of Quartz",
  HAY_BLOCK: "Hay Bale",
  SLIME_BLOCK: "Slime Block",
  INK_SACK: "Ink Sac",
  "INK_SACK:3": "Cocoa Beans",
  "INK_SACK:4": "Lapis Lazuli",
};

const TITLE_EXCEPTIONS: Record<string, string> = {
  of: "of",
  the: "the",
  and: "and",
  a: "a",
  an: "an",
  to: "to",
  on: "on",
  in: "in",
  for: "for",
  with: "with",
};

export function prettifyItemId(id: string): string {
  const override = OVERRIDES[id.toUpperCase()];
  if (override) return override;

  const [rawBase, rawExtra] = id.split(":");
  const base = (rawBase ?? id).toLowerCase();
  const words = base
    .split("_")
    .filter(Boolean)
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && TITLE_EXCEPTIONS[lower]) return lower;
      if (lower === "npcs") return "NPCs";
      if (/^\d+$/.test(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    });

  let name = words.join(" ");
  if (rawExtra) {
    const extra = rawExtra
      .split("_")
      .map((part) => (part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()))
      .join(" ");
    name = `${name}: ${extra}`;
  }
  return name;
}

const GAME_MODE_LABELS: Record<string, string> = {
  normal: "Normal",
  ironman: "Ironman",
  stranded: "Stranded",
  bingo: "Bingo",
  unknown: "—",
};

export function gameModeLabel(mode: string | null | undefined): string {
  if (!mode) return GAME_MODE_LABELS.normal!;
  return GAME_MODE_LABELS[mode] ?? mode;
}

const SLAYER_NAMES: Record<string, string> = {
  zombie: "Revenant Horror",
  spider: "Tarantula Broodfather",
  wolf: "Sven Packmaster",
  enderman: "Voidgloom Seraph",
  blaze: "Inferno Demonlord",
  vampire: "Riftstalker Bloodfiend",
};

export function slayerName(id: string): string {
  return SLAYER_NAMES[id] ?? prettifyItemId(id);
}

const SKILL_NAMES: Record<string, string> = {
  farming: "Farming",
  mining: "Mining",
  combat: "Combat",
  foraging: "Foraging",
  fishing: "Fishing",
  enchanting: "Enchanting",
  alchemy: "Alchemy",
  carpentry: "Carpentry",
  runecrafting: "Runecrafting",
  social: "Social",
  taming: "Taming",
  hunting: "Hunting",
  dungeoneering: "Dungeoneering",
};

export function skillNameFromKey(key: string): string {
  const clean = key.replace(/^SKILL_/, "").toLowerCase();
  return SKILL_NAMES[clean] ?? prettifyItemId(clean);
}

const PET_NAMES: Record<string, string> = {
  ENDER_DRAGON: "Ender Dragon",
  GOLDEN_DRAGON: "Golden Dragon",
  BABY_YETI: "Baby Yeti",
  BLACK_CAT: "Black Cat",
  BLUE_WHALE: "Blue Whale",
  TIGER: "Tiger",
  LION: "Lion",
  GRIFFIN: "Griffin",
  WITHER_SKELETON: "Wither Skeleton",
  SNOWMAN: "Snowman",
  SPIRIT: "Spirit",
  MAMMOTH: "Mammoth",
  AMBROSE: "Ambrose",
  JELLYFISH: "Jellyfish",
  BAL: "Bal",
  ROCK: "Rock",
  SCATHA: "Scatha",
  MEGALODON: "Megalodon",
  RAT: "Rat",
  PARROT: "Parrot",
  SHEEP: "Sheep",
  COW: "Cow",
  CHICKEN: "Chicken",
  PIG: "Pig",
  RABBIT: "Rabbit",
  HORSE: "Horse",
  BEE: "Bee",
  ENDERMAN: "Enderman",
  ZOMBIE: "Zombie",
  SKELETON: "Skeleton",
  SPIDER: "Spider",
  WOLF: "Wolf",
  OCELOT: "Ocelot",
  BLAZE: "Blaze",
  MAGMA_CUBE: "Magma Cube",
  GHAST: "Ghast",
  GUARDIAN: "Guardian",
  SQUID: "Squid",
  DOLPHIN: "Dolphin",
  TURTLE: "Turtle",
  PHOENIX: "Phoenix",
  GRANDMA_WOLF: "Grandma Wolf",
  MITHRIL_GOLEM: "Mithril Golem",
  ROSE_DRAGON: "Rose Dragon",
  HEDGEHOG: "Hedgehog",
  ARMADILLO: "Armadillo",
  MONKEY: "Monkey",
  ELEPHANT: "Elephant",
  MOOSHROOM_COW: "Mooshroom Cow",
  BAT: "Bat",
};

export function petName(type: string): string {
  return PET_NAMES[type.toUpperCase()] ?? prettifyItemId(type);
}
