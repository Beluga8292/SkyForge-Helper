import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import { rarityOf } from "@/features/items/rarity";
import { ItemIcon } from "@/components/common/ItemIcon";

export { rarityOf, RARITY, RARITY_FALLBACK, type RarityStyle } from "@/features/items/rarity";

export function RarityBadge({ tier, className }: { tier: string | null | undefined; className?: string }) {
  const rarity = rarityOf(tier);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.08em]",
        rarity.border,
        rarity.bg,
        rarity.text,
        className,
      )}
    >
      {rarity.label}
    </span>
  );
}

export function ItemGlyph({
  name,
  tier,
  size = "md",
  className,
  itemId,
  material,
  category,
  count,
  skullTexture,
  gemstones,
  enchanted,
}: {
  name: string;
  tier?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
  /** Optional SkyBlock item id enables the unified texture resolver. */
  itemId?: string | null;
  material?: string | null;
  category?: string | null;
  count?: number;
  skullTexture?: string | null;
  gemstones?: number;
  enchanted?: boolean;
}) {
  return (
    <ItemIcon
      itemId={itemId}
      material={material}
      category={category}
      name={name}
      rarity={tier}
      size={size}
      count={count}
      skullTexture={skullTexture}
      gemstones={gemstones}
      enchanted={enchanted}
      className={className}
    />
  );
}

export function TierText({ children, tier }: { children: ReactNode; tier: string | null | undefined }) {
  return <span className={cn(rarityOf(tier).text)}>{children}</span>;
}
