import { compactInventoryValue } from "@/features/inventory/values";
import type { ReactNode } from "react";
import { cn } from "@/utils/cn";
import { useI18n } from "@/locales";
import { rarityOf } from "@/features/items/rarity";
import { ItemIcon, type ItemIconSize } from "@/components/common/ItemIcon";
import {
  ItemTooltip,
  type ItemTooltipData,
} from "@/components/common/ItemTooltip";

export type ItemSlotData = ItemTooltipData & { slot?: number };

/** A single Minecraft-style inventory slot. Empty slots keep their size. */
export function ItemSlot({
  item,
  size = "sm",
  className,
  onClick,
}: {
  item?: ItemSlotData | null;
  size?: ItemIconSize;
  className?: string;
  onClick?: () => void;
}) {
  const { t } = useI18n();
  const slotClass = cn(
    "group relative flex aspect-square w-full items-center justify-center rounded-[3px] border border-black/50 bg-[#1a1620] p-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-2px_0_rgba(0,0,0,0.45)] transition-colors",
    item
      ? "hover:border-violet/50 hover:bg-[#241d2e]"
      : "border-dashed border-white/5 bg-black/20",
    className,
    item?.valueInfo && "mb-3",
  );

  if (!item) {
    return (
      <div
        className={slotClass}
        role="img"
        aria-label={t("inventory.emptySlot")}
        title={t("inventory.emptySlot")}
      />
    );
  }

  const rarity = rarityOf(item.rarity);

  const content = (
    <ItemIcon
      itemId={item.itemId}
      material={item.material}
      category={item.category}
      name={item.name}
      rarity={item.rarity}
      count={item.count}
      size={size}
      skullTexture={item.skullTexture}
      gemstones={item.gemstoneSlots?.length}
      enchanted={Boolean(
        item.enchantments && Object.keys(item.enchantments).length,
      )}
      className="size-full rounded-[2px] border-0 bg-transparent"
    />
  );

  return (
    <ItemTooltip item={item}>
      <button
        type="button"
        onClick={onClick}
        aria-label={item.name}
        className={cn(
          slotClass,
          "cursor-default focus-visible:outline-2 focus-visible:outline-violet",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[2px] opacity-50",
            rarity.bg,
          )}
        />
        {content}
        {item.valueInfo ? (
          <span
            aria-hidden="true"
            className={cn(
              "pointer-events-none absolute inset-x-0 -bottom-3 z-10 truncate rounded-sm bg-black/85 px-0.5 text-center font-mono text-[8px] leading-[11px]",
              item.valueInfo.state === "stale"
                ? "text-amber"
                : "text-emerald-200",
            )}
          >
            {item.valueInfo.state === "stale"
              ? "~"
              : item.valueInfo.state === "estimated"
                ? "≈"
                : ""}
            {compactInventoryValue(item.valueInfo)}
          </span>
        ) : null}
      </button>
    </ItemTooltip>
  );
}

/** 9-column Minecraft inventory grid; pass null for empty slots. */
export function ItemGrid({
  slots,
  columns = 9,
  label,
  children,
  className,
}: {
  slots: Array<ItemSlotData | null>;
  columns?: number;
  label?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {label ? (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-fg-subtle">
          {label}
        </div>
      ) : null}
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {slots.map((item, index) => (
          <ItemSlot
            key={
              item ? `${item.itemId}-${item.slot ?? index}` : `empty-${index}`
            }
            item={item}
          />
        ))}
      </div>
      {children}
    </div>
  );
}
