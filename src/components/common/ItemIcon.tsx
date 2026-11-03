import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import { rarityOf } from "@/features/items/rarity";
import { iconForItem, iconKindLabel, type ItemIconKind } from "@/features/items/icons";
import { useItemRegistryEntry } from "@/features/items/registry";
import { useItemTexture } from "@/features/textures/resolver";

export type ItemIconSize = "xs" | "sm" | "md" | "lg";

const DIMENSIONS: Record<ItemIconSize, string> = {
  xs: "size-6 rounded-md text-[8px]",
  sm: "size-8 rounded-lg text-[10px]",
  md: "size-10 rounded-xl text-[12px]",
  lg: "size-14 rounded-2xl text-[16px]",
};

function Sprite({ kind }: { kind: ItemIconKind }) {
  const common = {
    fill: "currentColor",
    shapeRendering: "crispEdges" as const,
  };
  const light = { fill: "white", opacity: 0.38, shapeRendering: "crispEdges" as const };
  const dark = { fill: "black", opacity: 0.28, shapeRendering: "crispEdges" as const };

  switch (kind) {
    case "sword":
      return (
        <>
          <rect x="7" y="1" width="2" height="9" {...common} />
          <rect x="8" y="2" width="1" height="8" {...light} />
          <rect x="5" y="10" width="6" height="1" {...common} />
          <rect x="4" y="11" width="8" height="1" {...dark} />
          <rect x="7" y="11" width="2" height="4" {...common} />
          <rect x="6" y="14" width="4" height="1" {...common} />
        </>
      );
    case "bow":
      return (
        <>
          <path d="M4 2 Q12 8 4 14" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M4 2 L4 14" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
          <rect x="7" y="7" width="6" height="1" {...common} />
          <rect x="11" y="6" width="2" height="1" {...light} />
        </>
      );
    case "helmet":
      return (
        <>
          <rect x="3" y="3" width="10" height="2" {...common} />
          <rect x="2" y="5" width="2" height="6" {...common} />
          <rect x="12" y="5" width="2" height="6" {...common} />
          <rect x="4" y="5" width="8" height="4" {...dark} />
          <rect x="5" y="9" width="6" height="3" {...common} />
          <rect x="7" y="10" width="2" height="2" {...light} />
        </>
      );
    case "chestplate":
      return (
        <>
          <rect x="3" y="3" width="10" height="3" {...common} />
          <rect x="2" y="5" width="2" height="7" {...common} />
          <rect x="12" y="5" width="2" height="7" {...common} />
          <rect x="5" y="6" width="6" height="7" {...dark} />
          <rect x="6" y="7" width="4" height="5" {...common} />
          <rect x="7" y="3" width="2" height="2" {...light} />
        </>
      );
    case "leggings":
      return (
        <>
          <rect x="3" y="3" width="10" height="3" {...common} />
          <rect x="3" y="6" width="4" height="8" {...common} />
          <rect x="9" y="6" width="4" height="8" {...common} />
          <rect x="4" y="7" width="2" height="6" {...light} />
          <rect x="10" y="7" width="2" height="6" {...light} />
          <rect x="7" y="6" width="2" height="3" {...dark} />
        </>
      );
    case "boots":
      return (
        <>
          <rect x="3" y="4" width="4" height="7" {...common} />
          <rect x="9" y="4" width="4" height="7" {...common} />
          <rect x="2" y="11" width="6" height="2" {...common} />
          <rect x="8" y="11" width="6" height="2" {...common} />
          <rect x="4" y="5" width="1" height="5" {...light} />
          <rect x="10" y="5" width="1" height="5" {...light} />
        </>
      );
    case "pickaxe":
      return (
        <>
          <rect x="3" y="2" width="10" height="2" {...common} />
          <rect x="2" y="3" width="2" height="2" {...common} />
          <rect x="12" y="3" width="2" height="2" {...common} />
          <rect x="7" y="4" width="2" height="10" {...common} />
          <rect x="8" y="5" width="1" height="8" {...light} />
        </>
      );
    case "drill":
      return (
        <>
          <rect x="4" y="2" width="8" height="4" {...common} />
          <rect x="3" y="3" width="2" height="2" {...light} />
          <rect x="6" y="6" width="4" height="3" {...dark} />
          <rect x="7" y="9" width="2" height="5" {...common} />
          <rect x="6" y="13" width="4" height="1" {...common} />
          <rect x="11" y="7" width="3" height="2" {...common} />
        </>
      );
    case "axe":
      return (
        <>
          <rect x="4" y="2" width="6" height="5" {...common} />
          <rect x="3" y="3" width="2" height="3" {...light} />
          <rect x="7" y="6" width="2" height="8" {...common} />
          <rect x="8" y="7" width="1" height="6" {...dark} />
        </>
      );
    case "shovel":
      return (
        <>
          <rect x="7" y="2" width="2" height="8" {...common} />
          <rect x="5" y="9" width="6" height="4" {...common} />
          <rect x="6" y="10" width="4" height="2" {...light} />
          <rect x="6" y="13" width="4" height="1" {...dark} />
        </>
      );
    case "fishing-rod":
      return (
        <>
          <rect x="2" y="2" width="2" height="12" {...common} />
          <path d="M4 3 Q11 4 12 11" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <rect x="11" y="10" width="2" height="2" {...light} />
          <rect x="10" y="13" width="3" height="1" {...common} />
        </>
      );
    case "gem":
      return (
        <>
          <path d="M4 3 L12 3 L14 7 L8 14 L2 7 Z" {...common} />
          <path d="M4 4 L12 4 L13 7 L8 12 L3 7 Z" {...light} />
          <path d="M8 4 L10 7 L8 12 L6 7 Z" {...dark} />
        </>
      );
    case "potion":
      return (
        <>
          <rect x="6" y="1" width="4" height="2" {...common} />
          <rect x="6" y="3" width="4" height="2" {...light} />
          <rect x="5" y="5" width="6" height="2" {...common} />
          <rect x="4" y="7" width="8" height="7" {...common} />
          <rect x="5" y="8" width="6" height="5" {...light} />
          <rect x="5" y="11" width="6" height="2" {...dark} />
        </>
      );
    case "book":
      return (
        <>
          <rect x="3" y="2" width="10" height="12" {...common} />
          <rect x="4" y="3" width="8" height="10" {...light} />
          <rect x="5" y="4" width="6" height="1" {...dark} />
          <rect x="5" y="6" width="6" height="1" {...dark} />
          <rect x="5" y="8" width="4" height="1" {...dark} />
          <rect x="3" y="2" width="2" height="12" {...dark} />
        </>
      );
    case "pet":
      return (
        <>
          <rect x="4" y="5" width="8" height="7" {...common} />
          <rect x="3" y="3" width="3" height="3" {...common} />
          <rect x="10" y="3" width="3" height="3" {...common} />
          <rect x="5" y="7" width="2" height="2" {...light} />
          <rect x="9" y="7" width="2" height="2" {...light} />
          <rect x="6" y="10" width="4" height="2" {...dark} />
        </>
      );
    case "coin":
      return (
        <>
          <circle cx="8" cy="8" r="6" {...common} />
          <circle cx="8" cy="8" r="4" fill="white" opacity="0.24" />
          <rect x="7" y="4" width="2" height="8" {...dark} />
          <rect x="5" y="7" width="6" height="2" {...dark} />
        </>
      );
    case "essence":
      return (
        <>
          <path d="M8 1 L12 5 L10 14 L6 14 L4 5 Z" {...common} />
          <path d="M8 3 L10 6 L9 12 L7 12 L6 6 Z" {...light} />
          <circle cx="8" cy="7" r="1.5" fill="white" opacity="0.7" />
        </>
      );
    case "potato":
      return (
        <>
          <ellipse cx="8" cy="9" rx="5" ry="4" {...common} />
          <ellipse cx="8" cy="8" rx="3" ry="2" {...light} />
          <rect x="5" y="11" width="1" height="1" {...dark} />
          <rect x="10" y="6" width="1" height="1" {...dark} />
        </>
      );
    case "backpack":
      return (
        <>
          <rect x="3" y="4" width="10" height="10" {...common} />
          <rect x="5" y="2" width="6" height="3" {...common} />
          <rect x="5" y="7" width="6" height="5" {...light} />
          <rect x="7" y="8" width="2" height="2" {...dark} />
          <rect x="4" y="12" width="8" height="1" {...dark} />
        </>
      );
    case "accessory":
      return (
        <>
          <circle cx="8" cy="9" r="5" fill="none" stroke="currentColor" strokeWidth="2" />
          <rect x="6" y="2" width="4" height="3" {...common} />
          <rect x="7" y="8" width="2" height="2" {...light} />
        </>
      );
    case "block":
      return (
        <>
          <rect x="3" y="3" width="10" height="10" {...common} />
          <rect x="4" y="4" width="4" height="4" {...light} />
          <rect x="9" y="9" width="3" height="3" {...dark} />
          <rect x="3" y="3" width="10" height="1" {...light} />
        </>
      );
    case "food":
      return (
        <>
          <path d="M4 6 Q8 2 12 6 L12 12 Q8 15 4 12 Z" {...common} />
          <path d="M6 7 Q8 5 10 7 L10 11 Q8 12 6 11 Z" {...light} />
          <rect x="7" y="3" width="2" height="2" {...dark} />
        </>
      );
    case "tool":
      return (
        <>
          <rect x="3" y="7" width="10" height="3" {...common} />
          <rect x="5" y="4" width="6" height="3" {...common} />
          <rect x="4" y="8" width="2" height="1" {...light} />
          <rect x="9" y="5" width="1" height="1" {...light} />
        </>
      );
    case "misc":
    default:
      return (
        <>
          <rect x="3" y="3" width="10" height="10" {...common} opacity={0.8} />
          <rect x="5" y="5" width="6" height="6" {...light} />
          <rect x="7" y="7" width="2" height="2" {...dark} />
        </>
      );
  }
}

export function ItemIcon({
  itemId,
  material,
  category,
  name,
  rarity,
  size = "md",
  count,
  className,
  title,
  skullTexture,
  gemstones,
  enchanted,
}: {
  itemId?: string | null;
  material?: string | null;
  category?: string | null;
  name?: string | null;
  rarity?: string | null;
  size?: ItemIconSize;
  count?: number;
  className?: string;
  title?: string;
  skullTexture?: string | null;
  gemstones?: number;
  enchanted?: boolean;
}) {
  const registry = useItemRegistryEntry(itemId);
  const effectiveMaterial = material ?? registry?.material ?? null;
  const effectiveCategory = category ?? registry?.category ?? null;
  const effectiveRarity = rarity ?? registry?.tier ?? null;
  const kind = iconForItem({
    itemId,
    material: effectiveMaterial,
    category: effectiveCategory,
  });
  const { texture, loading } = useItemTexture({
    itemId,
    material: effectiveMaterial,
    skullTexture,
    name,
  });
  const awaitingTexture = loading && Boolean(itemId || effectiveMaterial || skullTexture);
  const style = rarityOf(effectiveRarity);
  const label = title ?? name ?? itemId ?? "item";
  const initials = (name ?? itemId ?? "?")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden border bg-gradient-to-br to-transparent font-semibold uppercase",
        DIMENSIONS[size],
        style.border,
        style.glow,
        style.text,
        className,
      )}
      title={texture ? label : kind ? `${label} · ${iconKindLabel(kind)}` : label}
      aria-label={label}
      data-texture-source={texture?.source}
    >
      <span className="absolute inset-x-0 top-0 h-px bg-white/20" />
      {texture ? (
        <img
          src={texture.url}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
          className="relative size-[82%] object-contain [image-rendering:pixelated]"
        />
      ) : awaitingTexture ? (
        <span
          className="relative size-[46%] animate-pulse rounded-[2px] bg-white/10"
          aria-hidden="true"
          data-item-placeholder="loading"
        />
      ) : kind ? (
        <svg viewBox="0 0 16 16" className="relative size-[64%]" aria-hidden="true">
          <Sprite kind={kind} />
        </svg>
      ) : (
        <span className="relative">{initials || "?"}</span>
      )}
      {enchanted ? (
        <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(196,132,252,0.32),transparent_45%,rgba(196,132,252,0.22))] mix-blend-screen" />
      ) : null}
      {gemstones ? (
        <span className="absolute bottom-0 left-0 flex gap-px rounded-tr-md bg-black/65 px-0.5 py-px">
          {Array.from({ length: Math.min(4, gemstones) }).map((_, index) => (
            <span key={index} className="size-1 rounded-[1px] bg-cyan shadow-[0_0_3px_rgba(34,211,238,0.8)]" />
          ))}
        </span>
      ) : null}
      {count && count > 1 ? (
        <span className="absolute bottom-0 right-0 rounded-tl-md bg-black/70 px-1 font-mono text-[8px] leading-[11px] text-white">
          {count > 999 ? "999+" : count}
        </span>
      ) : null}
    </span>
  );
}

export function ItemIconStack({
  items,
  size = "sm",
  max = 4,
}: {
  items: Array<{ itemId?: string | null; name?: string | null; rarity?: string | null }>;
  size?: ItemIconSize;
  max?: number;
}): ReactNode {
  return (
    <span className="flex -space-x-1.5">
      {items.slice(0, max).map((item, index) => (
        <ItemIcon
          key={`${item.itemId ?? item.name ?? "item"}-${index}`}
          itemId={item.itemId}
          name={item.name}
          rarity={item.rarity}
          size={size}
          className="ring-2 ring-surface"
        />
      ))}
    </span>
  );
}
