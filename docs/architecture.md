# Архитектура

## Слои

```
Telegram  ──HTTPS──▶  Next.js Route Handler  ──▶  grammY Bot  ──▶  Services  ──▶  Prisma  ──▶  PostgreSQL
                      (webhook route)            (handlers)      (бизнес-логика)  (ORM)
                                                     │
                                                     └──▶ lib/ai.ts ──▶ OpenRouter API (опционально)
```

Проект — одно Next.js-приложение. Бот не выделен в отдельный сервис: он
инициализируется лениво внутри route handler'а и кэшируется в памяти процесса.

**Подтверждение** — `src/bot/bot.ts`:

```ts
let cachedBot: Bot<MyContext> | null = null;

export function getBot(): Bot<MyContext> {
  if (cachedBot) return cachedBot;

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");

  const bot = new Bot<MyContext>(token);

  bot.use(session({ initial: (): SessionData => ({}) }));

  // Commands and callback flows first, free-text homework input last.
  registerStartHandler(bot);
  registerScheduleHandlers(bot);
  registerHomeworkHandlers(bot);

  bot.catch((err) => {
    console.error("[v0] bot error:", err.error);
  });

  cachedBot = bot;
  return bot;
}
```

Кэширование важно: в serverless-окружении Vercel один тёплый инстанс
обрабатывает много обновлений, и пересоздавать `Bot` на каждый запрос
незачем.

## Структура каталогов

```
src/
├── app/
│   ├── api/
│   │   ├── telegram/webhook/route.ts   # приём обновлений Telegram
│   │   └── cron/weekly/route.ts        # еженедельная джоба (Vercel Cron)
│   ├── layout.tsx / page.tsx           # статусная страница (превью)
│   └── globals.css
├── bot/
│   ├── bot.ts                          # фабрика бота + тип сессии
│   ├── keyboards.ts                    # inline-клавиатуры и callback-схемы
│   └── handlers/
│       ├── start.ts                    # /start, /menu
│       ├── schedule.ts                 # /расписание
│       └── homework.ts                 # /дз, /добавить + ввод текста ДЗ
├── lib/
│   ├── prisma.ts                       # singleton PrismaClient
│   ├── weeks.ts                        # вычисление окна трёх недель
│   └── ai.ts                           # OpenRouter: сравнение ДЗ
└── services/
    ├── schedule.service.ts             # чтение уроков из БД
    └── homework.service.ts             # сохранение ДЗ с дедупликацией
prisma/
├── schema.prisma
└── seed.ts                             # демо-расписание текущей недели
scripts/
└── set-webhook.ts                      # регистрация webhook в Telegram
```

## Ключевое архитектурное решение: окно недель вычисляется, а не хранится

Вместо того чтобы хранить в БД «текущую неделю» и двигать её джобой, все
запросы идут по **конкретным датам**, а границы окна считаются от `new Date()`.

**Подтверждение** — `src/lib/weeks.ts`:

```ts
/** Monday of the week shifted by `offset` weeks. */
export function weekStart(offset: WeekOffset, now: Date = new Date()): Date {
  return addDays(currentWeekStart(now), offset * 7);
}

/** [monday, sunday] of the week shifted by `offset` weeks. */
export function weekRange(
  offset: WeekOffset,
  now: Date = new Date()
): [Date, Date] {
  const start = weekStart(offset, now);
  return [start, addDays(start, 6)];
}
```

Следствия:

- **Идемпотентность.** Любой запрос в любой момент времени даёт один и тот же
  ответ — состояние не зависит от того, «сработала ли ночная джоба».
- **История не удаляется.** Уроки прошлых недель остаются в БД навсегда; бот
  просто показывает только окно трёх недель.
- **Часовой пояс.** Все вычисления в UTC (`startOfWeek` обнуляет время через
  `Date.UTC`), поэтому окно стабильно независимо от таймзоны сервера.

## Поток данных (высокоуровнево)

1. Пользователь нажимает кнопку в Telegram → Telegram шлёт `callback_query`
   на `POST /api/telegram/webhook`.
2. Route handler проверяет наличие токена и передаёт обновление в grammY
   (`webhookCallback`).
3. Handler разбирает callback по регулярке (например
   `^hwv:l:(-1|0|1):(\d{4}-\d{2}-\d{2}):(\d+)$`), извлекает поток, смещение
   недели, дату и id урока.
4. Handler вызывает service (`getLessonsInRange` / `saveHomework`), тот —
   Prisma, Prisma — PostgreSQL.
5. Ответ формируется как текст сообщения + новая inline-клавиатура и
   отправляется через `ctx.editMessageText` / `ctx.reply`.

Подробные пошаговые разборы каждого сценария — в [data-flow.md](./data-flow.md).
