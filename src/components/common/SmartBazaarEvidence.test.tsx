import { it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SmartBazaarEvidence } from "./SmartBazaarEvidence";
import { calculateMarketFlip } from "@/features/market/engine";
import type { BazaarProduct } from "@/types/hypixel";
const now = Date.now(),
  meta = {
    fetched_at: new Date(now).toISOString(),
    fetched_at_ms: now,
    cache_age_ms: 0,
    stale: false,
    source: "cache",
  };
const product: BazaarProduct = {
  product_id: "X",
  buy_summary: [{ pricePerUnit: 120, amount: 10000, orders: 1 }],
  sell_summary: [{ pricePerUnit: 100, amount: 10000, orders: 1 }],
};
it("renders limited confidence, unknown fill time and quantity-wide fees", () => {
  const row = calculateMarketFlip("X", product, "order", 64, 1.25);
  const html = renderToStaticMarkup(
    <SmartBazaarEvidence row={row} meta={meta} />,
  );
  expect(html).toContain("Ограниченная уверенность");
  expect(html).toContain("96");
  expect(html).toContain("Время исполнения");
  expect(html).toContain("Неизвестно");
  expect(html).not.toContain("NaN");
});
it("shows stale and invalid-data explanations without nonfinite amounts", () => {
  const row = {
    ...calculateMarketFlip("X", product, "order", 64, 1.25),
    sell_price: Infinity,
  };
  const html = renderToStaticMarkup(
    <SmartBazaarEvidence row={row} meta={{ ...meta, stale: true }} />,
  );
  expect(html).toContain("Котировки или итоговая арифметика некорректны");
  expect(html).toContain("Данные устарели");
  expect(html).not.toContain("Infinity");
});
