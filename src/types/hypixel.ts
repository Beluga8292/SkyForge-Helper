/**
 * Raw response shapes for the official Hypixel Public API (v2).
 * Only fields that this application actually reads are typed; unknown fields are
 * intentionally allowed because Hypixel extends the API frequently.
 */

export interface HypixelEnvelope {
  success: boolean;
  cause?: string;
}

export interface HypixelPlayer {
  uuid?: string;
  displayname?: string;
  rank?: string;
  packageRank?: string;
  newPackageRank?: string;
  monthlyPackageRank?: string;
  firstLogin?: number;
  lastLogin?: number;
  lastLogout?: number;
  stats?: Record<string, unknown>;
  socialMedia?: Record<string, string | null>;
  [key: string]: unknown;
}

export interface PlayerResponse extends HypixelEnvelope {
  player?: HypixelPlayer | null;
}

export interface SkyBlockBanking {
  balance?: number;
  transactions?: Array<{
    timestamp?: number;
    action?: string;
    initiator_name?: string;
    amount?: number;
  }>;
}

export interface SkyBlockMemberLeveling {
  experience?: number;
  completions?: Record<string, number>;
  completed_tasks?: string[];
  highest_pet_score?: number;
  [key: string]: unknown;
}

export interface SkyBlockMemberPlayerData {
  experience?: Record<string, number | undefined>;
  death_count?: number;
  crafted_generators?: string[];
  [key: string]: unknown;
}

export interface SkyBlockMemberCurrencies {
  coin_purse?: number;
  motes_purse?: number;
  essence?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SkyBlockMemberSlayerBoss {
  xp?: number;
  claimed_levels?: Record<string, boolean>;
  [key: `boss_kills_tier_${number}`]: number | undefined;
  [key: `boss_attempts_tier_${number}`]: number | undefined;
  [key: string]: unknown;
}

export interface SkyBlockMemberSlayer {
  slayer_bosses?: Record<string, SkyBlockMemberSlayerBoss>;
  slayer_quest?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SkyBlockDungeonType {
  experience?: number;
  highest_tier_completed?: number;
  tier_completions?: Record<string, number>;
  [key: string]: unknown;
}

export interface SkyBlockMemberDungeons {
  dungeon_types?: {
    catacombs?: SkyBlockDungeonType;
    master_catacombs?: SkyBlockDungeonType;
    [key: string]: SkyBlockDungeonType | undefined;
  };
  player_classes?: Record<string, { experience?: number } | undefined>;
  [key: string]: unknown;
}

export interface SkyBlockPet {
  uuid?: string;
  uniqueId?: string;
  type?: string;
  exp?: number;
  active?: boolean;
  tier?: string;
  heldItem?: string;
  candyUsed?: number;
  skin?: string;
  [key: string]: unknown;
}

export interface SkyBlockMemberPetsData {
  pets?: SkyBlockPet[];
  autopet?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface MinecraftInventoryBlob {
  type?: number;
  data?: string;
}

export interface SkyBlockMemberInventory {
  inv_contents?: MinecraftInventoryBlob;
  inv_armor?: MinecraftInventoryBlob;
  ender_chest_contents?: MinecraftInventoryBlob;
  equipment_contents?: MinecraftInventoryBlob;
  backpack_contents?: Record<string, MinecraftInventoryBlob>;
  bag_contents?: Record<string, MinecraftInventoryBlob>;
  personal_vault_contents?: MinecraftInventoryBlob;
  sacks_counts?: Record<string, number>;
  [key: string]: unknown;
}

export interface SkyBlockProfileMember {
  player_id?: string;
  profile?: {
    first_join?: number;
    bank_account?: number;
    cookie_buff_active?: boolean;
    deletion_notice?: { timestamp?: number };
    [key: string]: unknown;
  };
  last_save?: number;
  first_join?: number;
  leveling?: SkyBlockMemberLeveling;
  player_data?: SkyBlockMemberPlayerData;
  currencies?: SkyBlockMemberCurrencies;
  collection?: Record<string, number>;
  slayer?: SkyBlockMemberSlayer;
  dungeons?: SkyBlockMemberDungeons;
  pets_data?: SkyBlockMemberPetsData;
  inventory?: SkyBlockMemberInventory;
  [key: string]: unknown;
}

export interface SkyBlockProfile {
  profile_id?: string;
  cute_name?: string;
  game_mode?: string;
  selected?: boolean;
  banking?: SkyBlockBanking;
  members?: Record<string, SkyBlockProfileMember>;
  community_upgrades?: Record<string, unknown>;
  created_at?: number;
  [key: string]: unknown;
}

export interface SkyBlockProfilesResponse extends HypixelEnvelope {
  profiles?: SkyBlockProfile[] | null;
}

export interface SkyBlockProfileResponse extends HypixelEnvelope {
  profile: SkyBlockProfile | null;
}

export interface BazaarOrderSummary {
  amount: number;
  pricePerUnit: number;
  orders: number;
}

export interface BazaarQuickStatus {
  productId: string;
  sellPrice: number;
  sellVolume: number;
  sellMovingWeek: number;
  sellOrders: number;
  buyPrice: number;
  buyVolume: number;
  buyMovingWeek: number;
  buyOrders: number;
}

export interface BazaarProduct {
  product_id: string;
  sell_summary?: BazaarOrderSummary[];
  buy_summary?: BazaarOrderSummary[];
  quick_status?: BazaarQuickStatus;
}

export interface BazaarResponse extends HypixelEnvelope {
  lastUpdated?: number;
  products?: Record<string, BazaarProduct>;
}

export interface HypixelSkillLevel {
  level: number;
  totalExpRequired: number;
  unlocks?: string[];
}

export interface HypixelSkill {
  name: string;
  description?: string;
  maxLevel: number;
  levels: HypixelSkillLevel[];
}

export interface SkillsResourceResponse extends HypixelEnvelope {
  lastUpdated?: number;
  version?: string;
  skills?: Record<string, HypixelSkill>;
}

export interface HypixelItem {
  id: string;
  name: string;
  material?: string;
  tier?: string;
  category?: string;
  npc_sell_price?: number;
  [key: string]: unknown;
}

export interface ItemsResourceResponse extends HypixelEnvelope {
  lastUpdated?: number;
  items?: HypixelItem[];
}

export interface AuctionBid {
  auction_id?: string;
  bidder?: string;
  profile_id?: string;
  amount?: number;
  timestamp?: number;
}

export interface HypixelAuction {
  uuid: string;
  auctioneer?: string;
  profile_id?: string;
  coop?: string[];
  start?: number;
  end?: number;
  item_name?: string;
  item_lore?: string;
  extra?: string;
  category?: string;
  categories?: string[];
  tier?: string;
  starting_bid?: number;
  highest_bid_amount?: number;
  claimed?: boolean;
  bin?: boolean;
  bids?: AuctionBid[];
  last_updated?: number;
  item_bytes?: string | MinecraftInventoryBlob;
  [key: string]: unknown;
}

export interface AuctionSearchQuery {
  search?: string;
  auctionType?: "all" | "bin" | "auction";
  rarity?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  endingWithin?: number;
  sort?: "ending_soon" | "price_asc" | "price_desc" | "newest";
}

export interface AuctionsResponse extends HypixelEnvelope {
  filteredTotal?: number;
  snapshotComplete?: boolean | null;
  snapshotPages?: number;
  identityIndexed?: number;
  categories?: string[];
  searchVersion?: number;
  page?: number;
  totalPages?: number;
  totalAuctions?: number;
  lastUpdated?: number;
  auctions?: HypixelAuction[];
}

export interface MojangProfile {
  id: string;
  name: string;
}
