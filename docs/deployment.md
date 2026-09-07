# Развёртывание

## Переменные окружения

Эталон — `.env.example` в корне проекта:

```env
# PostgreSQL connection string (Supabase / Neon / any Postgres)
DATABASE_URL=

# Telegram bot token from @BotFather
TELEGRAM_BOT_TOKEN=

# OpenRouter API key (optional — bot works without AI deduplication)
OPENROUTER_API_KEY=

# Secret for Vercel Cron requests (Authorization: Bearer <CRON_SECRET>)
CRON_SECRET=

# Secret token Telegram sends with every webhook request
TELEGRAM_WEBHOOK_SECRET=
```

| Переменная | Обязательна | Для чего |
|---|---|---|
| `DATABASE_URL` | да | подключение к PostgreSQL для Prisma |
| `TELEGRAM_BOT_TOKEN` | да | токен бота; без него webhook отвечает 503 |
| `OPENROUTER_API_KEY` | нет | AI-дедупликация; без неё ДЗ сохраняется без анализа |
| `CRON_SECRET` | рекомендуется | защита `/api/cron/weekly` |
| `TELEGRAM_WEBHOOK_SECRET` | рекомендуется | Telegram шлёт его в `X-Telegram-Bot-Api-Secret-Token` |

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
  `X-Telegram-Bot-Api-Secret-Token`, который grammY проверяет автоматически
  (см. `webhookCallback(..., { secretToken })` в route handler'е).
- `allowed_updates` ограничен `message` и `callback_query` — бот не получает
  лишние типы событий.
- URL можно не передавать аргументом: скрипт подставит `VERCEL_URL` или
  `TELEGRAM_WEBHOOK_URL` из окружения.

### 4. Vercel Cron

`vercel.json` уже содержит расписание:

```json
{
  "crons": [
    {
      "path": "/api/cron/weekly",
      "schedule": "0 23 * * 0"
    }
  ]
}
```

Vercel сам дёргает `GET /api/cron/weekly` каждое воскресенье в 23:00 UTC с
заголовком `Authorization: Bearer <CRON_SECRET>`. Джоба пересчитывает окно
трёх недель и логирует его; состояние БД она не меняет (идемпотентна).

## Локальная проверка без Telegram

Эндпоинты можно проверять curl'ом:

```bash
# cron: вернёт окно трёх недель в JSON
curl http://localhost:3000/api/cron/weekly

# webhook без токена бота: 503 "Bot is not configured"
curl -X POST http://localhost:3000/api/telegram/webhook
```

## Статусная страница

`/` (корень) — статусная страница: показывает, какие переменные окружения
заданы, и краткую инструкцию по запуску. Удобно сразу после деплоя понять,
чего не хватает.

## Безопасность — сводка

- Webhook защищён секретом Telegram (`secret_token` при setWebhook +
  проверка в `webhookCallback`).
- Cron защищён `Authorization: Bearer <CRON_SECRET>`.
- Все запросы к БД идут через Prisma с параметризованными запросами
  (SQL-инъекции исключены на уровне ORM).
- Callback-данные валидируются регулярками и `parseDateKey` — в БД не
  попадает ничего, кроме числа-`lessonId` и проверенной даты:

```ts
// src/lib/weeks.ts
export function parseDateKey(key: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const d = new Date(`${key}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}
```
