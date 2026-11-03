import { z } from "zod";
import type { Flip, Valuation } from "./models";
export const ruleSchema = z.object({
  id: z.string().max(100),
  productId: z.string().max(96),
  kind: z.enum([
    "price_below",
    "price_above",
    "spread_above",
    "profit_above",
    "roi_above",
    "score_above",
    "price_change",
    "auction_new",
  ]),
  threshold: z.number().finite().min(-1e15).max(1e15),
  enabled: z.boolean(),
  cooldownMs: z.number().int().min(60000).max(86400000),
  lastSnapshot: z.string().nullable(),
  lastTriggeredAt: z.number().nullable(),
  active: z.boolean(),
  seenAuctions: z.array(z.string()).max(500),
  baselinePrice: z.number().nullable(),
});
export type AlertRule = z.infer<typeof ruleSchema>;
export interface AlertEvent {
  id: string;
  ruleId: string;
  productId: string;
  kind: AlertRule["kind"];
  value: number;
  ts: number;
  snapshot: string;
}
export interface AlertSnapshot {
  id: string;
  stale: boolean;
  demo: boolean;
  flips?: Flip[];
  auctions?: Valuation[];
  source: "bazaar" | "auction";
}
export function evaluateRules(
  input: AlertRule[],
  snapshot: AlertSnapshot,
  now: number,
): { rules: AlertRule[]; events: AlertEvent[] } {
  if (snapshot.demo || snapshot.stale) return { rules: input, events: [] };
  const events: AlertEvent[] = [];
  const rules = input.map((original) => {
    if (
      !original.enabled ||
      original.lastSnapshot === snapshot.id ||
      (original.kind === "auction_new") !== (snapshot.source === "auction")
    )
      return original;
    const r = { ...original, lastSnapshot: snapshot.id };
    let value: number | null = null,
      target = r.productId,
      matched = false;
    if (r.kind === "auction_new") {
      const qualifying = (snapshot.auctions ?? []).filter(
        (a) =>
          a.reference_price !== null &&
          a.confidence !== "insufficient" &&
          (a.discount_pct ?? 0) > r.threshold &&
          (r.productId === "*" || a.item_id === r.productId),
      );
      const unseen = qualifying.filter(
        (a) => !r.seenAuctions.includes(a.auction_id),
      );
      const candidate = unseen[0];
      r.seenAuctions = [
        ...new Set([...r.seenAuctions, ...qualifying.map((a) => a.auction_id)]),
      ].slice(-500);
      if (candidate) {
        value = candidate.discount_pct;
        target = candidate.auction_id;
        matched = true;
      }
      r.active = false;
    } else {
      const f = snapshot.flips?.find((f) => f.product_id === r.productId);
      if (!f) return original;
      value = {
        price_below: f.buy_price,
        price_above: f.buy_price,
        spread_above: f.spread_pct,
        profit_above: f.net_profit,
        roi_above: f.roi,
        score_above: f.scores.overall,
        price_change: f.buy_price,
        auction_new: null,
      }[r.kind];
      if (r.kind === "price_change") {
        const price = f.buy_price;
        value =
          price !== null && r.baselinePrice && r.baselinePrice > 0
            ? (price / r.baselinePrice - 1) * 100
            : null;
        r.baselinePrice = price;
        matched = value !== null && Math.abs(value) > r.threshold;
      } else
        matched =
          value !== null &&
          (r.kind === "price_below"
            ? value < r.threshold
            : value > r.threshold);
    }
    const edge =
      r.kind === "auction_new" || !r.active || r.kind === "price_change";
    if (
      matched &&
      edge &&
      (r.lastTriggeredAt === null || now - r.lastTriggeredAt >= r.cooldownMs) &&
      value !== null
    ) {
      events.push({
        id: `${r.id}:${snapshot.id}:${target}`,
        ruleId: r.id,
        productId: target,
        kind: r.kind,
        value,
        ts: now,
        snapshot: snapshot.id,
      });
      r.lastTriggeredAt = now;
    }
    if (r.kind !== "auction_new") r.active = matched;
    return r;
  });
  return { rules, events };
}
export function newRule(
  productId: string,
  kind: AlertRule["kind"],
  threshold: number,
): AlertRule {
  return {
    id: crypto.randomUUID(),
    productId,
    kind,
    threshold,
    enabled: true,
    cooldownMs: 300000,
    lastSnapshot: null,
    lastTriggeredAt: null,
    active: false,
    seenAuctions: [],
    baselinePrice: null,
  };
}
