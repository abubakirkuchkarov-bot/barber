# Контекст для следующего агента

Учебный проект барбершопа. Спеки: `prd-final.md`, `spec-final.md`, чеклист: `tasks-final.md`.

Сделаны этапы 1–6, кроме живой проверки Mini App внутри клиента Telegram. Миграции применены в Supabase, seed выполнен. Запись создаётся через API и защищена от пересечения.

## Что уже сделано

Лендинг и запись читают услуги и барберов из API. Слоты, создание, отмена и перенос тоже идут через API. Контакты и отзывы остаются моками.

- Корень: npm workspaces, `workspaces: ["apps/*"]`.
- `apps/web`: Next.js 16.3.8, React 19, TypeScript, App Router, `src/`.
- Скрипты из корня: `npm run dev` (web, api и miniapp), `npm run dev:web`, `npm run dev:api`, `npm run dev:miniapp`, `npm run build`, `npm run lint`.
- В `tasks-final.md` пункты этапов 1–10 отмечены `[x]`, кроме «Проверить внутри Telegram» и «Создать бота через BotFather».

После первой сборки лендинг переделан по брифу: Editorial Luxury × Modern Barber Culture, Ташкент, не шаблонный барбершоп.

Страница `/` по порядку:

1. Nav — Услуги, Мастера, О нас, Контакты, CTA «Записаться». На мобиле полноэкранное меню.
2. Hero — «Стиль — это детали.» Фото справа, при скролле на desktop раскрывается на весь экран.
3. Философия `#o-nas` — фраза светлеет по словам при скролле.
4. Услуги `#uslugi` — нумерованный список, цена, превью фото при hover (desktop).
5. Мастера `#mastera`.
6. Атмосфера — горизонтальная галерея. Desktop: GSAP pin. Телефон: нативный snap-scroll.
7. Ташкент — «Создано в Ташкенте.»
8. Отзывы — крупные цитаты, без карточек.
9. Финал `#zapis` — «Твой новый образ начинается здесь.» Кнопка звонит на `tel:+998712001930`.
10. Footer `#kontakty` — адрес, телефон, Instagram, Telegram, часы, ссылка «Карта», «Crafted in Tashkent.»

## Ключевые решения

- Бренд: **Кромка**. Ташкент, улица Амира Темура, 108. Телефон `+998 71 200 19 30`. Часы ежедневно 10:00–21:00. Часовой пояс продукта по спеке: `Asia/Tashkent`. Язык интерфейса: русский. Короткие английские метки допустимы (`Tashkent`, `Crafted in Tashkent`).
- Палитра одна, тёмная. Светлой темы нет: редизайн явно задал `#0B0B0A` / `#F2F0EA` / muted bronze `#9A7B4F`. Не возвращать barber pole, gold gradient, карточки 3×3.
- Шрифты: Literata (заголовки, отдельно italic) + Golos Text (текст). Кириллица обязательна.
- В `next/font` нельзя передавать массив `weight` для этих шрифтов в Turbopack dev: ошибка `next/font/google queries have exactly one entry`. Один weight на вызов или variable font без массива. Production `next build` при старом варианте собирался, dev — нет.
- Анимация: GSAP 3.15 + ScrollTrigger + Lenis 1.3. Регистрация только в `apps/web/src/lib/gsap.ts`. Lenis крутится от `gsap.ticker`, `autoRaf: false`, `syncTouch: false`. `useLenis()` не класть в dependencies `useGSAP`.
- Один signature-момент: pin hero на `min-width: 1024px`. На телефоне pin нет. `prefers-reduced-motion` отключает pin, scrub и параллакс. `html { scroll-behavior: auto }` — иначе ломается Lenis.
- `pinType: "transform"`. Не ставить `overflow: hidden` на `body`: ломает pin.
- Карта этапа 1 — ссылка на OpenStreetMap в футере, не iframe. Светлый iframe ломал тёмный экран.
- CTA «Записаться» в шапке, hero, списке услуг и финале ведёт на `/book`. Строка услуги открывает `/book?service=<id>` с уже выбранной услугой. Телефон в футере остаётся ссылкой `tel:`. На `/book` кнопка «Записаться» в шапке скрыта. Ссылки разделов с `/book` ведут на `/#...`.
- Контакты, отзывы и кадры галереи: `apps/web/src/data/content.ts`. Списки услуг и барберов оттуда убраны. Фото услуг не колонка базы: карта `serviceImages` по id. Не выдумывать новых мастеров без запроса.
- Фото: `apps/web/public/images/`. Hero — реальный кадр стрижки. Город — вечерний проспект с платанами, не Регистан и не чужой скайлайн. Галерея использует сырой `<img>` из‑за parallax шире кадра (`eslint-disable` точечно). Остальные картинки — `next/image`.
- Вложенный git в `apps/web` удалён. Репозиторий в корне на момент работы не был обязателен.

## Как запускать

```bash
npm run dev
```

Сайт: `http://localhost:3000`. API: `http://localhost:3001`. Mini App: `http://localhost:5173`. `npm run dev` поднимает все три. Если порт занят, процесс можно поднять отдельно: `npm run dev:web`, `dev:api`, `dev:miniapp`.

`npm run lint` проходит. `npm run build` проходил после редизайна. `tsc -p apps/api --noEmit` проходит.

## Куда смотреть в коде

| Что | Где |
|---|---|
| Контакты, отзывы, фото услуг | `apps/web/src/data/content.ts` |
| Загрузка каталога | `apps/web/src/lib/catalog.ts` |
| API | `apps/api/src` |
| Сборка страницы | `apps/web/src/app/page.tsx` |
| Стили и токены | `apps/web/src/app/globals.css` |
| Шрифты | `apps/web/src/app/layout.tsx` |
| Hero pin | `apps/web/src/components/hero.tsx` |
| Скролл | `apps/web/src/components/scroll/smooth-scroll.tsx` |
| GSAP | `apps/web/src/lib/gsap.ts` |
| Запись `/book` | `apps/web/src/components/book/booking-flow.tsx` |
| Управление `/booking/[token]` | `apps/web/src/components/book/manage-booking.tsx` |
| Даты и телефон | `apps/web/src/data/slots.ts` |
| Prisma-схема | `prisma/schema.prisma` |
| Миграция | `prisma/migrations/20261005152000_init/migration.sql` |
| Seed | `prisma/seed.ts` |

## Этап 2

Страница `/book`: услуга, мастер (включая «Любой свободный»), дата в пределах горизонта, время из API, имя и телефон, экран «Вы записаны.» Summary справа на desktop и закреплён снизу на телефоне. С этапа 5 запись сохраняется в базе. Ссылка «Изменить или отменить» ведёт на `/booking/[token]`.

## Этап 3

Prisma 6 в корне. Схема повторяет `spec-final.md`: `barbers`, `portfolio_items`, `services`, `barber_services`, `working_hours`, `breaks`, `time_off`, `clients`, `bookings`, `booking_services`, `reviews`, `settings`, `admin_users`. Имена колонок в базе в snake_case. `weekday`: 0 воскресенье … 6 суббота. Идентификаторы услуг и барберов совпадают с моками сайта (`haircut`, `aziz`). Ограничение `bookings_no_overlap` не добавлялось: это этап 5.

Seed: 6 услуг, 6 барберов, все услуги у каждого мастера, график ежедневно 10:00–21:00, обед 13:00–14:00, настройки из спеки. Клиентов, записей и администратора seed не создаёт.

Миграция применена через `DIRECT_URL` (session pooler, порт 5432). Seed: 6 услуг, 6 барберов, 42 рабочих интервала, 42 обеда, 9 настроек. В пароле внутри URL закодированы `+` как `%2B` и `%` как `%25`, иначе строка подключения ломается. Не коммитить `.env`.

## Этап 4

`apps/api`: Fastify 5, TypeScript, Zod, Prisma. Порт `PORT` (по умолчанию 3001), хост `0.0.0.0`. `.env` читается из корня репозитория: рабочая папка workspace — `apps/api`. Prisma-клиент создаётся после загрузки env.

Маршруты:

- `GET /health` → `{ ok: true }`, без пинга базы.
- `GET /api/v1/services` — активные услуги, `sortOrder`.
- `GET /api/v1/barbers` — активные барберы: `id`, `name`, `bio`, `experienceYears`, `photoUrl`.
- `GET /api/v1/barbers/:id` — то же плюс включённые услуги. Длительность и цена: значение связи, иначе значение услуги. `telegramChatId` наружу не отдаётся.

Ошибки: `{ code, message }`. `VALIDATION` 400, `NOT_FOUND` 404 («Маршрут не найден» / «Мастер не найден»), `INTERNAL` 500. CORS: `CORS_ORIGIN`, по умолчанию `http://localhost:3000`.

Сайт: `apps/web/src/lib/catalog.ts`, `NEXT_PUBLIC_API_URL` (по умолчанию `http://localhost:3001`). Списки на `/` и `/book` приходят с сервера (`cache: "no-store"`). Если API недоступен, на странице текст «Не удалось загрузить услуги и мастеров.» Отзывы и контакты остаются моками.

## Этап 5

Слоты считает `apps/api/src/slots.ts` и `schedule.ts`. Учитываются длительность услуг (с переопределением мастера), рабочие часы, обед, `time_off` мастера и всего зала, подтверждённые записи, `min_notice_min`, `booking_horizon_days`, шаг `slot_step_min`. Часовой пояс из настройки, по умолчанию `Asia/Tashkent`. Окна полуоткрытые: обед 13:00–14:00 не попадает в слоты.

`GET /api/v1/availability?serviceIds=&barberId=&date=` отдаёт `HH:MM`. `GET /api/v1/availability/days` отдаёт горизонт с флагом `open`. `barberId=any` объединяет окна и при записи берёт первого свободного мастера по `sortOrder`.

`POST /api/v1/bookings` создаёт клиента, снимок услуг и запись `source=web`. Конфликт ограничения — `409 SLOT_TAKEN`. Ещё `422`: `OUTSIDE_WORKING_HOURS`, `TOO_SOON`, `TOO_FAR`, `TOO_LATE`, `NOT_CANCELLABLE`, `SERVICE_DISABLED`.

Миграция `20261005183000_bookings_no_overlap`: `btree_gist`, generated `time_range`, exclusion по `barber_id` для `status=confirmed`. Колонка в Prisma помечена `Unsupported` и из клиента не пишется.

Управление: `GET/POST /api/v1/bookings/:token`, `.../cancel`, `.../reschedule`. Страница `/booking/[token]`. Отмена и перенос не позже чем за `cancel_cutoff_min`.

Тесты: `npm test` (слоты), `npm run test:race` (две параллельные записи и `23P01`).

## Этап 6

`apps/miniapp`: React, Vite, TypeScript, официальный скрипт `telegram-web-app.js`. Порт 5173. Цвета Кромки, если Telegram не прислал `themeParams`; иначе фон, текст и акцент берутся из темы. `ready()` и `expand()` вызываются при старте.

API проверяет `initData` заголовком `Authorization: tma <initData>`. HMAC-SHA256 с ключом `WebAppData` и токеном бота, срок жизни 24 часа. `GET /api/v1/me` и `GET /api/v1/me/bookings` требуют сессию. `POST /api/v1/bookings` с сессией пишет `source=telegram` и находит или создаёт клиента по `telegram_id`. Без заголовка запись с сайта остаётся гостевой, `source=web`.

Локально без клиента Telegram: `TELEGRAM_DEV=1` и не production открывает `GET /api/v1/telegram/dev-session`. Mini App в `vite dev` берёт эту сессию, если `initData` пустой. В production флаг должен быть выключен, а `TELEGRAM_BOT_TOKEN` — токен BotFather. Не коммитить `.env`.

Сценарий: услуга, мастер или «Любой свободный», дата, время, имя и телефон, подтверждение. «Мои» показывает записи этого Telegram-пользователя, отмену и перенос. Занятый слот возвращает на выбор времени с текстом ошибки.

Проверка подписи: `npm test` включает `telegram.test.ts`. Живой клиент Telegram ещё не открывался: нет бота и публичного URL Mini App.

## Этап 7

Бот на grammY живёт в `apps/api`, отдельный процесс не поднимается. `POST /telegram/webhook` принимает update и всегда отвечает `200`, чтобы Telegram не повторял доставку. Если задан `TELEGRAM_WEBHOOK_SECRET`, нужен заголовок `X-Telegram-Bot-Api-Secret-Token`. Без `TELEGRAM_BOT_TOKEN` маршрут отвечает `503`. Long polling включается только при `TELEGRAM_POLLING=1` и не стартует сам: выдуманный токен не должен крутить `getMe`.

`/start` показывает меню: «Записаться», «Мои записи», «Контакты». Кнопка Mini App появляется, только если `TELEGRAM_MINIAPP_URL` начинается с `https://`. Иначе «Записаться» присылает ссылку на сайт.

Deep link `https://t.me/<TELEGRAM_BOT_USERNAME>?start=b_<manageToken>` привязывает Telegram-пользователя к клиенту записи и присылает подтверждение. Если этот `telegram_id` уже есть у другого клиента, запись переносится на него. `start=barber_<code>` гасит одноразовый код из `barber_link_codes` и пишет `barbers.telegram_chat_id`. Код живёт 24 часа. Выпуск: `POST /api/v1/telegram/barber-links` при `TELEGRAM_DEV=1`. Админка появится на этапе 9.

После создания записи API шлёт сообщение клиенту, если известен chat id, и мастеру, если мастер привязан. Отмена и перенос уведомляют клиента. Ошибка Telegram не ломает запись. В чате Mini App chat id совпадает с user id, поэтому клиент из Telegram получает `telegram_chat_id` сразу. Гостевая запись с сайта получает ссылку «Получить подтверждение в Telegram», когда задан `TELEGRAM_BOT_USERNAME`. Кнопка «Перенести» в сообщении ведёт на сайт и ставится только при `WEB_ORIGIN` с `https://`. «Отменить» вызывает ту же отмену, что и страница записи.

Живая отправка заработает после бота в BotFather: настоящий токен, username и выключенный `TELEGRAM_DEV` в production.

## Этап 8

Напоминания считает Edge Function `supabase/functions/notifications`. Cron каждые 5 минут вызывает `public.run_notification_tick()`. Пока в Vault нет `notifications_url` и `cron_secret`, тик пустой. Функция принимает только `Authorization: Bearer <CRON_SECRET>`, ходит в Postgres по секрету `DATABASE_URL` и шлёт сообщения Bot API. `verify_jwt` у функции выключен: секрет свой, не ключ anon.

Окно за день: запись `confirmed`, до визита больше `reminder_short_minutes` и не больше `reminder_day_minutes` (в сиде 30 и 1440). Короткое окно: визит ещё не начался и до него не больше 30 минут. После успешной отправки пишется `reminder_day_sent_at` или `reminder_30m_sent_at`. Если Telegram не ответил, метка снимается и следующий тик повторяет попытку. Повторный успешный тик то же сообщение не шлёт. Без `telegram_chat_id` напоминание не ставится.

Прошедшая `confirmed` запись становится `completed`, в `auto_completed_at` пишется время. Отменённые не завершаются. Через `review_delay_min` после конца визита (в сиде 60) бот один раз просит оценку. Ответ `1`–`5` сохраняет отзыв; при оценке от `review_public_min_rating` он помечается публичным. Поля уже были в первой миграции.

Локально тот же проход: `POST /internal/notifications` с тем же секретом. Проверка: `npm test` и `npm run test:notifications`. Живой тик в Telegram начнётся после деплоя функции и двух секретов в Vault.

## Этап 9

Стойка владельца: `/admin/login`. Пароль в `ADMIN_PASSWORD`, в базе только Argon2. Сессия — httpOnly cookie `kromka_admin`, подпись `SESSION_SECRET`, 14 дней. Восемь неудачных входов с одного адреса закрывают логин на 15 минут. Запросы админки требуют эту cookie. Стойка не крутит плавный скролл лендинга.

Разделы: день с записями, ручная запись, перенос, отмена и смена статуса; услуги; мастера, недельный график, обед, выходной, портфолио и одноразовая ссылка Telegram; отзывы с переключателем публичности; настройки и закрытие салона. Фото уходит в бакет `barber-media`. Запись со стойки может быть ближе 30 минут и дальше горизонта, но не поверх чужого слота и не вне графика. Если у услуги или мастера уже есть записи, удаление прячет их, а не стирает историю.

Первый администратор создаётся командой `npm run db:admin`, когда в `.env` заданы логин и пароль.

## Этап 10

Сводка на `/admin/analytics`. Период задаётся датами в Ташкенте, по умолчанию последние 30 дней. Считается на сервере:

- выручка и число завершённых визитов — только `completed`;
- все записи периода, отмены и неявки — доли от этого числа;
- услуги — по визитам, которые заняли кресло (`confirmed`, `completed`, `no_show`); деньги услуги — только из завершённых;
- загрузка мастера — минуты этих визитов к минутам смены без обеда и выходных;
- возвращаемость — клиенты с двумя и более завершёнными визитами внутри периода;
- тепловая карта — день недели и час начала в Ташкенте, отмены в неё не входят.

Маршруты: `GET /api/v1/admin/analytics/revenue|services|load|heatmap|cancellations|retention`. Проверка на пяти визитах 3 июня 2027: выручка 360 000, загрузка Азиза 120 из 600 минут. `npm test` и `npm run test:analytics`.

## Выжимка: что делать дальше

Следующий шаг — **этап 11** из `tasks-final.md`: деплой. Пункты «Проверить внутри Telegram» и «Создать бота через BotFather» закрываются, когда есть бот и публичный URL. Cron начнёт слать сообщения, когда функция задеплоена и в Vault лежат `notifications_url` и `cron_secret`.
