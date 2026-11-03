import type { AuctionsResponse, BazaarProduct, BazaarResponse, HypixelAuction } from "@/types/hypixel";
import type {
  DecodedInventoryItem,
  NormalizedPlayer,
  NormalizedProfile,
  ProfileMemberStats,
  SkillProgress,
} from "@/types/profile";

/**
 * DEMO DATA — every object produced here is fictional and must only be shown
 * while `settings.demoMode` is enabled. The UI renders a persistent DEMO MODE
 * banner and never writes demo values into market history or the cache.
 */

const SKILLS: Array<[string, string, number, number, number, number]> = [
  // id, name, level, max, progress, xp
  ["FARMING", "Farming", 42, 60, 0.62, 28_450_000],
  ["MINING", "Mining", 51, 60, 0.34, 96_300_000],
  ["COMBAT", "Combat", 48, 60, 0.71, 65_200_000],
  ["FORAGING", "Foraging", 31, 57, 0.18, 4_120_000],
  ["FISHING", "Fishing", 27, 50, 0.45, 2_310_000],
  ["ENCHANTING", "Enchanting", 60, 60, 1, 420_000_000],
  ["ALCHEMY", "Alchemy", 50, 50, 1, 86_000_000],
  ["CARPENTRY", "Carpentry", 32, 50, 0.5, 330_000],
  ["RUNECRAFTING", "Runecrafting", 22, 25, 0.35, 14_500],
  ["SOCIAL", "Social", 18, 25, 0.2, 9_400],
  ["TAMING", "Taming", 55, 60, 0.42, 210_000_000],
  ["HUNTING", "Hunting", 12, 50, 0.1, 8_200],
];

function demoSkills(): SkillProgress[] {
  return SKILLS.map(([id, name, level, maxLevel, progress, xp]) => ({
    id,
    name,
    level,
    maxLevel,
    xp,
    nextLevelXp: level >= maxLevel ? null : Math.round(xp + (1 - progress) * 1_000_000),
    progress,
    maxed: level >= maxLevel,
  }));
}

function demoInventoryItem(
  item: Pick<DecodedInventoryItem, "slot" | "itemId" | "name" | "count"> &
    Partial<DecodedInventoryItem>,
): DecodedInventoryItem {
  return {
    damage: 0,
    rarity: null,
    category: null,
    material: null,
    lore: [],
    loreLines: [],
    stars: 0,
    recombobulated: false,
    hotPotatoBooks: 0,
    fumingPotatoBooks: 0,
    reforge: null,
    enchantments: {},
    gemstoneSlots: [],
    uuid: null,
    soulbound: false,
    extra: {},
    ...item,
  };
}

function demoMember(name: string): ProfileMemberStats {
  return {
    uuid: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
    name,
    lastSave: Date.now() - 1000 * 60 * 18,
    firstJoin: Date.UTC(2021, 3, 12),
    skyblockXp: 6842,
    skyblockLevel: 68,
    skyblockLevelProgress: 0.42,
    purse: 482_350_000,
    bank: 1_204_000_000,
    essence: { WITHER: 1_250, UNDEAD: 640, DIAMOND: 2_100 },
    skills: demoSkills(),
    skillsAvailable: true,
    skillAverage: 40.5,
    slayers: [
      { id: "zombie", name: "Revenant Horror", xp: 110_000, level: 7, maxLevel: 9, nextLevelXp: 400_000, progress: 0.05, kills: { 4: 312, 5: 84 }, attempts: { 4: 330 } },
      { id: "spider", name: "Tarantula Broodfather", xp: 22_400, level: 6, maxLevel: 9, nextLevelXp: 100_000, progress: 0.03, kills: { 4: 142 }, attempts: { 4: 150 } },
      { id: "wolf", name: "Sven Packmaster", xp: 5_620, level: 5, maxLevel: 9, nextLevelXp: 20_000, progress: 0.04, kills: { 4: 61 }, attempts: { 4: 70 } },
      { id: "enderman", name: "Voidgloom Seraph", xp: 7_800, level: 5, maxLevel: 9, nextLevelXp: 20_000, progress: 0.19, kills: { 4: 96 }, attempts: { 4: 104 } },
    ],
    slayerTotalXp: 145_820,
    dungeons: {
      catacombsXp: 3_845_000,
      catacombsLevel: 36,
      catacombsProgress: 0.24,
      catacombsNextXp: 4_300_000,
      highestTier: 7,
      masterHighestTier: 4,
      classes: [
        { id: "mage", name: "Mage", xp: 3_100_000, level: 34, progress: 0.5, nextLevelXp: 3_300_000 },
        { id: "archer", name: "Archer", xp: 780_000, level: 24, progress: 0.2, nextLevelXp: 911_640 },
        { id: "tank", name: "Tank", xp: 190_000, level: 17, progress: 0.4, nextLevelXp: 259_640 },
      ],
    },
    pets: [
      { type: "GOLDEN_DRAGON", name: "Golden Dragon", tier: "LEGENDARY", xp: 182_400_000, active: true, heldItem: "PET_ITEM_TIER_BOOST", candyUsed: 0 },
      { type: "GRIFFIN", name: "Griffin", tier: "LEGENDARY", xp: 24_100_000, active: false, heldItem: "PET_ITEM_COMBAT_SKILL_BOOST_EPIC", candyUsed: 3 },
      { type: "BLUE_WHALE", name: "Blue Whale", tier: "LEGENDARY", xp: 18_900_000, active: false, heldItem: null, candyUsed: 0 },
      { type: "BABY_YETI", name: "Baby Yeti", tier: "EPIC", xp: 9_450_000, active: false, heldItem: null, candyUsed: 1 },
      { type: "SCATHA", name: "Scatha", tier: "RARE", xp: 3_120_000, active: false, heldItem: null, candyUsed: 0 },
    ],
    collections: [
      { id: "WHEAT", name: "Wheat", amount: 1_845_230 },
      { id: "POTATO_ITEM", name: "Potato", amount: 2_140_000 },
      { id: "CARROT_ITEM", name: "Carrot", amount: 980_400 },
      { id: "MINING_COLLECTION_DIAMOND", name: "Diamond", amount: 745_200 },
      { id: "INK_SACK:3", name: "Cocoa Beans", amount: 1_204_000 },
      { id: "ENDER_PEARL", name: "Ender Pearl", amount: 610_000 },
      { id: "ROTTEN_FLESH", name: "Rotten Flesh", amount: 1_400_000 },
      { id: "BLAZE_ROD", name: "Blaze Rod", amount: 220_500 },
    ],
    collectionCount: 312,
    inventory: {
      available: true,
      reason: null,
      items: [
        demoInventoryItem({
          slot: 0,
          itemId: "HYPERION",
          name: "Hyperion",
          count: 1,
          rarity: "LEGENDARY",
          category: "SWORD",
          material: "IRON_SWORD",
          stars: 5,
          recombobulated: true,
          hotPotatoBooks: 10,
          fumingPotatoBooks: 5,
          reforge: "warped",
          enchantments: { ULTIMATE_WISE: 5, SHARPNESS: 7 },
          lore: ["§6§lHeroic Hyperion", "§7Damage: §c+260", "", "§d§lMYTHIC DUNGEON SWORD"],
          loreLines: [],
          soulbound: true,
        }),
        demoInventoryItem({
          slot: 1,
          itemId: "ENCHANTED_DIAMOND",
          name: "Enchanted Diamond",
          count: 64,
          rarity: "RARE",
          category: "ITEM",
          material: "DIAMOND",
        }),
        demoInventoryItem({
          slot: 2,
          itemId: "BOOSTER_COOKIE",
          name: "Booster Cookie",
          count: 12,
          rarity: "LEGENDARY",
          category: "ITEM",
          material: "COOKIE",
        }),
      ],
      armor: [
        demoInventoryItem({
          slot: 0,
          itemId: "STORM_HELMET",
          name: "Storm's Helmet",
          count: 1,
          rarity: "LEGENDARY",
          category: "HELMET",
          material: "LEATHER_HELMET",
          stars: 5,
        }),
        demoInventoryItem({
          slot: 1,
          itemId: "STORM_CHESTPLATE",
          name: "Storm's Chestplate",
          count: 1,
          rarity: "LEGENDARY",
          category: "CHESTPLATE",
          material: "LEATHER_CHESTPLATE",
          stars: 5,
        }),
      ],
      containers: [
        {
          id: "main",
          location: "inv_contents",
          size: 9,
          known: true,
          slots: [
            demoInventoryItem({ slot: 0, itemId: "HYPERION", name: "Hyperion", count: 1, rarity: "LEGENDARY", category: "SWORD" }),
            demoInventoryItem({ slot: 1, itemId: "ENCHANTED_DIAMOND", name: "Enchanted Diamond", count: 64, rarity: "RARE", category: "ITEM" }),
            demoInventoryItem({ slot: 2, itemId: "BOOSTER_COOKIE", name: "Booster Cookie", count: 12, rarity: "LEGENDARY", category: "ITEM" }),
            null,
            null,
            null,
            null,
            null,
            null,
          ],
        },
        {
          id: "armor",
          location: "inv_armor",
          size: 4,
          known: true,
          slots: [
            demoInventoryItem({ slot: 0, itemId: "STORM_HELMET", name: "Storm's Helmet", count: 1, rarity: "LEGENDARY", category: "HELMET" }),
            demoInventoryItem({ slot: 1, itemId: "STORM_CHESTPLATE", name: "Storm's Chestplate", count: 1, rarity: "LEGENDARY", category: "CHESTPLATE" }),
            null,
            null,
          ],
        },
      ],
      missing: [],
      availableContainers: 2,
      totalContainers: 2,
      totalItems: 79,
      truncated: false,
      errors: [],
    },
    deathCount: 1_284,
  };
}

function demoProfile(name: string, suffix: string, selected: boolean, gameMode: NormalizedProfile["gameMode"]): NormalizedProfile {
  return {
    id: `demo-profile-${suffix}`,
    cuteName: suffix === "main" ? "Mango" : "Lime",
    gameMode,
    isCoop: suffix === "main",
    coopMemberCount: suffix === "main" ? 3 : 1,
    coopMembers:
      suffix === "main"
        ? [
            { uuid: "a1b2c3d4e5f60718293a4b5c6d7e8f90", isTarget: true },
            { uuid: "b1b2c3d4e5f60718293a4b5c6d7e8f91", isTarget: false },
            { uuid: "c1b2c3d4e5f60718293a4b5c6d7e8f92", isTarget: false },
          ]
        : [{ uuid: "a1b2c3d4e5f60718293a4b5c6d7e8f90", isTarget: true }],
    selected,
    lastSave: Date.now() - 1000 * 60 * 18,
    member: demoMember(name),
  };
}

export function getDemoPlayer(name: string): NormalizedPlayer {
  const safeName = name.trim() || "CompanionDemo";
  return {
    uuid: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
    name: safeName,
    profiles: [demoProfile(safeName, "main", true, "normal"), demoProfile(safeName, "iron", false, "ironman")],
    fetchedAt: Date.now(),
    demo: true,
  };
}

function quote(
  productId: string,
  buyPrice: number,
  sellPrice: number,
  buyMovingWeek: number,
  sellMovingWeek: number,
  buyOrders = 40,
  sellOrders = 35,
): BazaarProduct {
  return {
    product_id: productId,
    buy_summary: Array.from({ length: 5 }, (_, index) => ({
      amount: Math.round(buyMovingWeek / (40 + index * 3)),
      pricePerUnit: buyPrice + index * buyPrice * 0.002,
      orders: Math.max(1, buyOrders - index * 2),
    })),
    sell_summary: Array.from({ length: 5 }, (_, index) => ({
      amount: Math.round(sellMovingWeek / (45 + index * 4)),
      pricePerUnit: sellPrice - index * sellPrice * 0.002,
      orders: Math.max(1, sellOrders - index * 2),
    })),
    quick_status: {
      productId,
      buyPrice,
      buyVolume: Math.round(buyMovingWeek / 2),
      buyMovingWeek,
      buyOrders,
      sellPrice,
      sellVolume: Math.round(sellMovingWeek / 2),
      sellMovingWeek,
      sellOrders,
    },
  };
}

const DEMO_PRODUCTS: BazaarProduct[] = [
  quote("ENCHANTED_DIAMOND", 1_284_000, 1_248_000, 420_000, 390_000, 84, 71),
  quote("ENCHANTED_GOLD", 146_800, 141_200, 980_000, 910_000, 65, 58),
  quote("BOOSTER_COOKIE", 6_850_000, 6_690_000, 180_000, 172_000, 120, 111),
  quote("STOCK_OF_STONKS", 24_800_000, 23_900_000, 12_000, 9_800, 21, 19),
  quote("ENCHANTED_LAPIS_LAZULI", 89_400, 84_100, 1_240_000, 1_180_000, 72, 60),
  quote("ENCHANTED_REDSTONE", 62_300, 59_800, 1_800_000, 1_650_000, 55, 49),
  quote("ENCHANTED_EMERALD", 78_900, 75_400, 640_000, 610_000, 44, 38),
  quote("ENCHANTED_COAL", 41_200, 39_700, 2_400_000, 2_200_000, 39, 34),
  quote("ENCHANTED_IRON", 118_500, 112_900, 720_000, 690_000, 51, 47),
  quote("ENCHANTED_OBSIDIAN", 152_300, 147_900, 210_000, 198_000, 31, 28),
  quote("ENCHANTED_HAY_BLOCK", 98_200, 94_400, 320_000, 305_000, 42, 37),
  quote("ENCHANTED_BAKED_POTATO", 72_400, 69_800, 1_100_000, 1_020_000, 46, 41),
  quote("ENCHANTED_MELON", 44_800, 42_100, 1_550_000, 1_470_000, 36, 33),
  quote("ENCHANTED_PUMPKIN", 51_600, 49_300, 870_000, 840_000, 34, 30),
  quote("ENCHANTED_CARROT", 38_900, 36_700, 1_300_000, 1_240_000, 29, 27),
];

export function getDemoBazaar(): BazaarResponse {
  return {
    success: true,
    lastUpdated: Date.now(),
    products: Object.fromEntries(DEMO_PRODUCTS.map((product) => [product.product_id, product])),
  };
}

function auction(
  index: number,
  itemName: string,
  tier: string,
  category: string,
  price: number,
  bin: boolean,
  durationMinutes: number,
): HypixelAuction {
  return {
    uuid: `demo-auction-${String(index).padStart(4, "0")}`,
    auctioneer: "a1b2c3d4e5f60718293a4b5c6d7e8f90",
    profile_id: "demo-profile-main",
    start: Date.now() - 1000 * 60 * 30,
    end: Date.now() + 1000 * 60 * durationMinutes,
    item_name: itemName,
    item_lore: `§8DEMO\n\n§7Fictional auction generated by\n§7SkyForge Helper demo mode.\n\n§9§lDEMO ITEM`,
    category,
    tier,
    starting_bid: price,
    highest_bid_amount: bin ? 0 : Math.round(price * 1.08),
    bin,
    bids: bin ? [] : [{ amount: Math.round(price * 1.08), bidder: "demo-bidder", timestamp: Date.now() - 1000 * 60 * 4 }],
  };
}

const DEMO_AUCTIONS: HypixelAuction[] = [
  auction(1, "Hyperion", "LEGENDARY", "weapon", 680_000_000, true, 84),
  auction(2, "Necron's Handle", "LEGENDARY", "misc", 312_000_000, true, 190),
  auction(3, "Terminator", "LEGENDARY", "weapon", 428_000_000, true, 46),
  auction(4, "Judgement Core", "LEGENDARY", "misc", 248_000_000, false, 320),
  auction(5, "Storm's Chestplate", "LEGENDARY", "armor", 92_000_000, true, 128),
  auction(6, "Golden Dragon Pet", "LEGENDARY", "misc", 1_240_000_000, true, 230),
  auction(7, "Enchanted Diamond Block", "RARE", "blocks", 2_450_000, false, 65),
  auction(8, "Giant's Sword", "LEGENDARY", "weapon", 154_000_000, true, 12),
  auction(9, "Wither Scroll", "EPIC", "misc", 18_400_000, true, 540),
  auction(10, "Recombobulator 3000", "LEGENDARY", "misc", 9_200_000, true, 155),
  auction(11, "Midas' Sword", "LEGENDARY", "weapon", 74_000_000, false, 95),
  auction(12, "Booster Cookie", "EPIC", "consumables", 6_900_000, true, 24),
  auction(13, "Divan's Drill", "LEGENDARY", "misc", 860_000_000, true, 300),
  auction(14, "Ender Dragon Pet", "LEGENDARY", "misc", 372_000_000, true, 178),
];

export function getDemoAuctions(page = 0): AuctionsResponse {
  return {
    success: true,
    page: 0,
    totalPages: 1,
    totalAuctions: DEMO_AUCTIONS.length,
    lastUpdated: Date.now(),
    auctions: page === 0 ? DEMO_AUCTIONS : [],
  };
}
