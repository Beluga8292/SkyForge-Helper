export const MINECRAFT_NAME_REGEX = /^[A-Za-z0-9_]{3,16}$/;

export type NameValidation = { valid: true; value: string } | { valid: false; reason: "empty" | "length" | "charset" };

export function validateMinecraftName(input: string): NameValidation {
  const value = input.trim();
  if (!value) return { valid: false, reason: "empty" };
  if (value.length < 3 || value.length > 16) return { valid: false, reason: "length" };
  if (!MINECRAFT_NAME_REGEX.test(value)) return { valid: false, reason: "charset" };
  return { valid: true, value };
}

export function isValidUuid(input: string): boolean {
  return /^[0-9a-f]{32}$/i.test(input.replace(/-/g, ""));
}

export function normalizeUuid(input: string): string {
  return input.replace(/-/g, "").toLowerCase();
}

export function parsePositiveNumber(input: string): number | null {
  const normalized = input.replace(/\s/g, "").replace(",", ".");
  if (!normalized) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
