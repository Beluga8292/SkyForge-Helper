import intelligenceRules from "@/features/intelligence/rules.json";
import type { HypixelSkill } from "@/types/hypixel";
import type { DungeonClassProgress, DungeonProgress, PetSummary, SkillProgress, SlayerProgress } from "@/types/profile";
import type { SkyBlockMemberDungeons, SkyBlockMemberPlayerData, SkyBlockMemberPetsData, SkyBlockMemberSlayer } from "@/types/hypixel";
import { petName, skillNameFromKey, slayerName } from "@/utils/item-name";

/**
 * SkyBlock level uses a flat 100 XP per level curve. The level cap is raised by
 * Hypixel over time, therefore we never clamp it locally.
 * Source: SkyCrypt constants (`SKYBLOCK_XP`, one level = 100 XP), 2026.
 */
export const SKYBLOCK_XP_PER_LEVEL = 100;

export function skyblockLevelFromXp(xp: number | null | undefined): number | null {
  if (xp == null || !Number.isFinite(xp) || xp < 0) return null;
  return Math.floor(xp / SKYBLOCK_XP_PER_LEVEL);
}

export function skyblockLevelProgress(xp: number | null | undefined): number {
  if (xp == null || !Number.isFinite(xp) || xp < 0) return 0;
  return (xp % SKYBLOCK_XP_PER_LEVEL) / SKYBLOCK_XP_PER_LEVEL;
}

/** Level thresholds for regular skills come straight from the official resource endpoint. */
export function skillProgressFromXp(id: string, xp: number, skill: HypixelSkill | undefined): SkillProgress {
  if (!skill) {
    return {
      id,
      name: skillNameFromKey(id),
      xp,
      level: 0,
      maxLevel: 0,
      nextLevelXp: null,
      progress: 0,
      maxed: false,
    };
  }

  const levels = [...skill.levels].sort((a, b) => a.totalExpRequired - b.totalExpRequired);
  let current = 0;
  let next: number | null = levels[0]?.totalExpRequired ?? null;
  let prevThreshold = 0;

  for (const entry of levels) {
    if (xp >= entry.totalExpRequired) {
      current = entry.level;
      prevThreshold = entry.totalExpRequired;
      const following = levels.find((candidate) => candidate.level === entry.level + 1);
      next = following?.totalExpRequired ?? null;
    } else {
      break;
    }
  }

  const maxed = current >= skill.maxLevel;
  const progress = maxed || next == null ? 1 : Math.min(1, Math.max(0, (xp - prevThreshold) / (next - prevThreshold)));

  return {
    id,
    name: skill.name || skillNameFromKey(id),
    xp,
    level: current,
    maxLevel: skill.maxLevel,
    nextLevelXp: maxed ? null : next,
    progress: Number.isFinite(progress) ? progress : 0,
    maxed,
  };
}

export function buildSkills(
  experience: Record<string, number | undefined> | undefined,
  skillsResource: Record<string, HypixelSkill> | undefined,
): SkillProgress[] {
  if (!experience) return [];
  const resource = skillsResource ?? {};
  return Object.entries(experience)
    .filter((entry): entry is [string, number] => typeof entry[1] === "number" && entry[1] >= 0)
    .map(([key, xp]) => {
      const skillKey = key.replace(/^SKILL_/, "").toUpperCase();
      return skillProgressFromXp(skillKey, xp, resource[skillKey]);
    })
    .sort((a, b) => b.level - a.level || a.name.localeCompare(b.name));
}

export function skillAverage(skills: SkillProgress[]): number | null {
  const counted = skills.filter((skill) => skill.level > 0 && skill.id !== "RUNECRAFTING" && skill.id !== "SOCIAL");
  if (!counted.length) return null;
  return counted.reduce((sum, skill) => sum + skill.level, 0) / counted.length;
}

/**
 * Slayer XP thresholds. Hypixel does not expose these through a resource
 * endpoint; values below mirror the in-game slayer XP table (SkyCrypt
 * `SLAYER_XP`, 2026). They are only used to visualise progress, never to
 * invent API values.
 */
export const SLAYER_XP: Record<string, number[]> = intelligenceRules.slayer_xp;

export function slayerLevelFromXp(id: string, xp: number): { level: number; maxLevel: number; nextXp: number | null; progress: number } {
  const table = SLAYER_XP[id] ?? [0];
  let level = 0;
  for (let index = 0; index < table.length; index += 1) {
    if (xp >= (table[index] ?? 0)) level = index;
  }
  const maxLevel = table.length - 1;
  const nextXp = level >= maxLevel ? null : (table[level + 1] ?? null);
  const prevXp = table[level] ?? 0;
  const progress = nextXp == null ? 1 : Math.min(1, Math.max(0, (xp - prevXp) / (nextXp - prevXp)));
  return { level, maxLevel, nextXp, progress };
}

export function buildSlayers(slayer: SkyBlockMemberSlayer | undefined): SlayerProgress[] {
  const bosses = slayer?.slayer_bosses;
  if (!bosses) return [];
  return Object.entries(bosses)
    .map(([id, boss]) => {
      const xp = typeof boss?.xp === "number" ? boss.xp : 0;
      const derived = slayerLevelFromXp(id, xp);
      const kills: Record<number, number> = {};
      const attempts: Record<number, number> = {};
      for (const [key, value] of Object.entries(boss ?? {})) {
        const killMatch = /^boss_kills_tier_(\d+)$/.exec(key);
        if (killMatch && typeof value === "number") kills[Number(killMatch[1])] = value;
        const attemptMatch = /^boss_attempts_tier_(\d+)$/.exec(key);
        if (attemptMatch && typeof value === "number") attempts[Number(attemptMatch[1])] = value;
      }
      return {
        id,
        name: slayerName(id),
        xp,
        level: derived.level,
        maxLevel: derived.maxLevel,
        nextLevelXp: derived.nextXp,
        progress: derived.progress,
        kills,
        attempts,
      };
    })
    .sort((a, b) => b.xp - a.xp);
}

/**
 * Catacombs / class XP thresholds. Values mirror the in-game dungeoneering
 * table (SkyCrypt `DUNGEONEERING_XP`, 2026). Used for progress visualisation
 * only.
 */
const DUNGEONEERING_XP = intelligenceRules.catacombs;

export function dungeoneeringLevelFromXp(xp: number): { level: number; nextXp: number | null; progress: number } {
  let level = 0;
  for (let index = 0; index < DUNGEONEERING_XP.length; index += 1) {
    if (xp >= (DUNGEONEERING_XP[index] ?? 0)) level = index;
  }
  const nextXp = DUNGEONEERING_XP[level + 1] ?? null;
  const prevXp = DUNGEONEERING_XP[level] ?? 0;
  const progress = nextXp == null ? 1 : Math.min(1, Math.max(0, (xp - prevXp) / (nextXp - prevXp)));
  return { level, nextXp, progress };
}

const CLASS_NAMES: Record<string, string> = {
  healer: "Healer",
  mage: "Mage",
  berserk: "Berserk",
  archer: "Archer",
  tank: "Tank",
};

export function buildDungeons(dungeons: SkyBlockMemberDungeons | undefined): DungeonProgress | null {
  if (!dungeons) return null;
  const catacombsXp = dungeons.dungeon_types?.catacombs?.experience ?? 0;
  const cata = dungeoneeringLevelFromXp(catacombsXp);
  const classes: DungeonClassProgress[] = Object.entries(dungeons.player_classes ?? {})
    .map(([id, value]) => {
      const xp = typeof value?.experience === "number" ? value.experience : 0;
      const level = dungeoneeringLevelFromXp(xp);
      return {
        id,
        name: CLASS_NAMES[id] ?? id,
        xp,
        level: level.level,
        progress: level.progress,
        nextLevelXp: level.nextXp,
      };
    })
    .filter((entry) => entry.xp > 0)
    .sort((a, b) => b.xp - a.xp);

  const hasAnyData = catacombsXp > 0 || classes.length > 0 || (dungeons.dungeon_types?.master_catacombs?.highest_tier_completed ?? 0) > 0;
  if (!hasAnyData) return null;

  return {
    catacombsXp,
    catacombsLevel: cata.level,
    catacombsProgress: cata.progress,
    catacombsNextXp: cata.nextXp,
    highestTier: dungeons.dungeon_types?.catacombs?.highest_tier_completed ?? null,
    masterHighestTier: dungeons.dungeon_types?.master_catacombs?.highest_tier_completed ?? null,
    classes,
  };
}

export function buildPets(petsData: SkyBlockMemberPetsData | undefined): PetSummary[] {
  const pets = petsData?.pets;
  if (!Array.isArray(pets)) return [];
  return pets
    .filter((pet) => typeof pet?.type === "string")
    .map((pet) => ({
      type: pet.type ?? "UNKNOWN",
      name: petName(pet.type ?? "UNKNOWN"),
      tier: (pet.tier ?? "UNKNOWN").toUpperCase(),
      xp: typeof pet.exp === "number" ? pet.exp : 0,
      active: Boolean(pet.active),
      heldItem: typeof pet.heldItem === "string" ? pet.heldItem : null,
      candyUsed: typeof pet.candyUsed === "number" ? pet.candyUsed : 0,
    }))
    .sort((a, b) => Number(b.active) - Number(a.active) || b.xp - a.xp);
}

export function normalizeGameMode(raw: string | null | undefined): "normal" | "ironman" | "stranded" | "bingo" | "unknown" {
  switch ((raw ?? "").toLowerCase()) {
    case "":
    case "normal":
      return "normal";
    case "ironman":
      return "ironman";
    case "stranded":
      return "stranded";
    case "bingo":
      return "bingo";
    default:
      return "unknown";
  }
}

export function extractSkillExperience(playerData: SkyBlockMemberPlayerData | undefined): Record<string, number | undefined> | undefined {
  const experience = playerData?.experience;
  if (!experience || typeof experience !== "object") return undefined;
  return experience;
}
