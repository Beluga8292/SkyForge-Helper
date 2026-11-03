export const smartRu = {
  "smart.reason.position_unknown": "Доля позиции в стакане неизвестна",
  "smart.title": "Smart Flip Finder",
  "smart.heuristic":
    "Рейтинг 0–100 — эвристика, а не вероятность сделки. При недостатке данных риск и рейтинг неизвестны. Прибыль потенциальная, исполнение не гарантируется.",
  "smart.pageScope":
    "Дополнительные фильтры и сортировка применяются только к загруженной странице. Основные фильтры капитала, ROI и ликвидности применяются сервером ко всему доступному снимку.",
  "smart.maxRisk": "Максимальный известный риск",
  "smart.maxAge": "Свежесть котировок",
  "smart.all": "Без ограничения (включая Unknown)",
  "smart.sort": "Дополнительная сортировка страницы",
  "smart.provider": "Серверная сортировка",
  "smart.risk": "Риск",
  "smart.freshness": "Свежесть",
  "smart.unknown": "Неизвестно",
  "smart.evidence": "Качество возможности",
  "smart.limited": "Ограниченная уверенность",
  "smart.estimated": "Оценка по доступным данным",
  "smart.time": "Время исполнения",
  "smart.timeHint":
    "Позиция в очереди и будущий поток сделок неизвестны. Объём за неделю не доказывает время исполнения.",
  "smart.stability":
    "Доля исторических снимков с положительной маржой после налога",
  "smart.deviation": "Отклонение spread, п.п.",
  "smart.fees": "Комиссия продажи на всю позицию",
  "smart.formula":
    "Net = (цена продажи − цена покупки) × количество − налог продажи. Для ордеров это сценарий размещения без гарантии заполнения; мгновенный сценарий использует глубину стакана.",
  "smart.tax":
    "Используется выбранная в настройках ставка. Изменения налога от событий и личных perks автоматически не подтверждаются.",
  "smart.rows": "На странице после проверки: {shown} из {total}",
  "smart.reason.invalid_quote": "Котировки или итоговая арифметика некорректны",
  "smart.reason.crossed_book": "Инвертированный стакан: возможность исключена",
  "smart.reason.stale": "Данные устарели или возраст неизвестен",
  "smart.reason.history_unknown":
    "Истории недостаточно для проверки устойчивости spread",
  "smart.reason.liquidity_unknown": "Ликвидность неизвестна",
  "smart.reason.large_position":
    "Крупная позиция относительно доступного стакана",
  "smart.reason.price_jump": "Резкий скачок цены или spread",
  "smart.reason.unstable_spread": "Историческая маржа нестабильна",
  "smart.reason.unfilled_orders": "Размещённые ордера могут не исполниться",
} as const;
export const smartEn: Record<keyof typeof smartRu, string> = {
  "smart.reason.position_unknown": "Position share of visible depth unknown",
  "smart.title": "Smart Flip Finder",
  "smart.heuristic":
    "The 0–100 rating is a heuristic, not a trade probability. Risk and rating remain unknown with insufficient data. Profit is potential; execution is not guaranteed.",
  "smart.pageScope":
    "Additional filters and sorting apply only to the loaded page. Main capital, ROI and liquidity filters apply server-side to the available snapshot.",
  "smart.maxRisk": "Maximum known risk",
  "smart.maxAge": "Quote freshness",
  "smart.all": "Unrestricted (including Unknown)",
  "smart.sort": "Additional page sorting",
  "smart.provider": "Server sorting",
  "smart.risk": "Risk",
  "smart.freshness": "Freshness",
  "smart.unknown": "Unknown",
  "smart.evidence": "Opportunity evidence",
  "smart.limited": "Limited confidence",
  "smart.estimated": "Estimate from available data",
  "smart.time": "Execution time",
  "smart.timeHint":
    "Queue position and future trading flow are unknown. Weekly volume does not establish a fill time.",
  "smart.stability":
    "Fraction of historical snapshots with a positive margin after tax",
  "smart.deviation": "Spread deviation, percentage points",
  "smart.fees": "Sale tax for the whole position",
  "smart.formula":
    "Net = (sell price − buy price) × quantity − sale tax. Order mode is a placement scenario without guaranteed fills; instant mode walks order-book depth.",
  "smart.tax":
    "Uses your settings tax rate. Event and personal perk tax changes are not automatically confirmed.",
  "smart.rows": "After validation on this page: {shown} of {total}",
  "smart.reason.invalid_quote":
    "Invalid quotes or inconsistent financial arithmetic",
  "smart.reason.crossed_book": "Crossed order book: opportunity excluded",
  "smart.reason.stale": "Data is stale or its age is unknown",
  "smart.reason.history_unknown":
    "Insufficient history to verify spread persistence",
  "smart.reason.liquidity_unknown": "Liquidity unknown",
  "smart.reason.large_position": "Large position relative to visible depth",
  "smart.reason.price_jump": "Price or spread jump",
  "smart.reason.unstable_spread": "Historical margin is unstable",
  "smart.reason.unfilled_orders": "Placed orders may not fill",
};
