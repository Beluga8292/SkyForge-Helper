import type { HypixelItem, HypixelSkill, SkyBlockProfile, SkyBlockProfileMember } from "@/types/hypixel";
import type { CollectionEntry, InventorySummary, NormalizedPlayer, NormalizedProfile, ProfileMemberStats } from "@/types/profile";
import { decodeMemberInventory } from "@/utils/inventory";
import { prettifyItemId } from "@/utils/item-name";
import {
  buildDungeons,
  buildPets,
  buildSkills,
  buildSlayers,
  normalizeGameMode,
  skyblockLevelFromXp,
  skyblockLevelProgress,
  skillAverage,
} from "@/utils/skyblock";
import { normalizeUuid } from "@/utils/validation";

export interface NormalizeResources {
  skills?: Record<string, HypixelSkill>;
  items?: Map<string, HypixelItem>;
}

export interface NormalizeInput extends NormalizeResources {
  uuid: string;
  name: string;
  profiles: SkyBlockProfile[];
}

function findMember(profile: SkyBlockProfile, uuid: string): SkyBlockProfileMember | null {
  const members = profile.members;
  if (!members) return null;
  const direct = members[uuid] ?? members[formatDashed(uuid)];
  if (direct) return direct;
  const normalized = normalizeUuid(uuid);
  for (const [key, member] of Object.entries(members)) {
    if (normalizeUuid(key) === normalized) return member;
  }
  return null;
}

function formatDashed(uuid: string): string {
  const clean = normalizeUuid(uuid);
  if (clean.length !== 32) return uuid;
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20)}`;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numberRecord(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, entry]) => [key, numberOrNull(entry)] as const)
      .filter((entry): entry is [string, number] => entry[1] !== null && entry[1] >= 0)
      .map(([key, entry]) => [key, Math.trunc(entry)]),
  );
}

function buildCollections(
  collection: Record<string, number> | undefined,
  items: Map<string, HypixelItem> | undefined,
): { entries: CollectionEntry[]; count: number | null } {
  if (!collection || typeof collection !== "object") return { entries: [], count: null };
  const entries = Object.entries(collection)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] >= 0)
    .map(([id, amount]) => ({
      id,
      name: items?.get(id)?.name ?? prettifyItemId(id),
      amount,
    }))
    .sort((a, b) => b.amount - a.amount);
  return { entries: entries.slice(0, 12), count: entries.length };
}

async function buildInventory(
  member: SkyBlockProfileMember,
  items?: Map<string, HypixelItem>,
): Promise<InventorySummary> {
  const raw = member.inventory as Record<string, unknown> | undefined;
  const hasAnyContainer =
    raw &&
    (raw["inv_contents"] ||
      raw["inv_armor"] ||
      raw["equipment_contents"] ||
      raw["ender_chest_contents"] ||
      raw["wardrobe_contents"] ||
      raw["bag_contents"] ||
      raw["backpack_contents"] ||
      raw["personal_vault_contents"]);
  if (!raw || !hasAnyContainer) {
    return {
      available: false,
      reason: "not-provided",
      items: [],
      armor: [],
      containers: [],
      missing: [],
      availableContainers: 0,
      totalContainers: 0,
      totalItems: 0,
      truncated: false,
      errors: [],
    };
  }

  try {
    const decoded = await decodeMemberInventory(raw, items);
    const all = decoded.containers.flatMap((container) =>
      container.slots.filter((item): item is NonNullable<typeof item> => item !== null),
    );
    const totalItems = all.reduce((sum, item) => sum + item.count, 0);
    const availableContainers = decoded.containers.filter((container) => container.known).length;
    const totalContainers =
      decoded.containers.length +
      decoded.missing.filter((entry) => entry.reason !== "decode-error").length;
    if (!all.length) {
      return {
        available: true,
        reason: "empty",
        items: [],
        armor: [],
        containers: decoded.containers,
        missing: decoded.missing,
        availableContainers,
        totalContainers,
        totalItems: 0,
        truncated: false,
        errors: decoded.errors,
      };
    }
    return {
      available: true,
      reason: null,
      items: decoded.items.slice(0, 200),
      armor: decoded.armor.slice(0, 8),
      containers: decoded.containers,
      missing: decoded.missing,
      availableContainers,
      totalContainers,
      totalItems,
      truncated: decoded.items.length > 200 || decoded.errors.includes("backpacks_truncated_16"),
      errors: decoded.errors,
    };
  } catch {
    return {
      available: false,
      reason: "decode-error",
      items: [],
      armor: [],
      containers: [],
      missing: [],
      availableContainers: 0,
      totalContainers: 0,
      totalItems: 0,
      truncated: false,
      errors: [],
    };
  }
}

async function buildMember(
  profile: SkyBlockProfile,
  member: SkyBlockProfileMember,
  uuid: string,
  name: string | null,
  resources: NormalizeResources,
): Promise<ProfileMemberStats> {
  const rawSkills = member.player_data?.experience;
  const skills = buildSkills(rawSkills, resources.skills);
  const skyblockXp = numberOrNull(member.leveling?.experience);
  const level = skyblockLevelFromXp(skyblockXp);
  const collections = buildCollections(member.collection, resources.items);
  const inventory = await buildInventory(member, resources.items);
  const slayers = buildSlayers(member.slayer);

  const bank = numberOrNull(profile.banking?.balance) ?? numberOrNull(member.profile?.bank_account);
  const purse = numberOrNull(member.currencies?.coin_purse);

  return {
    uuid,
    name,
    lastSave: numberOrNull(member.last_save),
    firstJoin: numberOrNull(member.profile?.first_join) ?? numberOrNull(member.first_join),
    skyblockXp,
    skyblockLevel: level,
    skyblockLevelProgress: skyblockLevelProgress(skyblockXp),
    purse,
    bank,
    essence: numberRecord(member.currencies?.essence),
    skills,
    skillsAvailable: Boolean(resources.skills),
    skillAverage: skillAverage(skills),
    slayers,
    slayerTotalXp: slayers.reduce((sum, slayer) => sum + slayer.xp, 0),
    dungeons: buildDungeons(member.dungeons),
    pets: buildPets(member.pets_data),
    collections: collections.entries,
    collectionCount: collections.count,
    inventory,
    deathCount: numberOrNull(member.player_data?.death_count),
  };
}

export async function normalizePlayerProfiles(input: NormalizeInput): Promise<NormalizedPlayer> {
  const profiles = await Promise.all(
    input.profiles
      .map(async (profile): Promise<NormalizedProfile | null> => {
        const member = findMember(profile, input.uuid);
        if (!member) return null;
        const memberEntries = Object.entries(profile.members ?? {});
        const members = memberEntries.length || 1;
        const normalizedMembers = await Promise.all(
          memberEntries.map(async ([memberUuid, memberData]) => {
            const normalizedUuid = normalizeUuid(memberUuid);
            const isTarget = normalizedUuid === normalizeUuid(input.uuid);
            return {
              uuid: normalizedUuid,
              name: isTarget ? input.name : null,
              isTarget,
              member: await buildMember(
                profile,
                memberData,
                normalizedUuid,
                isTarget ? input.name : null,
                input,
              ),
            };
          }),
        );
        return {
          id: profile.profile_id ?? "unknown-profile",
          cuteName: profile.cute_name ?? null,
          gameMode: normalizeGameMode(profile.game_mode),
          isCoop: members > 1,
          coopMemberCount: members,
          coopMembers: normalizedMembers.map(({ uuid, isTarget }) => ({ uuid, isTarget })),
          members: normalizedMembers,
          selected: Boolean(profile.selected),
          lastSave: numberOrNull(member.last_save),
          member: normalizedMembers.find((entry) => entry.isTarget)?.member ?? null,
        };
      }),
  );

  const valid = profiles.filter((profile): profile is NormalizedProfile => profile !== null);
  // Hypixel may omit `selected` for older profiles; keep a deterministic order.
  valid.sort((a, b) => Number(b.selected) - Number(a.selected) || (b.member?.skyblockXp ?? 0) - (a.member?.skyblockXp ?? 0));

  return {
    uuid: normalizeUuid(input.uuid),
    name: input.name,
    profiles: valid,
    fetchedAt: Date.now(),
  };
}
