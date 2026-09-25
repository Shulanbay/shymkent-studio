# Выкладка в production

Основной вариант — **Vercel + управляемый PostgreSQL + Vercel Cron**. Запасной — **Docker** на любом сервере или VPS: образ, отдельный воркер очереди и системный cron. Перед выкладкой ознакомьтесь с [SECURITY.md](SECURITY.md) и [BACKUP_RESTORE.md](BACKUP_RESTORE.md).

## 1. Что понадобится (внешние аккаунты)

| Что | Зачем | Обязательно |
|---|---|---|
| Хостинг Next.js (Vercel Pro или сервер с Docker) | сайт и CRM | да |
| Управляемый PostgreSQL 16 (Neon, Supabase, Render, DigitalOcean, Yandex Cloud и т. п.) с ежедневными копиями и PITR | база | да |
| Домен `shymkent.studio`, доступ к DNS | HTTPS, ссылки в письмах | да |
| SMTP (Google Workspace, Yandex 360, Mailgun, SendGrid …) | письма клиентам и администратору | рекомендуется |
| Google Cloud: OAuth-клиент, Calendar API | копия заказов в Google Calendar | нет |
| Google-таблица + Apps Script | зеркало заказов в таблице | нет |

## 2. Переменные окружения

Полный список с пояснениями — в [`.env.example`](../.env.example). Проверка:

```bash
NODE_ENV=production npm run env:check
```

Production не запустится (ошибка при старте сервера, `/api/ready` → 503), если:

- нет `DATABASE_URL`;
- `AUTH_SECRET` короче 32 символов или похож на заглушку;
- нет `CRON_SECRET`, он короче 32 символов или совпадает с `AUTH_SECRET`;
- `AUTH_URL` или `NEXT_PUBLIC_SITE_URL` не https или указывают на localhost;
- интеграция настроена частично (например, `SMTP_HOST` без пароля, `GOOGLE_CALENDAR_ID` без OAuth-клиента).

| Группа | Переменные |
|---|---|
| Обязательные | `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET` |
| Первый владелец (только для seed) | `OWNER_EMAIL`, `OWNER_NAME`, `OWNER_INITIAL_PASSWORD` |
| Почта | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `ADMIN_NOTIFICATION_EMAIL` (или `GMAIL_USER` + `GMAIL_APP_PASSWORD`) |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALENDAR_ID`, `GOOGLE_APPS_SCRIPT_URL` |
| Очередь | `OUTBOX_INTERVAL_SECONDS`, `OUTBOX_RETENTION_DAYS`, `INTEGRATIONS_DRY_RUN` (в production — `false`) |
| Прокси | `TRUSTED_PROXY_COUNT` (Vercel — `1`) |
| Логи | `LOG_LEVEL` |

Контакты студии (телефон, WhatsApp, email, Instagram, адрес, ссылка на карту, дата открытия) хранятся не в переменных, а в CRM → «Настройки».

## 3. База данных

1. Создайте базу PostgreSQL 16 и пользователя приложения (владелец схемы `public`).
2. Для Vercel (serverless) используйте **pooled**-строку подключения провайдера (PgBouncer / pooler) и добавьте `&connection_limit=5`. Миграции выполняйте по **прямой** (non-pooled) строке.
3. Примените миграции и создайте первого владельца — с компьютера разработчика или из CI, указав production-строку:

```bash
DATABASE_URL="postgresql://…direct…?sslmode=require" npm run db:deploy
DATABASE_URL="postgresql://…direct…?sslmode=require" OWNER_EMAIL=… OWNER_NAME=… OWNER_INITIAL_PASSWORD=… npx prisma db seed
```

Seed идемпотентен: существующие комнаты, тарифы, настройки и пароль владельца он не меняет. После первого входа смените пароль в CRM → «Мой аккаунт» и удалите `OWNER_INITIAL_PASSWORD` отовсюду.

## 4. Vercel

1. Импортируйте репозиторий в Vercel (Framework: Next.js, команды по умолчанию: `npm install`, `npm run build`).
2. Добавьте переменные из раздела 2 (Environment: Production).
3. `vercel.json` уже содержит cron: `/api/cron/outbox` каждые 5 минут. Vercel сам передаёт `Authorization: Bearer $CRON_SECRET`.
   - Cron чаще раза в день доступен на тарифе **Pro**. На Hobby удалите блок `crons` и настройте внешний планировщик (cron-job.org, GitHub Actions, UptimeRobot) с запросом раз в 1–5 минут:
     `curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://shymkent.studio/api/cron/outbox`
4. Регион функций — `fra1` (ближайший к Казахстану). Размещайте базу в том же регионе.
5. Домен: Vercel → Settings → Domains → `shymkent.studio` и `www.shymkent.studio` (редирект на основной). В DNS добавьте записи, которые покажет Vercel. HTTPS выдаётся автоматически.
6. После выкладки проверьте:

```bash
curl -fsS https://shymkent.studio/api/health   # {"status":"ok"}
curl -fsS https://shymkent.studio/api/ready    # {"status":"ready","checks":{…"ok"}}
curl -sI https://shymkent.studio/ | grep -i -E "strict-transport|content-security"
```

Письма и события календаря уходят сразу после ответа (`after()`), а cron делает повторы, напоминания и очистку.

## 5. Docker (сервер / VPS)

Образ собирается из `Dockerfile` (Next.js standalone, запуск не от root, встроенный healthcheck).

```bash
docker build --build-arg NEXT_PUBLIC_SITE_URL=https://shymkent.studio -t shymkent-studio:$(git rev-parse --short HEAD) .
# миграции — отдельной командой перед запуском новой версии
docker run --rm --env-file /etc/shymkent/.env.production shymkent-studio:<tag> npx prisma migrate deploy
# веб-приложение
docker run -d --name web --restart unless-stopped --env-file /etc/shymkent/.env.production -p 127.0.0.1:3000:3000 shymkent-studio:<tag>
# воркер очереди (корректно завершается по SIGTERM)
docker run -d --name worker --restart unless-stopped --env-file /etc/shymkent/.env.production shymkent-studio:<tag> node scripts-dist/outbox-worker.js
```

- Перед контейнером нужен reverse proxy с HTTPS (Caddy или nginx + Let's Encrypt), который выставляет `X-Forwarded-For`. `TRUSTED_PROXY_COUNT=1`.
- Если воркер не запущен, настройте системный cron на `/api/cron/outbox` раз в минуту (команда `curl` из раздела 4).
- Файл `.env.production` храните с правами `600` вне репозитория.

## 6. Порядок выкладки новой версии

1. `npm run typecheck && npm run lint && npm test` (и `npm run test:e2e` для крупных изменений).
2. `npm run db:backup` (или снимок у провайдера базы).
3. Миграции: `npm run db:deploy` по прямой строке подключения. Миграции проекта только добавляют изменения; удаление колонок делается в два релиза.
4. Выкладка кода (Vercel — push в основную ветку; Docker — новый тег).
5. Проверка `/api/ready`, входа в CRM и тестовой записи через сайт.

## 7. Откат

- **Код:** Vercel → Deployments → предыдущая версия → «Promote to Production». Docker — запустить предыдущий тег.
- **База:** миграции назад не откатываются. Если новая миграция уже применена, но старому коду она не мешает (добавление колонок или таблиц), достаточно отката кода. Если данные повреждены — восстановление из копии по [BACKUP_RESTORE.md](BACKUP_RESTORE.md) (PITR провайдера или `pg_restore` в новую базу с переключением `DATABASE_URL`).
- Неудачная миграция, помеченная как failed: исправьте причину, затем `npx prisma migrate resolve --rolled-back <имя>` и повторите `db:deploy`.

## 8. Мониторинг

- **Uptime:** внешний монитор (UptimeRobot, Better Stack) на `/api/health` раз в минуту и на `/api/ready` раз в 5 минут, уведомления в Telegram или email.
- **Логи:** JSON-строки с `requestId` (тот же id в заголовке ответа `X-Request-Id`). Персональные данные вычищаются. Vercel → Logs или `docker logs web`. Ищите `level":"error"` и `outbox.job.failed`.
- **Очередь:** CRM → «Интеграции» → блок «Состояние системы». Там видно, если cron или воркер не работают больше 10 минут.
- **Sentry (необязательно):** если нужен сбор ошибок фронтенда, установите `@sentry/nextjs` и выполните `npx @sentry/wizard -i nextjs`. DSN укажите только в переменных хостинга. По умолчанию Sentry не подключён и не требуется.

## 9. Действия при инциденте

1. Проверьте `/api/health` и `/api/ready`: какая проверка не `ok` — `database`, `migrations` или `config`.
2. `database: error` — статус провайдера базы, лимит подключений, `DATABASE_URL`.
3. `migrations: error` — выполните `npm run db:deploy`.
4. `config: error` — `NODE_ENV=production npm run env:check` с теми же переменными.
5. Сайт работает, письма не уходят — CRM → «Интеграции»: ошибки задач, SMTP-пароль, cron. После исправления нажмите «Обработать очередь сейчас» или «Повторить».
6. Подозрение на утечку доступа — [SECURITY.md](SECURITY.md), раздел «Инцидент».
7. Запишите, что случилось и что сделали. Заказы не теряются: заявка сохраняется в базе до любых интеграций.
