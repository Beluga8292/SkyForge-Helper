export const auctionSmartRu = {
  "auctionSmart.cachedError":
    "Обновление не удалось. Показан предыдущий снимок; проверьте его возраст и свежесть перед использованием.",
  "auctionSmart.listingEstimate": "Оценка активных предложений",
  "auctionSmart.totalFees": "Все заданные сборы",
  "auctionSmart.reason.extreme_discount":
    "Экстремальный разрыв цен: возможна манипуляция предложениями, confidence снижена",
  "auctionSmart.gross": "Потенциальная валовая прибыль",
  "auctionSmart.risk": "Риск оценки, эвристика 0–100",
  "auctionSmart.age": "Возраст снимка",
  "auctionSmart.formula":
    "Net = медиана сопоставимых предложений − BIN − процентный сбор продажи − указанный сбор размещения. ROI = Net / BIN. Это сценарий перепродажи, не гарантия.",
  "auctionSmart.assumptions":
    "Сборы заданы пользователем; применимость к событиям, сроку размещения и повторным выставлениям не подтверждена. Ликвидность и время продажи неизвестны.",
  "auctionSmart.scopeGlobal":
    "Backend применяет дополнительные фильтры ко всему доступному снимку до пагинации.",
  "auctionSmart.scopePage":
    "Этот backend не подтверждает новые глобальные фильтры: дополнительные условия применены только к загруженной странице. Бюджет, confidence и rarity фильтруются сервером.",
  "auctionSmart.pageSort":
    "Сортировка прибыли/ROI/риска ниже относится только к загруженной странице.",
  "auctionSmart.mismatch":
    "Лот изменился или ответ не соответствует выбранному BIN.",
  "auctionSmart.reason.listing_only":
    "Оценка по активным предложениям, а не подтверждённым продажам",
  "auctionSmart.reason.fees_unknown":
    "Полные комиссии неизвестны: net и ROI не рассчитаны",
  "auctionSmart.reason.stale": "Снимок устарел или лот завершился",
  "auctionSmart.reason.partial":
    "Снимок или анализ неполный: уверенность снижена",
  "auctionSmart.reason.matching_unknown":
    "Точное NBT-сопоставление не подтверждено",
  "auctionSmart.reason.comparables_low":
    "Недостаточно независимых сопоставимых продавцов",
  "auctionSmart.reason.dispersion_unknown":
    "Контракт API не передаёт численный разброс цен; он учтён только в исходной confidence",
  "auctionSmart.reason.liquidity_unknown":
    "Подтверждённая история продаж и ликвидность неизвестны",
} as const;
export const auctionSmartEn: Record<keyof typeof auctionSmartRu, string> = {
  "auctionSmart.cachedError":
    "Refresh failed. Showing the previous snapshot; check its age and freshness before using it.",
  "auctionSmart.listingEstimate": "Active listing estimate",
  "auctionSmart.totalFees": "Total assumed fees",
  "auctionSmart.reason.extreme_discount":
    "Extreme price gap: possible listing manipulation, confidence downgraded",
  "auctionSmart.gross": "Potential gross profit",
  "auctionSmart.risk": "Valuation risk, 0–100 heuristic",
  "auctionSmart.age": "Snapshot age",
  "auctionSmart.formula":
    "Net = comparable listing median − BIN − sale percentage fee − specified listing fee. ROI = Net / BIN. This is a resale scenario, not a guarantee.",
  "auctionSmart.assumptions":
    "Fees are user assumptions; event, duration and relisting adjustments are unverified. Resale liquidity and execution time are unknown.",
  "auctionSmart.scopeGlobal":
    "Backend applies additional filters across the available snapshot before pagination.",
  "auctionSmart.scopePage":
    "This backend does not confirm new global filters: additional constraints apply only to the loaded page. Budget, confidence and rarity are filtered server-side.",
  "auctionSmart.pageSort":
    "Profit/ROI/risk sorting below applies only to the loaded page.",
  "auctionSmart.mismatch":
    "The listing changed or the response does not match the selected BIN.",
  "auctionSmart.reason.listing_only":
    "Based on active listings, not confirmed completed sales",
  "auctionSmart.reason.fees_unknown":
    "Complete fees unknown: net and ROI unavailable",
  "auctionSmart.reason.stale": "Snapshot is stale or listing ended",
  "auctionSmart.reason.partial":
    "Snapshot or analysis is partial: confidence downgraded",
  "auctionSmart.reason.matching_unknown": "Exact NBT matching unconfirmed",
  "auctionSmart.reason.comparables_low":
    "Insufficient independent comparable sellers",
  "auctionSmart.reason.dispersion_unknown":
    "API does not expose numeric dispersion; only source confidence incorporates it",
  "auctionSmart.reason.liquidity_unknown":
    "Confirmed sales history and liquidity unknown",
};
