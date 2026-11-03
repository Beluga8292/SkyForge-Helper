export type GameMode = "normal" | "ironman" | "stranded" | "bingo" | "unknown";

export interface SkillProgress {
  id: string;
  name: string;
  xp: number;
  level: number;
  maxLevel: number;
  nextLevelXp: number | null;
  progress: number;
  maxed: boolean;
}

export interface SlayerProgress {
  id: string;
  name: string;
  xp: number;
  level: number;
  maxLevel: number;
  nextLevelXp: number | null;
  progress: number;
  kills: Record<number, number>;
  attempts: Record<number, number>;
}

export interface DungeonClassProgress {
  id: string;
  name: string;
  xp: number;
  level: number;
  progress: number;
  nextLevelXp: number | null;
}

export interface DungeonProgress {
  catacombsXp: number;
  catacombsLevel: number;
  catacombsProgress: number;
  catacombsNextXp: number | null;
  highestTier: number | null;
  masterHighestTier: number | null;
  classes: DungeonClassProgress[];
}

export interface PetSummary {
  type: string;
  name: string;
  tier: string;
  xp: number;
  active: boolean;
  heldItem: string | null;
  candyUsed: number;
}

export interface CollectionEntry {
  id: string;
  name: string;
  amount: number;
}

export interface DecodedInventoryItem {
  slot: number;
  itemId: string;
  name: string;
  count: number;
  damage: number;
  /** Item rarity, from the item registry or the last lore lines. */
  rarity: string | null;
  category: string | null;
  material: string | null;
  /** Plain lore lines (formatting removed). */
  lore: string[];
  /** Parsed lore with colour/style segments for Minecraft-style tooltips. */
  loreLines: Array<{
    text: string;
    segments: Array<{
      text: string;
      color: string | null;
      bold: boolean;
      italic: boolean;
      underlined: boolean;
      strikethrough: boolean;
    }>;
  }>;
  stars: number;
  recombobulated: boolean;
  hotPotatoBooks: number;
  fumingPotatoBooks: number;
  reforge: string | null;
  enchantments: Record<string, number>;
  gemstoneSlots: string[];
  uuid: string | null;
  soulbound: boolean;
  /** Mojang skin URL from a Hypixel custom player-head item, when present. */
  skullTexture?: string | null;
  extra: Record<string, unknown>;
}

export interface InventoryContainer {
  id: string;
  location: string;
  /** Number of rendered slots. Empty slots are null. */
  size: number;
  slots: Array<DecodedInventoryItem | null>;
  /** False when the blob existed but could not be decoded. */
  known: boolean;
}

export type InventoryMissingReason = "decode-error" | "backpack-limit" | "missing";

export interface InventoryMissingContainer {
  id: string;
  location: string;
  reason: InventoryMissingReason;
  /** Raw technical detail, only surfaced in developer mode. */
  detail?: string;
}

export interface InventorySummary {
  available: boolean;
  reason: string | null;
  items: DecodedInventoryItem[];
  armor: DecodedInventoryItem[];
  containers: InventoryContainer[];
  /** Containers that were skipped, with a user-facing reason. */
  missing: InventoryMissingContainer[];
  /** Decoded containers / all containers known to the response. */
  availableContainers: number;
  totalContainers: number;
  totalItems: number;
  truncated: boolean;
  errors: string[];
}

export interface ProfileMemberStats {
  uuid: string;
  name: string | null;
  lastSave: number | null;
  firstJoin: number | null;
  skyblockXp: number | null;
  skyblockLevel: number | null;
  skyblockLevelProgress: number;
  purse: number | null;
  bank: number | null;
  essence: Record<string, number>;
  skills: SkillProgress[];
  skillsAvailable: boolean;
  skillAverage: number | null;
  slayers: SlayerProgress[];
  slayerTotalXp: number | null;
  dungeons: DungeonProgress | null;
  pets: PetSummary[];
  collections: CollectionEntry[];
  collectionCount: number | null;
  inventory: InventorySummary;
  deathCount: number | null;
}

export interface NormalizedProfile {
  id: string;
  cuteName: string | null;
  gameMode: GameMode;
  isCoop: boolean;
  coopMemberCount: number;
  coopMembers: Array<{ uuid: string; isTarget: boolean }>;
  /** All decoded co-op members, used by the read-only member selector. */
  members?: Array<{
    uuid: string;
    name: string | null;
    isTarget: boolean;
    member: ProfileMemberStats;
  }>;
  selected: boolean;
  lastSave: number | null;
  member: ProfileMemberStats | null;
}

export interface NormalizedPlayer {
  uuid: string;
  name: string;
  profiles: NormalizedProfile[];
  fetchedAt: number;
  stale?: boolean;
  demo?: boolean;
}
