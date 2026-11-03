import { useQuery } from "@tanstack/react-query";
import { useDataProvider, useDataScope } from "@/data";
import { AuctionDialog } from "@/pages/AuctionPage";
import type { MarketMeta, Valuation } from "@/features/market/models";
import { assessAuction } from "@/features/market/smart-auction";
import { useI18n } from "@/locales";
import { formatPrice } from "@/utils/format";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
} from "@/components/ui/dialog";
import { ErrorState } from "./States";
import { Skeleton } from "@/components/ui/skeleton";
export function SmartAuctionSummary({
  row,
  meta,
  feePct,
  listingFee,
  partial = false,
}: {
  row: Valuation;
  meta: MarketMeta;
  feePct?: number;
  listingFee?: number;
  partial?: boolean;
}) {
  const { t } = useI18n(),
    e = assessAuction(row, meta, feePct, listingFee, partial);
  const fmt = (x: number | null) =>
    x === null ? t("smart.unknown") : formatPrice(x);
  return (
    <section className="my-3 space-y-1 rounded-lg border border-line p-3 text-xs text-fg-muted">
      <p>
        BIN: {fmt(row.listing_price)} · {t("market.reference")}:{" "}
        {fmt(row.reference_price)}
      </p>
      <p>
        {t("auctionSmart.gross")}: {fmt(e.gross)} ·{" "}
        {t("auctionSmart.totalFees")}: {fmt(e.fees)}
      </p>
      <p>
        {t("market.upside")}: {fmt(e.net)} · ROI:{" "}
        {e.roi === null ? t("smart.unknown") : `${fmt(e.roi)}%`}
      </p>
      <p>
        {t("auctionSmart.risk")}: {fmt(e.risk)} ·{" "}
        {t(`market.confidence.${e.confidence}`)}
      </p>
      <p>
        {t("market.comparables", { count: row.sample_size })} ·{" "}
        {t("auctionSmart.age")}:{" "}
        {e.ageMs === null
          ? t("smart.unknown")
          : `${Math.floor(e.ageMs / 1000)} s`}
      </p>
      <ul className="list-inside list-disc">
        {e.reasons.map((r) => (
          <li key={r}>{t(`auctionSmart.reason.${r}`)}</li>
        ))}
      </ul>
      <p>{t("auctionSmart.formula")}</p>
      <p>{t("auctionSmart.assumptions")}</p>
    </section>
  );
}
export function SmartAuctionDetails(props: {
  row: Valuation;
  meta: MarketMeta;
  feePct?: number;
  listingFee?: number;
  partial?: boolean;
  onClose: () => void;
}) {
  const provider = useDataProvider(),
    scope = useDataScope(),
    { t } = useI18n();
  const query = useQuery({
    queryKey: ["smart-auction-detail", scope, props.row.auction_id],
    queryFn: ({ signal }) => provider.getAuction(props.row.auction_id, signal),
    staleTime: 45000,
    retry: 0,
    refetchOnWindowFocus: false,
  });
  const auction = query.data?.data;
  if (
    auction &&
    auction.uuid === props.row.auction_id &&
    auction.bin &&
    auction.starting_bid === props.row.listing_price
  )
    return (
      <AuctionDialog
        auction={auction}
        marketEstimate={props.row.reference_price}
        open
        now={Date.now()}
        onOpenChange={(v) => !v && props.onClose()}
        additionalContent={<SmartAuctionSummary {...props} />}
      />
    );
  return (
    <Dialog open onOpenChange={(v) => !v && props.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.row.name}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {query.isPending ? (
            <Skeleton className="h-40" />
          ) : (
            <ErrorState
              error={query.error ?? new Error(t("auctionSmart.mismatch"))}
              onRetry={() => void query.refetch()}
            />
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
