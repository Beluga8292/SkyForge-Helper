import { z } from "zod";

// Backend serializes absent optional metadata as null; retain unknown as absent.
const optionalNumber = z.preprocess(
  (v) => (v === null ? undefined : v),
  z.number().optional(),
);
const optionalString = z.preprocess(
  (v) => (v === null ? undefined : v),
  z.string().optional(),
);

const looseObject = z.object({}).passthrough();

export const playerResponseSchema = z
  .object({
    success: z.boolean(),
    player: z
      .object({
        uuid: z.string().optional(),
        displayname: z.string().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
    cause: z.string().optional(),
  })
  .passthrough();

export const profileMemberSchema = z
  .object({
    last_save: optionalNumber,
    first_join: optionalNumber,
    leveling: looseObject.optional(),
    player_data: looseObject.optional(),
    currencies: looseObject.optional(),
    collection: z.record(z.string(), z.number()).optional(),
    slayer: looseObject.optional(),
    dungeons: looseObject.optional(),
    pets_data: looseObject.optional(),
    inventory: looseObject.optional(),
    profile: looseObject.optional(),
  })
  .passthrough();

export const skyBlockProfileSchema = z
  .object({
    profile_id: z.string().optional(),
    cute_name: z.string().optional(),
    game_mode: optionalString,
    selected: z.boolean().optional(),
    banking: z
      .object({
        balance: z.number().optional(),
      })
      .passthrough()
      .optional(),
    members: z.record(z.string(), profileMemberSchema).optional(),
    community_upgrades: looseObject.optional(),
  })
  .passthrough();

export const profilesResponseSchema = z
  .object({
    success: z.boolean(),
    profiles: z.array(skyBlockProfileSchema).nullable().optional(),
    cause: z.string().optional(),
  })
  .passthrough();

export const bazaarOrderSchema = z
  .object({
    amount: z.number(),
    pricePerUnit: z.number(),
    orders: z.number(),
  })
  .passthrough();

export const bazaarQuickStatusSchema = z
  .object({
    productId: z.string(),
    sellPrice: z.number(),
    sellVolume: z.number(),
    sellMovingWeek: z.number(),
    sellOrders: z.number(),
    buyPrice: z.number(),
    buyVolume: z.number(),
    buyMovingWeek: z.number(),
    buyOrders: z.number(),
  })
  .passthrough();

export const bazaarProductSchema = z
  .object({
    product_id: z.string(),
    sell_summary: z.array(bazaarOrderSchema).optional(),
    buy_summary: z.array(bazaarOrderSchema).optional(),
    quick_status: bazaarQuickStatusSchema.optional(),
  })
  .passthrough();

export const bazaarResponseSchema = z
  .object({
    success: z.boolean(),
    lastUpdated: z.number().optional(),
    products: z.record(z.string(), bazaarProductSchema).optional(),
    cause: z.string().optional(),
  })
  .passthrough();

export const skillLevelSchema = z
  .object({
    level: z.number(),
    totalExpRequired: z.number(),
    unlocks: z.array(z.string()).optional(),
  })
  .passthrough();

export const skillSchema = z
  .object({
    name: z.string(),
    description: z.string().optional(),
    maxLevel: z.number(),
    levels: z.array(skillLevelSchema),
  })
  .passthrough();

export const skillsResourceSchema = z
  .object({
    success: z.boolean(),
    lastUpdated: z.number().optional(),
    version: z.string().optional(),
    skills: z.record(z.string(), skillSchema).optional(),
  })
  .passthrough();

export const hypixelItemSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    material: z.string().optional(),
    tier: z.string().optional(),
    category: z.string().optional(),
    npc_sell_price: z.number().optional(),
  })
  .passthrough();

export const itemsResourceSchema = z
  .object({
    success: z.boolean(),
    lastUpdated: z.number().optional(),
    items: z.array(hypixelItemSchema).optional(),
  })
  .passthrough();

export const auctionSchema = z
  .object({
    uuid: z.string(),
    auctioneer: z.string().optional(),
    profile_id: z.string().optional(),
    start: z.number().optional(),
    end: z.number().optional(),
    item_name: z.string().optional(),
    item_lore: z.string().optional(),
    category: z.string().optional(),
    tier: z.string().optional(),
    starting_bid: z.number().optional(),
    highest_bid_amount: z.number().optional(),
    bin: z.boolean().optional(),
    bids: z
      .array(
        z
          .object({
            amount: z.number().optional(),
            bidder: z.string().optional(),
            timestamp: z.number().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();

export const auctionsResponseSchema = z
  .object({
    success: z.boolean(),
    page: z.number().optional(),
    totalPages: z.number().optional(),
    totalAuctions: z.number().optional(),
    lastUpdated: z.number().optional(),
    auctions: z.array(auctionSchema).optional(),
    cause: z.string().optional(),
  })
  .passthrough();

export const mojangProfileSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{32}$/i),
  name: z.string(),
});

export const mojangErrorSchema = z.object({
  error: z.string().optional(),
  errorMessage: z.string().optional(),
  path: z.string().optional(),
});
