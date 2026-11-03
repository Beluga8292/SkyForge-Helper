import type { InventoryValue } from "@/features/inventory/values";
import { InventoryValueInfo } from "./InventoryValueInfo";
import type { ReactNode } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { ItemIcon } from "@/components/common/ItemIcon";
import { rarityOf } from "@/features/items/rarity";
import { useI18n } from "@/locales";
import { LORE_COLOR_HEX, parseLore, type LoreLine } from "@/utils/item-lore";
import { formatCoins } from "@/utils/format";
import { cn } from "@/utils/cn";

export interface ItemTooltipData {
  valueInfo?: InventoryValue;
  itemId?: string | null;
  name: string;
  rarity?: string | null;
  category?: string | null;
  material?: string | null;
  lore?: string[];
  loreLines?: LoreLine[];
  count?: number;
  stars?: number;
  masterStars?: number;
  recombobulated?: boolean;
  hotPotatoBooks?: number;
  fumingPotatoBooks?: number;
  reforge?: string | null;
  enchantments?: Record<string, number>;
  gemstoneSlots?: string[];
  soulbound?: boolean;
  skullTexture?: string | null;
  value?: number | null;
  /** Local estimate shown only when no confirmed value exists. */
  estimatedValue?: number | null;
  valueMethod?: string | null;
  location?: string | null;
}

function LoreSegmentLine({ line }: { line: LoreLine }) {
  return (
    <p className="min-h-[1.1em] whitespace-pre-wrap break-words">
      {line.segments.map((segment, index) => (
        <span
          key={index}
          style={{
            color: segment.color ? LORE_COLOR_HEX[segment.color] : undefined,
            fontWeight: segment.bold ? 700 : undefined,
            fontStyle: segment.italic ? "italic" : undefined,
            textDecoration:
              [
                segment.underlined ? "underline" : "",
                segment.strikethrough ? "line-through" : "",
              ]
                .filter(Boolean)
                .join(" ") || undefined,
          }}
        >
          {segment.text}
        </span>
      ))}
    </p>
  );
}

export function ItemTooltipContent({ item }: { item: ItemTooltipData }) {
  const { t } = useI18n();
  const rarity = rarityOf(item.rarity);
  const lines = item.loreLines?.length
    ? item.loreLines
    : parseLore(item.lore ?? []);
  const enchantments = Object.entries(item.enchantments ?? {}).sort(
    ([a], [b]) => a.localeCompare(b),
  );
  const estimated =
    !item.valueMethod || !/confirmed|reference/i.test(item.valueMethod);

  return (
    <div className="w-64 max-w-[18rem] select-none font-[Minecraft,monospace] text-[11.5px] leading-[1.35]">
      <div className="flex items-baseline justify-between gap-2">
        <p
          className={cn(
            "font-semibold drop-shadow-[0_1px_0_rgba(0,0,0,0.8)]",
            rarity.text,
          )}
        >
          {item.name}
        </p>
        {item.count && item.count > 1 ? (
          <span className="shrink-0 font-mono text-[9.5px] text-slate-400">
            ×{item.count}
          </span>
        ) : null}
      </div>
      <span
        className={cn(
          "mt-1 block h-px w-full bg-current opacity-35",
          rarity.text,
        )}
      />
      {lines.length ? (
        <div className="mt-1 space-y-0.5 text-slate-200">
          {lines.map((line, index) => (
            <LoreSegmentLine key={index} line={line} />
          ))}
        </div>
      ) : null}

      <div className="mt-2 space-y-0.5 border-t border-white/10 pt-2 text-[10.5px] text-slate-300">
        {item.stars ? (
          <p>
            {t("inventory.stars")}:{" "}
            <span className="text-amber">{item.stars}★</span>
          </p>
        ) : null}
        {item.masterStars ? <p>Master Stars: {item.masterStars}✪</p> : null}
        {item.recombobulated ? <p>{t("inventory.recomb")}</p> : null}
        {item.hotPotatoBooks ? (
          <p>
            {t("inventory.hpb")}: {item.hotPotatoBooks}/10
          </p>
        ) : null}
        {item.fumingPotatoBooks ? (
          <p>
            {t("inventory.fuming")}: {item.fumingPotatoBooks}/5
          </p>
        ) : null}
        {item.reforge ? (
          <p>
            {t("inventory.reforge")}:{" "}
            <span className="text-cyan">{item.reforge}</span>
          </p>
        ) : null}
        {item.gemstoneSlots?.length ? (
          <p className="flex flex-wrap items-center gap-1">
            {t("inventory.gems")}:
            {item.gemstoneSlots.map((gem) => (
              <span
                key={gem}
                className="rounded border border-cyan/30 bg-cyan/10 px-1 py-px font-mono text-[9px] text-cyan"
              >
                {gem}
              </span>
            ))}
          </p>
        ) : null}
        {item.soulbound ? (
          <p className="text-fuchsia-300">{t("inventory.soulbound")}</p>
        ) : null}
        {enchantments.length ? (
          <p className="break-words">
            {t("inventory.enchants")}:{" "}
            <span className="text-emerald-300">
              {enchantments.map(([id, level]) => `${id} ${level}`).join(", ")}
            </span>
          </p>
        ) : null}
        {item.valueInfo ? <InventoryValueInfo value={item.valueInfo} /> : null}
        {!item.valueInfo && item.value != null ? (
          <p className="flex flex-wrap items-baseline gap-1">
            {estimated ? t("tooltip.estimated") : t("tooltip.confirmed")}:
            <span className="font-semibold text-amber">
              {formatCoins(item.value)}
            </span>
            {item.valueMethod ? (
              <span className="font-mono text-[9px] text-slate-500">
                {item.valueMethod}
              </span>
            ) : null}
          </p>
        ) : !item.valueInfo && item.estimatedValue != null ? (
          <p className="flex flex-wrap items-baseline gap-1">
            {t("tooltip.estimated")}:
            <span className="font-semibold text-amber/80">
              ≈ {formatCoins(item.estimatedValue)}
            </span>
          </p>
        ) : null}
        {item.location ? (
          <p className="text-slate-400">{item.location}</p>
        ) : null}
        {item.itemId ? (
          <p className="font-mono text-[9px] text-slate-500">{item.itemId}</p>
        ) : null}
      </div>
    </div>
  );
}

export function ItemTooltip({
  item,
  children,
  side = "right",
}: {
  item: ItemTooltipData;
  children: ReactNode;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <Tooltip
      side={side}
      bare
      content={
        <div className="max-h-[var(--radix-tooltip-content-available-height)] w-[17.5rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-[3px] border-2 border-[#2d0b46] bg-[linear-gradient(160deg,#1a0c28_0%,#0d0616_52%,#140a20_100%)] p-[3px] shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_14px_34px_rgba(0,0,0,0.65)]">
          <div className="rounded-[1px] border border-white/10 p-2.5">
            <ItemTooltipContent item={item} />
          </div>
        </div>
      }
    >
      {children}
    </Tooltip>
  );
}

export function InventoryItem({
  item,
  size = "md",
  className,
}: {
  item: ItemTooltipData & { slot?: number };
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <ItemTooltip item={item}>
      <button
        type="button"
        className={cn(
          "flex items-center justify-center rounded-lg border border-line bg-surface-2/40 p-0.5 transition-colors hover:border-violet/40 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-violet",
          className,
        )}
      >
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
        />
      </button>
    </ItemTooltip>
  );
}
