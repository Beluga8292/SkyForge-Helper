/**
 * STAGE 7.4 — linked-account UX, Minecraft-style inventory/auction presentation,
 * missing-container reporting and Networth coverage labels.
 */

export const stage8Ru = {
  "account.link": "Привязать аккаунт",
  "account.switch": "Сменить аккаунт",
  "account.unlink": "Отвязать аккаунт",
  "account.unlinked": "Аккаунт не привязан",
  "account.current": "Текущий аккаунт",
  "account.profileLabel": "Профиль SkyBlock",
  "account.linkTitle": "Привязка Minecraft-аккаунта",
  "account.linkDesc":
    "Введите никнейм Minecraft. Мы загрузим доступные профили SkyBlock и запомним выбор на этом устройстве.",
  "account.nickname": "Никнейм Minecraft",
  "account.find": "Найти аккаунт",
  "account.searching": "Ищем аккаунт…",
  "account.chooseProfile": "Выберите профиль SkyBlock",
  "account.bind": "Привязать",
  "account.binding": "Привязываем…",
  "account.linked": "Аккаунт привязан",
  "account.switchTitle": "Сменить Minecraft-аккаунт?",
  "account.switchDesc":
    "Цели, история и сохранённые планы текущего аккаунта останутся на устройстве. Данные нового аккаунта будут храниться отдельно.",
  "account.switchConfirm": "Сменить",
  "account.unlinkTitle": "Отвязать аккаунт?",
  "account.unlinkDesc":
    "Привязка будет удалена с этого устройства. Цели, история Networth и планы улучшений останутся и вернутся, если привязать тот же аккаунт снова.",
  "account.unlinkConfirm": "Отвязать",
  "account.requiredTitle": "Аккаунт не привязан",
  "account.requiredDesc":
    "Чтобы просматривать свой профиль и аналитику, привяжите Minecraft-аккаунт.",
  "account.notFound": "Аккаунт не найден",
  "account.private": "Профиль скрыт",
  "account.noProfiles": "У аккаунта нет доступных профилей SkyBlock",
  "account.hint": "Привязка хранится только на этом устройстве.",
  "account.boundTo": "Привязан {name}",
  "account.switchAccountHint": "Один раз привяжите аккаунт — все личные разделы используют его автоматически.",

  "inventory.missingTitle": "Не удалось загрузить часть хранилища",
  "inventory.missingDesc": "Некоторые предметы не включены в расчёт стоимости.",
  "inventory.missingCount": "Доступно {available} из {total} контейнеров",
  "inventory.missingReasonDecode": "Ошибка декодирования данных",
  "inventory.missingReasonLimit": "Превышен лимит отображаемых бэкпаков",
  "inventory.missingReasonMissing": "Контейнер отсутствует в ответе Hypixel",
  "inventory.missingDetails": "Технические детали",
  "inventory.missingDevOnly":
    "Технические детали доступны в режиме разработчика.",
  "inventory.emptySlot": "Пустой слот",
  "inventory.slotCount": "{count} слотов",
  "inventory.partialNote":
    "Показаны не все контейнеры. Стоимость и количество предметов могут быть неполными.",

  "auction.viewMode": "Вид",
  "auction.viewTable": "Таблица",
  "auction.viewGrid": "Сетка",
  "auction.colItem": "Предмет",
  "auction.colType": "Тип",
  "auction.colPrice": "Цена",
  "auction.colEnds": "До конца",
  "auction.colSeller": "Продавец",
  "auction.colBids": "Ставки",
  "auction.openDetails": "Открыть детали",
  "auction.gridHint":
    "Сетка показывает лоты как слоты инвентаря. Наведите курсор для описания, нажмите для деталей.",

  "networth.estimatedAdditional": "Оценка доп. стоимости",
  "networth.estimatedAdditionalHint":
    "Точные цены Bazaar для предметов, которые Auction House не оценил.",
  "networth.unknownTradeable": "Без цены · торгуемые",
  "networth.unknownSoulbound": "Без цены · soulbound",
  "networth.coverageWithEstimates": "С локальной оценкой",
  "networth.pricingSources": "Источники цен",
  "networth.bazaarPriced": "Bazaar: {count}",
  "networth.auctionPriced": "Auction House: {count}",
  "networth.localTopUp": "Локальная оценка Bazaar: {count}",
  "networth.coverageNote":
    "Покрытие считается по оценённым записям. Неизвестная цена не превращается в ноль и не входит в известную стоимость.",
  "networth.partialNote":
    "Часть данных недоступна, поэтому стоимость может быть неполной.",
  "networth.unknownAssets": "Неоценённые активы",
  "networth.warnUnpriced": "Некоторые предметы не удалось оценить",
  "networth.warnInvalid":
    "Некоторые предметы не удалось обработать: {count}",
  "networth.warnPartialInventory":
    "Часть инвентаря не включена в расчёт",

  "tooltip.estimated": "Оценка",
  "tooltip.confirmed": "Подтверждённая цена",
} as const;

export const stage8En: Record<keyof typeof stage8Ru, string> = {
  "account.link": "Link account",
  "account.switch": "Switch account",
  "account.unlink": "Unlink account",
  "account.unlinked": "No account linked",
  "account.current": "Current account",
  "account.profileLabel": "SkyBlock profile",
  "account.linkTitle": "Link a Minecraft account",
  "account.linkDesc":
    "Enter a Minecraft username. We will load the available SkyBlock profiles and remember your choice on this device.",
  "account.nickname": "Minecraft username",
  "account.find": "Find account",
  "account.searching": "Looking up…",
  "account.chooseProfile": "Choose a SkyBlock profile",
  "account.bind": "Link",
  "account.binding": "Linking…",
  "account.linked": "Account linked",
  "account.switchTitle": "Switch Minecraft account?",
  "account.switchDesc":
    "Goals, history and saved plans for the current account stay on this device. Data for the new account is stored separately.",
  "account.switchConfirm": "Switch",
  "account.unlinkTitle": "Unlink account?",
  "account.unlinkDesc":
    "The link is removed from this device. Goals, Networth history and upgrade plans remain and return if you link the same account again.",
  "account.unlinkConfirm": "Unlink",
  "account.requiredTitle": "No account linked",
  "account.requiredDesc":
    "To view your profile and analytics, link a Minecraft account.",
  "account.notFound": "Account not found",
  "account.private": "Profile is private",
  "account.noProfiles": "This account has no available SkyBlock profiles",
  "account.hint": "The link is stored only on this device.",
  "account.boundTo": "Linked {name}",
  "account.switchAccountHint":
    "Link your account once — every personal section uses it automatically.",

  "inventory.missingTitle": "Part of the storage could not be loaded",
  "inventory.missingDesc": "Some items are not included in the value estimate.",
  "inventory.missingCount": "{available} of {total} containers available",
  "inventory.missingReasonDecode": "Data decoding error",
  "inventory.missingReasonLimit": "Backpack display limit reached",
  "inventory.missingReasonMissing": "Container is missing from the Hypixel response",
  "inventory.missingDetails": "Technical details",
  "inventory.missingDevOnly": "Technical details are available in developer mode.",
  "inventory.emptySlot": "Empty slot",
  "inventory.slotCount": "{count} slots",
  "inventory.partialNote":
    "Not all containers are shown. Item value and counts may be incomplete.",

  "auction.viewMode": "View",
  "auction.viewTable": "Table",
  "auction.viewGrid": "Grid",
  "auction.colItem": "Item",
  "auction.colType": "Type",
  "auction.colPrice": "Price",
  "auction.colEnds": "Ends in",
  "auction.colSeller": "Seller",
  "auction.colBids": "Bids",
  "auction.openDetails": "Open details",
  "auction.gridHint":
    "The grid shows lots as inventory slots. Hover for a tooltip, click for details.",

  "networth.estimatedAdditional": "Estimated additional value",
  "networth.estimatedAdditionalHint":
    "Exact Bazaar prices for items the Auction House could not value.",
  "networth.unknownTradeable": "Unpriced · tradable",
  "networth.unknownSoulbound": "Unpriced · soulbound",
  "networth.coverageWithEstimates": "With local estimate",
  "networth.pricingSources": "Pricing sources",
  "networth.bazaarPriced": "Bazaar: {count}",
  "networth.auctionPriced": "Auction House: {count}",
  "networth.localTopUp": "Local Bazaar estimate: {count}",
  "networth.coverageNote":
    "Coverage counts priced entries only. Unknown prices never become zero and never enter the known total.",
  "networth.partialNote":
    "Part of the data is unavailable, so the value may be incomplete.",
  "networth.unknownAssets": "Unknown assets",
  "networth.warnUnpriced": "Some items could not be valued",
  "networth.warnInvalid": "Some items could not be processed: {count}",
  "networth.warnPartialInventory":
    "Part of the inventory is not included in the calculation",

  "tooltip.estimated": "Estimate",
  "tooltip.confirmed": "Confirmed price",
};
