export interface RarityStyle {
  label: string;
  border: string;
  bg: string;
  text: string;
  glow: string;
}

export const RARITY: Record<string, RarityStyle> = {
  COMMON: { label: "Common", border: "border-slate-400/25", bg: "bg-slate-400/10", text: "text-slate-300", glow: "from-slate-400/20" },
  UNCOMMON: { label: "Uncommon", border: "border-green/25", bg: "bg-green/10", text: "text-green", glow: "from-green/20" },
  RARE: { label: "Rare", border: "border-blue/25", bg: "bg-blue/10", text: "text-blue", glow: "from-blue/25" },
  EPIC: { label: "Epic", border: "border-violet/25", bg: "bg-violet/10", text: "text-violet", glow: "from-violet/25" },
  LEGENDARY: { label: "Legendary", border: "border-amber/30", bg: "bg-amber/10", text: "text-amber", glow: "from-amber/25" },
  MYTHIC: { label: "Mythic", border: "border-pink-400/30", bg: "bg-pink-400/10", text: "text-pink-300", glow: "from-pink-400/25" },
  DIVINE: { label: "Divine", border: "border-cyan/30", bg: "bg-cyan/10", text: "text-cyan", glow: "from-cyan/25" },
  SPECIAL: { label: "Special", border: "border-red/30", bg: "bg-red/10", text: "text-red", glow: "from-red/25" },
  VERY_SPECIAL: { label: "Special", border: "border-red/30", bg: "bg-red/10", text: "text-red", glow: "from-red/25" },
};

export const RARITY_FALLBACK: RarityStyle = {
  label: "Unknown",
  border: "border-line-strong",
  bg: "bg-surface-2",
  text: "text-fg-muted",
  glow: "from-white/10",
};

export function rarityOf(tier: string | null | undefined): RarityStyle {
  return (tier ? RARITY[tier.toUpperCase()] : undefined) ?? RARITY_FALLBACK;
}
