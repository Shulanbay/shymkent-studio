# SHYMKENT STUDIO — сайт и CRM подкаст-студии в Шымкенте

Публичный сайт (RU / KK) с онлайн-записью и бесплатным туром, и CRM для команды студии: заявки, лиды, клиенты, календарь комнат, платежи, production-задачи, уведомления, настройки и аналитика.

| Документ | Для кого |
|---|---|
| [docs/OWNER_HANDOFF.md](docs/OWNER_HANDOFF.md) | Владелец: как работать с CRM простыми словами |
| [docs/OPERATIONS.md](docs/OPERATIONS.md) | Ежедневная работа команды, регламенты |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Выкладка в production (Vercel или Docker), откат, мониторинг |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md) | Почта (SMTP), Google Calendar, Google Sheets, cron |
| [docs/BACKUP_RESTORE.md](docs/BACKUP_RESTORE.md) | Резервные копии и восстановление |
| [docs/SECURITY.md](docs/SECURITY.md) | Меры безопасности, роли, секреты |
| [docs/FINAL_AUDIT.md](docs/FINAL_AUDIT.md) | Итоговый аудит: что проверено, ограничения, внешние шаги |

## Стек

Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 3 · PostgreSQL 16 + Prisma 6 · Argon2id · Zod · nodemailer · googleapis · Vitest · Playwright.

## Возможности

- **Сайт:** главная, комнаты, цены, контакты, бесплатный тур, онлайн-бронирование, политика и условия. Русский и казахский язык, адаптивная вёрстка от 320 px, доступность (клавиатура, фокус, ARIA).
- **Бронирование:** свободные слоты считает сервер (Asia/Almaty, рабочие часы, праздники, буферы комнат, вместимость). Цену считает только сервер. Двойное бронирование запрещено на уровне базы. Повторная отправка формы не создаёт дубль.
- **CRM:** обзор с периодами, лиды (таблица и канбан), клиенты (с объединением дублей), заказы, календарь комнат, туры, платежи (неизменяемый журнал, возвраты, сторно), production-задачи по шаблонам тарифов, интеграции и их ошибки, сотрудники и роли, настройки бизнеса.
- **Уведомления:** 12 писем клиентам на RU/KK, письма администратору, Google Calendar и Google Sheets — через очередь (outbox) с повторами.
- **Эксплуатация:** health/readiness, структурированные логи без персональных данных, проверка конфигурации при старте, резервные копии с проверкой восстановления.

## Локальный запуск

Требования: Node.js 20+ (проверено на 22 и 26), PostgreSQL 16, npm.

```bash
npm install
cp .env.example .env.local        # заполните DATABASE_URL, AUTH_SECRET, OWNER_*
npm run env:check                 # проверка переменных (значения не выводятся)
npm run db:migrate                # применить миграции к базе разработки
npm run db:seed                   # комнаты, тарифы, настройки, первый владелец
npm run dev                       # http://localhost:3000, CRM — /admin
```

PostgreSQL на macOS (однократно):

```bash
brew install postgresql@16
pg_ctl -D /opt/homebrew/var/postgresql@16 start
createuser -s shymkent   # или роль с правом CREATEDB — она нужна тестам
createdb -O shymkent shymkent_dev && createdb -O shymkent shymkent_test
```

Сгенерировать секрет:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Пароль владельца забыт? `npm run admin:reset-password` (интерактивно, пароль не попадает в историю shell).

## Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | Сервер разработки |
| `npm run build` / `npm start` | Production-сборка и запуск |
| `npm run build:worker` | Сборка отдельного outbox-воркера (`scripts-dist/outbox-worker.js`, для Docker) |
| `npm run typecheck` / `npm run lint` | Проверка типов / ESLint |
| `npm run test:unit` | Unit-тесты (без базы) |
| `npm run test:db` | Интеграционные тесты: создают временную базу рядом с `DATABASE_URL_TEST`, применяют миграции с нуля и удаляют её |
| `npm test` | Unit + интеграционные |
| `npm run test:e2e` | E2E (Playwright) в dry-run: временная база, production-сборка в `.next-e2e`, сервер на :3100. Первый раз: `npx playwright install chromium` |
| `npm run env:check` | Проверка переменных окружения (`NODE_ENV=production npm run env:check` — правила production) |
| `npm run db:validate` | Проверка схемы Prisma |
| `npm run db:migrate` | Новая миграция / применение в разработке |
| `npm run db:deploy` | Применить миграции (production, переменные из окружения) |
| `npm run db:deploy:local` | То же с `.env.local` |
| `npm run db:seed` | Идемпотентный seed (не меняет пароль существующего владельца и настройки) |
| `npm run db:drift` | Миграции на чистой временной базе + сравнение со схемой |
| `npm run db:backup` | Резервная копия (`pg_dump`) в `backups/`, без перезаписи |
| `npm run db:restore-check` | Восстановление копии во временную базу, проверка и удаление |
| `npm run outbox:worker` | Отдельный процесс очереди интеграций (`-- --once` — один проход) |
| `npm run admin:reset-password` | Сброс пароля владельца |

Тесты никогда не отправляют письма и не обращаются к Google: интеграции в тестах всегда работают в режиме dry-run, а E2E-сервер получает только тестовые учётные данные.

## Структура

```
app/(site)/          публичные страницы (layout: шапка, подвал, данные каталога)
app/admin/           CRM (login, (panel)/… — разделы; серверные действия в actions.ts)
app/api/             bookings, tours, availability, cron/outbox, health, ready, auth (Google OAuth)
components/          секции сайта, формы бронирования и тура, компоненты CRM
lib/                 бизнес-логика: availability, pricing, policy, bookings, tours, admin/*, outbox/*,
                     notifications, integrations, auth, env-schema, log, settings
prisma/              schema.prisma, миграции (включая exclusion constraints и защиту журнала платежей), seed
scripts/             outbox-worker, backup, restore-check, drift-check, env-check, reset-owner-password
tests/unit, tests/integration, e2e/   тесты
public/translations/ ru.json, kk.json — тексты сайта
```

## Язык и SEO

Язык выбирается переключателем «РУ / ҚАЗ» и хранится в браузере. У каждой страницы один URL, сервер отдаёт русскую версию. Поэтому `hreflang` намеренно не используется: отдельных казахских URL нет, и ложных сигналов для поисковиков нет (подробнее — [docs/FINAL_AUDIT.md](docs/FINAL_AUDIT.md)).

## Цвета и шрифт

Чёрный, белый и светлый фирменный оранжевый. Все оттенки — токены `brand` в `tailwind.config.ts` (те же значения — CSS-переменные в `app/globals.css`); в компонентах цвета вручную не задаются.

| Токен | Цвет | Где используется | Контраст |
|---|---|---|---|
| `brand` | `#FF7A1A` | заливки, акценты на тёмном фоне, выбранные элементы | 8,0:1 с чёрным |
| `brand-light` | `#FF9A4D` | текст и фокус на чёрном фоне | 10:1 на чёрном |
| `brand-strong` | `#EA580C` | hover, крупные цифры и цены, иконки, рамки, фокус на светлом фоне | 3,6:1 на белом (крупный текст и UI — AA) |
| `brand-ink` | `#C2410C` | мелкий оранжевый текст и ссылки на светлом фоне | 5,2:1 на белом (AA) |
| `brand-soft` | `#FFF3E8` | подложки подсказок и выбранных карточек | — |
| `on-brand` | `#171717` | текст на оранжевых кнопках и плашках | ≥ 5,8:1 по всему градиенту |

Градиент главных кнопок (`.btn-primary`, панель «Позвонить», бейджи): `#FF8A3D → #F56618`, при наведении `#FF7A2A → #EA580C`. Текст на оранжевом — тёмный: белый на светлом оранжевом не проходит WCAG AA (2,3–3,1:1).

Высота фиксированной шапки (панель звонка + меню) — `--header-height` в `app/globals.css`; от неё считаются отступ страницы, `scroll-padding-top` для якорей и липкие блоки.

Шрифт Onest подключается через `next/font`: без запросов к Google из браузера посетителя, с казахскими буквами.
