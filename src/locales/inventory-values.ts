export const inventoryValuesRu = {
  "invValue.toggle": "Показывать стоимость предметов",
  "invValue.note":
    "Оценки слотов не равны общему Networth. Неизвестные цены и ограничения торговли сохраняются; стоимость не гарантирует выручку.",
  "invValue.unit": "Средняя цена за единицу",
  "invValue.stack": "Стоимость стака",
  "invValue.source": "Источник оценки",
  "invValue.time": "Обновлено",
  "invValue.confidence": "Уверенность",
  "invValue.coverage": "Покрытие Networth",
  "invValue.known": "Известная котировка",
  "invValue.estimated": "Ориентировочная стоимость",
  "invValue.unknown": "Неизвестная цена",
  "invValue.unavailable": "Оценка недоступна",
  "invValue.stale": "Устаревшая оценка",
  "invValue.tradeable": "Торговля подтверждена metadata",
  "invValue.soulbound": "Soulbound — продажа ограничена",
  "invValue.untradeable": "Неторгуемый предмет",
  "invValue.tradeUnknown": "Статус торговли неизвестен",
  "invValue.sellable": "Оценка продаваемой стоимости",
  "invValue.partial":
    "Общая оценка неполная; часть активов или цен отсутствует.",
  "invValue.variant":
    "Вариант или количество не совпало с оценкой — цена не перенесена.",
  "invValue.bazaar": "Bazaar: котировка экземпляра/стака",
  "invValue.auction":
    "Auction: оценка сопоставимых listings, не состоявшаяся продажа",
  "invValue.topup":
    "Дополнительная локальная оценка Bazaar (отдельно от Known Networth)",
  "invValue.other": "Источник не подтверждён",
  "invValue.error":
    "Не удалось обновить оценки. Предметы и последние доступные данные сохранены.",
  "invValue.hidden": "Баланс скрыт: overlay отключён настройкой приватности.",
} as const;
export const inventoryValuesEn: Record<keyof typeof inventoryValuesRu, string> =
  {
    "invValue.toggle": "Show item values",
    "invValue.note":
      "Slot estimates are not total Networth. Unknown prices and trading restrictions remain explicit; value is not guaranteed sale proceeds.",
    "invValue.unit": "Average unit value",
    "invValue.stack": "Stack value",
    "invValue.source": "Valuation source",
    "invValue.time": "Last updated",
    "invValue.confidence": "Confidence",
    "invValue.coverage": "Networth coverage",
    "invValue.known": "Known quote",
    "invValue.estimated": "Estimated value",
    "invValue.unknown": "Unknown price",
    "invValue.unavailable": "Valuation unavailable",
    "invValue.stale": "Stale valuation",
    "invValue.tradeable": "Trading confirmed by metadata",
    "invValue.soulbound": "Soulbound — trading restricted",
    "invValue.untradeable": "Untradeable item",
    "invValue.tradeUnknown": "Tradeability unknown",
    "invValue.sellable": "Estimated sellable value",
    "invValue.partial":
      "Overall valuation is partial; some assets or prices are unavailable.",
    "invValue.variant":
      "Variant or quantity differs from the valuation — price not transferred.",
    "invValue.bazaar": "Bazaar: instance/stack quote",
    "invValue.auction":
      "Auction: comparable listing estimate, not a completed sale",
    "invValue.topup":
      "Additional local Bazaar estimate (separate from Known Networth)",
    "invValue.other": "Unconfirmed source",
    "invValue.error":
      "Could not refresh valuations. Items and last available data are retained.",
    "invValue.hidden": "Balances hidden: overlay disabled by privacy settings.",
  };
