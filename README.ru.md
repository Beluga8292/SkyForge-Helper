<p align="center"><a href="README.md">English</a> · <a href="README.ru.md"><b>Русский</b></a></p>

<p align="center">
  <img src="docs/assets/brand-banner.png" alt="SkyForge Helper — твой идеальный компаньон для Hypixel SkyBlock" width="100%">
</p>

<h1 align="center">SkyForge Helper</h1>
<p align="center"><b>Твой идеальный компаньон для Hypixel SkyBlock</b></p>
<p align="center">
  Профили, Networth, Bazaar и Auction House, планирование экипировки и инвентарь — в одном аккуратном desktop-приложении.
</p>

<p align="center">
  <a href="https://github.com/Beluga8292/SkyForge-Helper/releases/download/v0.5.0-rc.5-installers/SkyForge-Helper-Setup-x64.exe"><img src="https://img.shields.io/badge/Скачать-Windows%20x64-8b5cf6?style=for-the-badge&logo=windows&logoColor=white" alt="Скачать SkyForge Helper для Windows"></a>
  &nbsp;
  <a href="https://github.com/Beluga8292/SkyForge-Helper/releases/download/v0.5.0-rc.5-installers/SkyForge-Helper-macOS-arm64.dmg"><img src="https://img.shields.io/badge/Скачать-macOS%20Apple%20silicon-22d3ee?style=for-the-badge&logo=apple&logoColor=white" alt="Скачать SkyForge Helper для macOS"></a>
  &nbsp;
  <a href="https://discord.gg/bX3md4uepp"><img src="https://img.shields.io/badge/Discord-Сообщество-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Discord SkyForge Helper"></a>
</p>

<p align="center">
  <a href="https://github.com/Beluga8292/SkyForge-Helper/actions/workflows/ci.yml"><img src="https://github.com/Beluga8292/SkyForge-Helper/actions/workflows/ci.yml/badge.svg?branch=main" alt="Статус CI"></a>
  <a href="https://github.com/Beluga8292/SkyForge-Helper/actions/workflows/installers.yml"><img src="https://github.com/Beluga8292/SkyForge-Helper/actions/workflows/installers.yml/badge.svg?branch=main" alt="Статус сборки установщиков"></a>
  <img src="https://img.shields.io/badge/license-MIT-22d3ee?style=flat-square" alt="Лицензия MIT">
  <img src="https://img.shields.io/badge/version-0.5.0--rc.5-f2b84b?style=flat-square" alt="Версия 0.5.0-rc.5">
  <img src="https://img.shields.io/badge/platform-Windows%20x64%20%7C%20macOS%20ARM64-8b5cf6?style=flat-square" alt="Windows x64 и macOS ARM64">
</p>

> **Загрузка:** кнопки выше скачивают проверенный установщик Windows NSIS и DMG для Apple silicon. Контрольные суммы SHA-256 и описание релиза — на [странице Releases](https://github.com/Beluga8292/SkyForge-Helper/releases/tag/v0.5.0-rc.5-installers). Сборка и проверка установщиков выполняются в [installer workflow](https://github.com/Beluga8292/SkyForge-Helper/actions/workflows/installers.yml).

---

## Создан для игроков SkyBlock

SkyForge Helper собирает информацию, которую вы проверяете каждую сессию, в одном быстром desktop-пространстве. Без загрузчиков модов, без изменения файлов игры и без долгой настройки: установите, откройте и привяжите профиль, когда понадобятся личные данные.

<img src="docs/assets/screenshots/dashboard.jpg" alt="Dashboard SkyForge Helper" width="100%">

### Аналитика игрока
Профили, навыки, Catacombs, Slayers, питомцы, коллекции и прогресс в читаемом обзоре. Недостающие поля API показываются как неизвестные, а не заменяются нулём.

<img src="docs/assets/screenshots/profile.jpg" alt="Профиль игрока в SkyForge Helper" width="100%">

### Честный Networth
Известная стоимость, предполагаемая дополнительная, неоценённые предметы и покрытие в одном разборе. Ошибка одного предмета не ломает весь расчёт, а неизвестная цена никогда не выдаётся за реальную. Банк кооператива не входит в личный Networth.

<img src="docs/assets/screenshots/networth.jpg" alt="Разбор Networth в SkyForge Helper" width="100%">

### Аналитика Bazaar
Живые цены, спреды, объёмы и оценки после налога — с явным предупреждением, что спред не гарантирует прибыль.

<img src="docs/assets/screenshots/bazaar.jpg" alt="Аналитика Bazaar в SkyForge Helper" width="100%">

### Auction House
BIN-лоты, фильтры, NBT-совместимое сопоставление, оценки и текстуры предметов в таблице и сетке.

<img src="docs/assets/screenshots/auction.jpg" alt="Auction House в SkyForge Helper" width="100%">

### Советник по экипировке
Сравнение улучшений для имеющейся экипировки: известные материалы, эссенция, рефорджи и зачарования. Неполные данные остаются явно помеченными; приложение не обещает DPS или гарантированный проход данжа.

<img src="docs/assets/screenshots/equipment.jpg" alt="Советник по экипировке SkyForge Helper" width="100%">

### Инвентарь и стоимость предметов
Слоты в стиле Minecraft, текстуры предметов, подсказки и необязательный оверлей стоимости стопки. Неполные контейнеры честно помечаются как неполные.

<img src="docs/assets/screenshots/inventory.jpg" alt="Инвентарь SkyForge Helper со стоимостью предметов" width="100%">

### Планировщик данжей
Шаблоны классов и этажей, проверка требований, сохранение имеющейся экипировки и общий бюджет сборки с явными частичными результатами.

<img src="docs/assets/screenshots/dungeons.jpg" alt="Планировщик данжей SkyForge Helper" width="100%">

### Goals, Watchlist и калькуляторы
Сохраняйте цели, следите за рыночными предметами и используйте встроенные калькуляторы для чисел, которые проверяете чаще всего. Личные данные остаются на вашем компьютере, рыночные приходят с размещённого backend.

---

## Всё в одном приложении

| | |
| --- | --- |
| **Профили** | Навыки, Catacombs, Slayers, питомцы, коллекции и прогресс |
| **Активы** | Инвентарь, хранилища и честный частичный Networth |
| **Рынки** | Цены Bazaar, спреды, Auction House и умный поиск флипов |
| **Экипировка** | Сравнение улучшений, материалы, эссенция, рефорджи и зачарования |
| **Планирование** | Сборки для данжей, цели, Watchlist и калькуляторы |
| **Удобство** | Текстуры предметов, интерфейс RU/EN и подписанные автообновления |

---

## Установка

### Windows 10/11 (x64)

1. Скачайте `SkyForge-Helper-Setup-x64.exe` со [страницы Releases](https://github.com/Beluga8292/SkyForge-Helper/releases/tag/v0.5.0-rc.5-installers).
2. Запустите установщик. Он ставится для текущего пользователя и не требует прав администратора.
3. Откройте приложение из меню «Пуск».

Если WebView2 отсутствует, он установится автоматически. Для этого нужен интернет.

### macOS 12+ (Apple silicon)

1. Скачайте `SkyForge-Helper-macOS-arm64.dmg` со [страницы Releases](https://github.com/Beluga8292/SkyForge-Helper/releases/tag/v0.5.0-rc.5-installers).
2. Откройте DMG.
3. Перетащите **SkyForge Helper** в **Applications**.
4. Запустите приложение из Applications.

Не нужны терминал, Python, Node.js, Rust, Docker, PostgreSQL, Redis, backend URL или Hypixel API key.

### Примечание о совместимости

Установленное приложение пока сохраняет прежнее внутреннее имя **SkyBlock Companion** для bundle, папки данных и идентичности обновлений. Это защищает настройки, привязку аккаунта, Goals, Watchlist и путь обновлений. Окно, интерфейс и документация используют бренд **SkyForge Helper**.

---

## FAQ

<details>
<summary><b>Что такое SkyForge Helper?</b></summary>
Отдельное desktop-приложение для Hypixel SkyBlock. Оно получает публичные данные и данные профиля через размещённый backend и показывает профили, Networth, рынки, аукционы, экипировку и инструменты планирования.
</details>

<details>
<summary><b>Приложение бесплатное?</b></summary>
Да. SkyForge Helper бесплатен, исходный код доступен по лицензии MIT. Платных тарифов и подписок нет.
</details>

<details>
<summary><b>Это безопасно?</b></summary>
Код открыт, приложение не внедряется в Minecraft и не требует вашего Hypixel API key для обычной работы. Открытый код сам по себе не гарантирует безопасность: проверяйте исходники и используйте официальные файлы. Ключ размещённого backend хранится на сервере.
</details>

<details>
<summary><b>Это мод для Minecraft?</b></summary>
Нет. Это отдельное desktop-приложение. Оно не меняет Minecraft, не устанавливает загрузчики модов и не трогает файлы игры.
</details>

<details>
<summary><b>Нужен ли Hypixel API key?</b></summary>
Для обычной работы — нет. Продвинутые пользователи могут включить прямой режим/BYOK, где ключ хранится в системном хранилище учётных данных. Никогда не публикуйте ключ в issue, на скриншоте или в Discord.
</details>

<details>
<summary><b>Нужен ли установленный Minecraft?</b></summary>
Нет. Для запуска приложения Minecraft не нужен. Для личных функций нужен аккаунт/профиль Hypixel SkyBlock; рыночные страницы работают и без привязки аккаунта.
</details>

<details>
<summary><b>Поддерживается ли Windows?</b></summary>
Да. Windows 10/11 x64 поддерживается, установщик NSIS ставится для текущего пользователя.
</details>

<details>
<summary><b>Поддерживается ли macOS?</b></summary>
Да. Поддерживается macOS 12 или новее на Apple silicon (ARM64). Intel Mac и Linux не являются релизными целями.
</details>

<details>
<summary><b>Как работают обновления?</b></summary>
Приложение проверяет подписанный манифест Tauri по HTTPS, сверяет артефакт со встроенным публичным ключом и предлагает обновление прямо в приложении. Тихая установка из непроверенного источника не выполняется.
</details>

<details>
<summary><b>Сохраняются ли мои настройки?</b></summary>
Да. Настройки, привязка аккаунта, Goals и Watchlist хранятся локально в SQLite и переживают обновление. При обычном удалении пользовательские данные остаются; удаляйте папку данных вручную только если действительно хотите сбросить всё.
</details>

<details>
<summary><b>Как сообщить об ошибке?</b></summary>
Создайте GitHub issue: версия приложения, операционная система, шаги воспроизведения и безопасный скриншот. Удалите API-ключи, токены, полные UUID и приватные данные профиля. Используйте шаблон bug report.
</details>

<details>
<summary><b>Где получить помощь?</b></summary>
Заходите в [Discord-сообщество](https://discord.gg/bX3md4uepp) или создайте GitHub issue. Не публикуйте секреты и приватные данные аккаунта.
</details>

---

## Решение проблем

- **Предупреждение Windows SmartScreen:** текущие установщики не подписаны сертификатом Authenticode. Запускайте только файлы из официальных Releases этого репозитория. Не отключайте SmartScreen глобально.
- **Предупреждение macOS Gatekeeper:** тестовые сборки подписаны ad-hoc и не notarized. Правый клик → «Открыть» помогает локально, но не отключайте Gatekeeper глобально.
- **Нет данных профиля:** привяжите аккаунт Minecraft, проверьте статус соединения и помните, что устаревшие или неполные данные показываются честно, а не подменяются выдуманными значениями.
- **Backend недоступен:** рыночные страницы могут показать последний кэш с предупреждением. Повторите позже; приложение не скрывает устаревшие данные.
- **Не та платформа:** сборки Windows — x64, macOS — только Apple silicon. Релизов для Linux и Intel Mac нет.

---

## Сообщество и поддержка

- **Discord:** [discord.gg/bX3md4uepp](https://discord.gg/bX3md4uepp)
- **Issues:** [github.com/Beluga8292/SkyForge-Helper/issues](https://github.com/Beluga8292/SkyForge-Helper/issues)
- **Безопасность:** [SECURITY.md](SECURITY.md)
- **Участие в разработке:** [CONTRIBUTING.md](CONTRIBUTING.md)

Скриншоты сделаны в изолированном demo-профиле приложения (вымышленный игрок и рыночные данные), кроме Auction House — там показаны публичные лоты без привязанного аккаунта. Приватные UUID, балансы и API-ключи не отображаются.

---

## Разработка

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run tauri:dev
```

Системные требования и дополнительный backend — в [docs/BUILDING.md](docs/BUILDING.md). Никогда не помещайте Hypixel API key в `VITE_*`, Git или клиентский бинарник.

---

## Лицензия и авторство

Copyright © **2026 Beluga_8292**. Лицензия [MIT](LICENSE). Вы можете изучать, форкать, изменять и распространять код по MIT; сохраняйте уведомления об авторстве и лицензии.

FurfSky Reborn распространяется как **All Rights Reserved** и не входит в поставку. Пользователь может импортировать пакет, который получил законно. Minecraft, Hypixel и связанные названия принадлежат их владельцам. См. [BRANDING.md](BRANDING.md) и [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

**SkyForge Helper — неофициальный фанатский проект, не связанный с Hypixel Inc., Mojang Studios или Microsoft и не одобренный ими.**
