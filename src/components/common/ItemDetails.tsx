import type { ReactNode } from "react";
import { ExternalLink, Info } from "lucide-react";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ItemIcon } from "@/components/common/ItemIcon";
import {
  ItemTooltipContent,
  type ItemTooltipData,
} from "@/components/common/ItemTooltip";
import { rarityOf } from "@/features/items/rarity";
import { useI18n } from "@/locales";
import { formatCoins } from "@/utils/format";
import { cn } from "@/utils/cn";

/**
 * Accessible, read-only item details panel. Used by Networth, inventories and
 * other screens that need more room than a hover tooltip.
 */
export function ItemDetails({
  item,
  open,
  onOpenChange,
  footer,
}: {
  item: ItemTooltipData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  footer?: ReactNode;
}) {
  const { t, language } = useI18n();
  if (!item) return null;
  const rarity = rarityOf(item.rarity);
  const hasValue = item.value != null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 pr-2">
            <ItemIcon
              itemId={item.itemId}
              material={item.material}
              category={item.category}
              name={item.name}
              rarity={item.rarity}
              count={item.count}
              size="lg"
              skullTexture={item.skullTexture}
              gemstones={item.gemstoneSlots?.length}
              enchanted={Boolean(item.enchantments && Object.keys(item.enchantments).length)}
            />
            <div className="min-w-0">
              <DialogTitle className={cn("truncate", rarity.text)}>{item.name}</DialogTitle>
              <DialogDescription asChild>
                <div className="flex flex-wrap items-center gap-1.5">
                  {item.rarity ? <Badge variant="outline">{item.rarity}</Badge> : null}
                  {item.category ? <Badge variant="outline">{item.category}</Badge> : null}
                  {item.soulbound ? <Badge variant="violet">{t("networth.soulbound")}</Badge> : null}
                  {item.count && item.count > 1 ? (
                    <Badge variant="outline">×{item.count}</Badge>
                  ) : null}
                </div>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <div className="rounded-[3px] border-2 border-[#2d0b46] bg-[linear-gradient(160deg,#1a0c28_0%,#0d0616_52%,#140a20_100%)] p-[3px] shadow-[0_0_0_1px_rgba(0,0,0,0.9),0_14px_34px_rgba(0,0,0,0.55)]">
            <div className="rounded-[1px] border border-white/10 p-3.5">
              <ItemTooltipContent item={item} />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <DetailRow
              label={t("itemDetails.estimatedValue")}
              value={hasValue ? formatCoins(item.value, language) : t("networth.noValue")}
              tone={hasValue ? "amber" : "muted"}
            />
            {item.valueMethod ? (
              <DetailRow label={t("itemDetails.valueMethod")} value={item.valueMethod} />
            ) : null}
            {item.location ? (
              <DetailRow label={t("itemDetails.location")} value={item.location} />
            ) : null}
            {item.itemId ? (
              <DetailRow label={t("itemDetails.itemId")} value={item.itemId} mono />
            ) : null}
          </div>

          {!hasValue ? (
            <p className="flex items-start gap-2 rounded-lg border border-amber/20 bg-amber/[0.04] px-3 py-2 text-[10.5px] leading-relaxed text-amber/90">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              {t("itemDetails.unknownValueNote")}
            </p>
          ) : null}
        </DialogBody>

        {footer ? <DialogFooter>{footer}</DialogFooter> : null}
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
  tone = "default",
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "default" | "amber" | "muted";
}) {
  return (
    <div className="rounded-lg border border-line bg-surface-2/30 px-3 py-2">
      <p className="text-[9px] uppercase tracking-[0.07em] text-fg-subtle">{label}</p>
      <p
        className={cn(
          "mt-0.5 truncate text-[11.5px]",
          mono && "font-mono",
          tone === "amber" ? "text-amber" : tone === "muted" ? "text-fg-subtle" : "text-fg",
        )}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

export function ItemDetailsTrigger({
  item,
  onClick,
  children,
}: {
  item: ItemTooltipData;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={item.name}
      className="group flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface-2/30 p-2.5 text-left transition-colors hover:border-violet/35 hover:bg-surface-2/50 focus-visible:outline-2 focus-visible:outline-violet"
    >
      {children}
      <ExternalLink className="size-3 shrink-0 text-fg-subtle transition-colors group-hover:text-violet" />
    </button>
  );
}
