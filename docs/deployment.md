# Развёртывание

## Переменные окружения

**Зачем нужен `.env.example`:** это чек-лист конфигурации. Файл не содержит
секретов — он перечисляет имена переменных с комментариями, чтобы при
настройке нового окружения (локально или на Vercel) ничего не забыть.
Реальные значения живут в `.env` (не в Git) и в Vars проекта Vercel.

Эталон — `.env.example` в корне проекта:

```env
# PostgreSQL connection string (Supabase / Neon / any Postgres)
DATABASE_URL=

# Telegram bot token from @BotFather
TELEGRAM_BOT_TOKEN=

# OpenRouter API key (optional — bot works without AI deduplication)
OPENROUTER_API_KEY=

# Secret token Telegram sends with every webhook request
TELEGRAM_WEBHOOK_SECRET=

# Comma-separated Telegram user IDs of homework approvers
ADMIN_TELEGRAM_IDS=
```

| Переменная | Обязательна | Для чего |
|---|---|---|
| `DATABASE_URL` | да | подключение к PostgreSQL для Prisma |
| `TELEGRAM_BOT_TOKEN` | да | токен бота; без него webhook отвечает 503 |
| `OPENROUTER_API_KEY` | нет | AI-дедупликация; без неё обновления существующего ДЗ уходят админам как `PENDING` с пометкой «AI недоступен» |
| `TELEGRAM_WEBHOOK_SECRET` | да | Telegram шлёт его в `X-Telegram-Bot-Api-Secret-Token`; без совпадения webhook отвечает 401 |
| `ADMIN_TELEGRAM_IDS` | нет | ID админов через запятую; подтверждают ДЗ при `same=false` |

## Порядок запуска

### 1. Миграции

```bash
npx prisma migrate dev --name init   # локально
npx prisma migrate deploy            # на проде / в CI
```

### 2. Демо-расписание

```bash
pnpm db:seed
```

Скрипт `prisma/seed.ts` создаёт уроки **текущей** недели (Пн–Пт, по 3 урока)
и примеры ДЗ. Повторный запуск безопасен — используется `upsert` по ключу
`(date, lessonNumber)`.

### 3. Webhook

После первого деплоя (нужен публичный HTTPS-URL):

```bash
pnpm bot:set-webhook https://your-app.vercel.app
```

**Зачем нужен `scripts/set-webhook.ts`:** одноразовая настройка после
деплоя. Telegram сам не узнаёт о вашем приложении — скрипт сообщает API
Telegram, на какой URL слать обновления, с каким секретом и какими типами
событий. Запускается вручную: `pnpm bot:set-webhook https://your-app.vercel.app`.

**`scripts/set-webhook.ts`** (ключевая часть):

```ts
const webhookUrl = `${url.replace(/\/$/, "")}/api/telegram/webhook`;
const secret = process.env.TELEGRAM_WEBHOOK_SECRET;

const response = await fetch(
  `https://api.telegram.org/bot${token}/setWebhook`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ["message", "callback_query"],
    }),
  }
);
```

- `secret_token` — Telegram начнёт присылать заголовок
  `X-Telegram-Bot-Api-Secret-Token`, который route handler сверяет с
  `TELEGRAM_WEBHOOK_SECRET` и отвечает 401 при несовпадении.
- `allowed_updates` ограничен `message` и `callback_query` — бот не получает
  лишние типы событий.
- URL можно не передавать аргументом: скрипт подставит `VERCEL_URL` или
  `TELEGRAM_WEBHOOK_URL` из окружения.

## Локальная проверка без Telegram

Эндпоинты можно проверять curl'ом:

```bash
# webhook без токена бота: 503 "Bot is not configured"
curl -X POST http://localhost:3000/api/telegram/webhook
```

## Статусная страница

`/` (корень) — статусная страница: показывает, какие переменные окружения
заданы, и краткую инструкцию по запуску. Удобно сразу после деплоя понять,
чего не хватает.

## Безопасность — сводка

- Webhook защищён секретом Telegram (`secret_token` при setWebhook +
  проверка заголовка в route handler'е).
- Все запросы к БД идут через Prisma с параметризованными запросами
  (SQL-инъекции исключены на уровне ORM).
- Callback-данные валидируются регулярками и `parseDateKey` — в БД не
  попадает ничего, кроме числа-`lessonId` и проверенной даты:

**Зачем нужен `parseDateKey` (из `src/lib/weeks.ts`):** строгий разбор даты
из callback-данных. Callback приходит от клиента, поэтому дата проверяется
регуляркой и конвертируется в UTC-полночь; при любом несоответствии
возвращается `null` и запрос игнорируется — в БД не попадает мусор.

```ts
// src/lib/weeks.ts
export function parseDateKey(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const d = new Date(`${key}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
```
