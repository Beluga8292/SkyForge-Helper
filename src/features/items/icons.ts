export type ItemIconKind =
  | "sword"
  | "bow"
  | "helmet"
  | "chestplate"
  | "leggings"
  | "boots"
  | "pickaxe"
  | "drill"
  | "axe"
  | "shovel"
  | "fishing-rod"
  | "gem"
  | "potion"
  | "book"
  | "pet"
  | "coin"
  | "essence"
  | "potato"
  | "backpack"
  | "accessory"
  | "block"
  | "food"
  | "tool"
  | "misc";

export interface ItemIconInput {
  itemId?: string | null;
  material?: string | null;
  category?: string | null;
}

const CATEGORY_ICONS: Record<string, ItemIconKind> = {
  SWORD: "sword",
  LONGSWORD: "sword",
  BOW: "bow",
  AXE: "axe",
  PICKAXE: "pickaxe",
  DRILL: "drill",
  SHOVEL: "shovel",
  "FISHING ROD": "fishing-rod",
  "FISHING WEAPON": "fishing-rod",
  HELMET: "helmet",
  CHESTPLATE: "chestplate",
  LEGGINGS: "leggings",
  BOOTS: "boots",
  GAUNTLET: "tool",
  GLOVES: "tool",
  BELT: "accessory",
  NECKLACE: "accessory",
  BRACELET: "accessory",
  CLOAK: "accessory",
  ACCESSORY: "accessory",
  PET_ITEM: "pet",
  "PET ITEM": "pet",
  BLOCK: "block",
  "FARMING TOOL": "tool",
  "TRAVEL SCROLL": "book",
  "DUNGEON PASS": "book",
  "COSMETIC": "misc",
};

const ID_RULES: Array<[RegExp, ItemIconKind]> = [
  [/(^|_)ESSENCE($|_)/, "essence"],
  [/(_GEM$|_GEM_|GEMSTONE|_CRYSTAL$)/, "gem"],
  [/(^|_)COIN(S)?($|_)|^SKYBLOCK_COIN$/, "coin"],
  [/(POTATO|CARROT|WHEAT|SEEDS|MUSHROOM|COCOA|CACTUS|SUGAR_CANE|NETHER_WART|PUMPKIN|MELON)/, "food"],
  [/(COOKIE|BREAD|CAKE|PIE|STEAK|PORK|CHICKEN|MUTTON|RABBIT|FISH|SALMON|CLOWNFISH)/, "food"],
  [/(POTION|ELIXIR|FLASK|TONIC)/, "potion"],
  [/(ENCHANTED_BOOK|_BOOK$|^BOOK|TRAVEL_SCROLL|SCROLL)/, "book"],
  [/(BACKPACK|SACK|BAG$|CHEST)/, "backpack"],
  [/(RING|TALISMAN|ARTIFACT|RELIC|NECKLACE|BRACELET|CLOAK|BELT|GLOVES)/, "accessory"],
  [/(PET|GRIFFIN|DRAGON|WHALE|YETI|SCATHA|BLAZE|ENDERMAN|SPIDER|WOLF)/, "pet"],
  [/(DRILL)/, "drill"],
  [/(PICKAXE|PICK)/, "pickaxe"],
  [/(SHOVEL|SPADE)/, "shovel"],
  [/(AXE)/, "axe"],
  [/(SWORD|BLADE|KATANA|SCYTHE|DAGGER|CLEAVER|FALCHION)/, "sword"],
  [/(BOW|ARROW|SHORTBOW|LONGBOW)/, "bow"],
  [/(ROD|REEL)/, "fishing-rod"],
  [/(HELMET|CROWN|MASK|HOOD|HAT)/, "helmet"],
  [/(CHESTPLATE|TUNIC|SHIRT|BODY)/, "chestplate"],
  [/(LEGGINGS|PANTS|TROUSERS|GREAVES)/, "leggings"],
  [/(BOOTS|SANDALS|SLIPPERS)/, "boots"],
  [/(ORE|INGOT|DIAMOND|EMERALD|GOLD|IRON|MITHRIL|TITANIUM|NETHERITE|COBBLESTONE|STONE|LOG|WOOD)/, "block"],
  [/(STICK|WAND|STAFF|HAMMER|CHISEL|SHEARS|FLINT|COMPASS|CLOCK|MAP|TOOL)/, "tool"],
];

const MATERIAL_ICONS: Array<[RegExp, ItemIconKind]> = [
  [/SWORD/, "sword"],
  [/BOW/, "bow"],
  [/HELMET|SKULL/, "helmet"],
  [/CHESTPLATE/, "chestplate"],
  [/LEGGINGS/, "leggings"],
  [/BOOTS/, "boots"],
  [/PICKAXE/, "pickaxe"],
  [/SHOVEL/, "shovel"],
  [/AXE/, "axe"],
  [/FISHING_ROD/, "fishing-rod"],
  [/DIAMOND|EMERALD|GOLD|IRON|NETHERITE|QUARTZ|AMETHYST|LAPIS|REDSTONE|COAL/, "gem"],
  [/POTION|GLASS_BOTTLE/, "potion"],
  [/BOOK/, "book"],
  [/POTATO|CARROT|WHEAT|BREAD|COOKIE|APPLE|MELON|PUMPKIN/, "food"],
  [/CHEST|SHULKER_BOX/, "backpack"],
];

function matchRules(rules: Array<[RegExp, ItemIconKind]>, value: string): ItemIconKind | null {
  for (const [pattern, kind] of rules) {
    if (pattern.test(value)) return kind;
  }
  return null;
}

/**
 * Maps a SkyBlock item to a hand-authored sprite family. The mapping is
 * intentionally conservative: unknown items fall back to a neutral glyph
 * instead of pretending to be a specific texture.
 */
export function iconForItem(input: ItemIconInput): ItemIconKind | null {
  const category = input.category?.trim().toUpperCase();
  if (category && CATEGORY_ICONS[category]) return CATEGORY_ICONS[category]!;

  const id = input.itemId?.trim().toUpperCase();
  if (id) {
    const byId = matchRules(ID_RULES, id);
    if (byId) return byId;
  }

  const material = input.material?.trim().toUpperCase();
  if (material) {
    const byMaterial = matchRules(MATERIAL_ICONS, material);
    if (byMaterial) return byMaterial;
  }

  if (category || id || material) return "misc";
  return null;
}

/** Stable label for accessibility and tests. */
export function iconKindLabel(kind: ItemIconKind | null): string {
  if (!kind) return "item";
  return kind.replace("-", " ");
}
