# Интеграции: почта, Google Calendar, Google Sheets, cron

Все интеграции необязательны. Сайт и CRM работают без них: заявки, оплаты и задачи хранятся в PostgreSQL. Каждую интеграцию можно временно выключить в CRM → «Настройки» → «Интеграции» (только владелец). Состояние видно в CRM → «Интеграции».

## Как это работает (outbox)

1. Бизнес-операция (заявка, подтверждение, перенос, отмена, оплата, ссылка на оплату, готовность материалов) выполняется в одной транзакции PostgreSQL. В той же транзакции создаются задачи `IntegrationJob`: письма, событие календаря, строка таблицы.
2. Клиент получает ответ только после commit. Сбой почты или Google на заказ не влияет.
3. Задачи выполняются тремя способами (достаточно любого):
   - сразу после ответа (`after()` — работает и на Vercel, и на обычном сервере);
   - `GET|POST /api/cron/outbox` по расписанию, с заголовком `Authorization: Bearer $CRON_SECRET`;
   - процессом `npm run outbox:worker` (в Docker — `node scripts-dist/outbox-worker.js`).
4. Повторы: до 5 попыток с паузой 1 → 2 → 4 → 8 → 16 минут (экспоненциально, максимум 1 час). Затем статус FAILED — задача видна в CRM → «Интеграции», её можно повторить кнопкой «Повторить».
5. Задача, зависшая в PROCESSING дольше 10 минут (упал воркер), возвращается в очередь. Несколько воркеров работают безопасно (`FOR UPDATE SKIP LOCKED`).
6. Выполненные задачи старше `OUTBOX_RETENTION_DAYS` (30 дней) удаляются при вызове cron и воркером раз в час. FAILED-задачи сохраняются.
7. Cron-эндпоинт без верного секрета отвечает 404. Секрет сравнивается за постоянное время и должен быть не короче 32 символов. За один вызов обрабатывается не больше 100 задач (`?limit=`).

### Какие события отправляются

| Событие | Кому | Когда |
|---|---|---|
| Заявка получена | клиенту (если указан email) + администратору | новая заявка на сайте |
| Бронь подтверждена | клиенту | статус «Подтверждён» |
| Ссылка на оплату | клиенту | менеджер сохранил ссылку с галочкой «Отправить письмо» |
| Бронь перенесена / отменена | клиенту | перенос / отмена в CRM |
| Напоминание за 24 ч и за 2 ч | клиенту | только для подтверждённых заказов; включаются в «Настройках» |
| Заказ готов | клиенту | задача «Передача» закрыта и есть ссылка на материалы |
| Тур: новая заявка | администратору | заявка на тур |
| Тур подтверждён / перенесён / отменён / напоминание | клиенту | действия с туром в CRM |
| Google Calendar | календарь студии | создание, изменение, перенос, отмена (событие удаляется) |
| Google Sheets | таблица | любое изменение заказа: строка обновляется по номеру заказа |

Письма клиенту уходят на языке, на котором он оформлял заявку (RU/KK). Пользовательский ввод экранируется. Контакты в подписи берутся из CRM → «Настройки» → «Контакты студии».

При отмене заказа или тура запланированные напоминания снимаются («не отправлено (отмена)»). При переносе — старые напоминания снимаются, новые планируются.

### Границы «ровно один раз»

Внешние почтовые сервисы дают доставку «хотя бы один раз» (at-least-once). Как дубли сведены к минимуму:

- **Ключ идемпотентности.** У каждого события стабильный ключ, например `booking:<id>:confirmed_email` или `booking:<id>:reminder_24h:<время начала>`. Повтор того же действия не создаёт второй задачи.
- **Message-ID провайдера** сохраняется сразу после отправки. Если воркер упал до отметки «выполнено», повтор письмо заново не отправит.
- **Остаточное окно:** письмо ушло, а Message-ID записать не успели (сбой ровно между этими шагами). Тогда возможен один дубль — это фундаментальное ограничение SMTP.
- **Google Calendar:** id события детерминированный (хеш id заказа). Повторная вставка превращается в обновление, дублей нет.
- **Проверка актуальности:** перед отправкой обработчик сверяет текущее состояние заказа.

## Почта (SMTP)

Подойдёт любой SMTP: Google Workspace, Yandex 360, Mailgun, SendGrid и другие.

```
SMTP_HOST=smtp.example.com
SMTP_PORT=587            # 465 — SSL
SMTP_USER=salem@shymkent.studio
SMTP_PASSWORD=…          # пароль приложения / API-ключ SMTP
SMTP_FROM="SHYMKENT STUDIO <salem@shymkent.studio>"
ADMIN_NOTIFICATION_EMAIL=salem@shymkent.studio
```

Вариант с Gmail / Google Workspace: включите двухэтапную аутентификацию и создайте «Пароль приложения» (Google Account → Security → App passwords). Затем задайте `GMAIL_USER` и `GMAIL_APP_PASSWORD`, а `SMTP_HOST` оставьте пустым.

Чтобы письма не попадали в спам, настройте в DNS домена SPF, DKIM и DMARC по инструкции почтового провайдера.

Проверка: оформите тестовую заявку на сайте со своим email и посмотрите письмо и CRM → «Интеграции» (статус COMPLETED).

## Google Calendar

1. [Google Cloud Console](https://console.cloud.google.com) → создайте проект → APIs & Services → Library → **Google Calendar API** → Enable.
2. OAuth consent screen: тип External или Internal (Workspace), добавьте свой email в Test users (или опубликуйте приложение).
3. Credentials → Create credentials → OAuth client ID → **Web application**. Authorized redirect URI: `https://shymkent.studio/api/auth/callback` (для локальной разработки — `http://localhost:3000/api/auth/callback`).
4. Задайте `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALENDAR_ID` (Google Calendar → настройки календаря → «Интеграция календаря» → Calendar ID).
5. Войдите в CRM как владелец → «Настройки» → «Интеграции» → «Подключить Google Calendar». Токен хранится в базе в зашифрованном виде (AES-256-GCM с ключом от `AUTH_SECRET`) и никогда не отдаётся в браузер. OAuth `state` проверяется.
6. При смене `AUTH_SECRET` подключение нужно повторить.

## Google Sheets (зеркало заказов)

PostgreSQL остаётся главным хранилищем, таблица — только копия для удобства.

1. Создайте таблицу, лист `Bookings`, в первой строке — заголовки: `bookingNumber, status, paymentStatus, name, phone, email, service, room, date, time, duration, participants, comment, price, paid, timestamp`.
2. «Расширения» → Apps Script → вставьте код и сохраните:

```js
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Bookings');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const keyCol = headers.indexOf('bookingNumber') + 1;
  const row = headers.map((h) => data[h] ?? '');
  const found =
    keyCol > 0 && sheet.getLastRow() > 1
      ? sheet.getRange(2, keyCol, sheet.getLastRow() - 1).createTextFinder(String(data.key)).matchEntireCell(true).findNext()
      : null;
  if (found) sheet.getRange(found.getRow(), 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);
  return ContentService.createTextOutput('ok');
}
```

3. «Развернуть» → «Новое развертывание» → тип «Веб-приложение». Выполнять от имени: «Я». Доступ: «Все». Скопируйте URL (`https://script.google.com/macros/s/…/exec`) в `GOOGLE_APPS_SCRIPT_URL`.
4. Строка ищется по номеру заказа (`SS-00001`) и обновляется, а не дублируется. URL веб-приложения — секрет: не публикуйте его.

## Kaspi

Kaspi API не подключён: нет официального API-доступа и договора. Сайт честно пишет, что оплата — по ссылке после подтверждения администратором. Процесс:

1. Менеджер создаёт счёт или ссылку в Kaspi Pay (приложение продавца).
2. Вставляет ссылку в карточку заказа («Ссылка на оплату (Kaspi)»). При наличии email клиенту уходит письмо со ссылкой.
3. Когда деньги пришли — «Добавить оплату» → «Деньги получены». Можно сначала создать «Ожидаем оплату» и потом подтвердить.

Модель платежей уже хранит `provider`, `reference` и `paymentUrl`. Если появится официальный API и webhook, адаптер будет создавать ожидающий платёж и подтверждать его теми же функциями `recordPayment` / `settlePendingPayment`.

## Cron

| Платформа | Настройка |
|---|---|
| Vercel Pro | уже в `vercel.json`: каждые 5 минут |
| Vercel Hobby | удалить `crons` из `vercel.json`; внешний планировщик раз в 1–5 минут (см. ниже) |
| Docker / VPS | воркер `node scripts-dist/outbox-worker.js` или системный cron |

```bash
# crontab / cron-job.org / GitHub Actions — раз в минуту
curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://shymkent.studio/api/cron/outbox > /dev/null
```

Напоминания за 24 и 2 часа отправляются при ближайшем запуске после наступления времени. При cron раз в 5 минут точность — до 5 минут.

## Режим dry-run

`INTEGRATIONS_DRY_RUN=true` — ни одного обращения к почте и Google: задачи выполняются «вхолостую» и отмечаются как выполненные. Используется в тестах (всегда), в E2E и на демо-стендах. В production должно быть `false`: сервер выведет предупреждение, если это не так.
