import { describe, expect, it } from "vitest";
import { formatCompact, formatPercent, timeAgo } from "@/utils/format";
import { validateMinecraftName } from "@/utils/validation";
import { skyblockLevelFromXp, skyblockLevelProgress, slayerLevelFromXp, dungeoneeringLevelFromXp } from "@/utils/skyblock";
import { prettifyItemId } from "@/utils/item-name";

describe("formatting", () => {
  it("formats large coin values compactly", () => {
    expect(formatCompact(1_234)).toBe("1.23K");
    expect(formatCompact(3_180_000)).toBe("3.18M");
    expect(formatCompact(1_020_000_000)).toBe("1.02B");
    expect(formatCompact(-4200)).toBe("-4.2K");
  });

  it("formats percentages with a sign", () => {
    expect(formatPercent(1.234)).toBe("+1.23%");
    expect(formatPercent(-0.5)).toBe("-0.50%");
  });

  it("formats relative time", () => {
    expect(timeAgo(Date.now() - 1000, "en")).toBe("just now");
  });
});

describe("minecraft name validation", () => {
  it("accepts valid names and rejects malformed ones", () => {
    expect(validateMinecraftName("Notch")).toEqual({ valid: true, value: "Notch" });
    expect(validateMinecraftName("ab")).toMatchObject({ valid: false, reason: "length" });
    expect(validateMinecraftName("bad name!")).toMatchObject({ valid: false, reason: "charset" });
    expect(validateMinecraftName("")).toMatchObject({ valid: false, reason: "empty" });
  });
});

describe("skyblock progression math", () => {
  it("converts SkyBlock XP to levels without clamping the cap", () => {
    expect(skyblockLevelFromXp(4850)).toBe(48);
    expect(skyblockLevelProgress(4850)).toBeCloseTo(0.5);
    expect(skyblockLevelFromXp(null)).toBeNull();
  });

  it("computes slayer levels from official thresholds", () => {
    expect(slayerLevelFromXp("zombie", 0).level).toBe(0);
    expect(slayerLevelFromXp("zombie", 5).level).toBe(1);
    expect(slayerLevelFromXp("zombie", 1_000_000).level).toBe(9);
  });

  it("computes catacombs levels", () => {
    expect(dungeoneeringLevelFromXp(0).level).toBe(0);
    expect(dungeoneeringLevelFromXp(50).level).toBe(1);
  });
});

describe("item ids", () => {
  it("prettifies raw ids and known overrides", () => {
    expect(prettifyItemId("ENCHANTED_DIAMOND")).toBe("Enchanted Diamond");
    expect(prettifyItemId("INK_SACK:3")).toBe("Cocoa Beans");
    expect(prettifyItemId("SOME_RANDOM_ITEM")).toBe("Some Random Item");
  });
});
