import { expect, it } from "vitest";
import { profilesResponseSchema } from "./schemas";
// Minimal structural reproduction of actual local backend payload (no player data).
it("accepts nullable backend metadata without inventing timestamps or game mode", () => {
  const p = profilesResponseSchema.parse({
    success: true,
    profiles: [
      {
        profile_id: "profile",
        game_mode: null,
        members: {
          member: {
            first_join: null,
            last_save: null,
            inventory: { inv_armor: { data: "" } },
          },
        },
      },
    ],
  });
  expect(p.profiles?.[0]?.game_mode).toBeUndefined();
  expect(p.profiles?.[0]?.members?.member?.first_join).toBeUndefined();
});
it("accepts partial members but still rejects invalid metadata types", () => {
  expect(
    profilesResponseSchema.safeParse({
      success: true,
      profiles: [{ members: { member: {} } }],
    }).success,
  ).toBe(true);
  expect(
    profilesResponseSchema.safeParse({
      success: true,
      profiles: [{ members: { member: { last_save: "invalid" } } }],
    }).success,
  ).toBe(false);
});
