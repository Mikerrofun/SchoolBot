# Рефакторинг MVP (ветка `refactoring-mvp`)

Полная документация по рефакторингу: какие решения приняты и почему, как
устроена архитектура, как идут потоки данных, и примеры самого важного кода.

---

## 1. Зафиксированные решения

| Вопрос | Решение |
|---|---|
| Webhook | Оставить, добавить секрет-токен и обработку ошибок |
| Кроны | Удалить полностью (`vercel.json` + `/api/cron/weekly`) |
| Модель данных | Уроки и «Дополнительно» — по датам, окно -1/0/1 считается на лету |
| «Дополнительно» | Меняется по неделям → хранится по датам, окно работает как у ДЗ |
| Подтверждение админом | Только уроки при `same=false`; «Дополнительно» сохраняется сразу |
| Админы | `ADMIN_TELEGRAM_IDS` env, проверка на сервере |
| Просмотр ДЗ | Весь день одним текстом, пустые уроки — «—» |
| Дни без уроков | Seed создаёт записи всех уроков; пустой день = «Уроков нет» |
| AI недоступен | **Изменено в ходе рефакторинга:** ДЗ уходит в `PENDING`, админ получает пометку «AI недоступен». Непроверенный текст никогда не публикуется автоматически |

---

## 2. Архитектура: слои

```
Telegram
   │  HTTPS + X-Telegram-Bot-Api-Secret-Token
   ▼
src/app/api/telegram/webhook/route.ts   ← транспорт: секрет, try/catch, always-200
   ▼
src/bot/bot.ts                          ← сборка бота, сессия, registerHandlers
   ▼
src/bot/handlers/*                      ← навигация и колбэки, БЕЗ Prisma и БЕЗ текстов
   ▼
src/services/*                          ← бизнес-правила (единственные, кто трогает Prisma)
   ▼
src/lib/*                               ← недели/таймзона, AI, админы, prisma-клиент
```

Инварианты слоёв (проверяются grep'ом, см. конец файла):

- **handlers не импортируют `@/lib/prisma`** — только сервисы;
- **handlers не содержат строк с русским текстом** — только `src/bot/messages.ts`;
- **типы живут в одном месте** — `src/types.ts`, локальных дубликатов нет.

### Карта файлов

```
src/
├── types.ts                        # единственный источник доменных типов
├── lib/
│   ├── weeks.ts                    # календарь: окно недели, учебные дни, таймзона
│   ├── admin.ts                    # ADMIN_TELEGRAM_IDS, isAdmin
│   ├── ai.ts                       # OpenRouter, compareHomework -> {same,betterText}|null
│   └── prisma.ts                   # клиент Prisma
├── services/
│   ├── schedule.service.ts         # уроки: неделя/день/диапазон
│   ├── homework.service.ts         # сохранение ДЗ + матрица решений + модерация
│   └── additional.service.ts       # «Дополнительно» по датам
├── bot/
│   ├── bot.ts                      # Bot, сессия (pending), обработчик ошибок
│   ├── messages.ts                 # ВСЕ тексты и шаблоны сообщений
│   ├── keyboards.ts                # все inline-клавиатуры
│   └── handlers/
│       ├── start.ts                # /start, меню
│       ├── schedule.ts             # /расписание
│       ├── homework.ts             # /дз, /добавить + ввод текста
│       ├── additional.ts           # «Дополнительно»: просмотр и заполнение
│       └── admin.ts                # approve/reject + рассылка админам
└── app/api/telegram/webhook/route.ts
```

---

## 3. Ключевые архитектурные решения

### 3.1. Даты вместо «номера недели»: окно -1/0/1 на лету

**Проблема:** хранить «активную неделю» в БД и обновлять её кроном — значит
иметь состояние, которое может протухнуть (крон упал, деплой задержался).

**Решение:** активное окно трёх недель **никогда не хранится** — оно
вычисляется от текущей даты при каждом запросе. Кроны не нужны, «переход
недели» происходит сам, история в БД не удаляется.

**Зачем нужен `src/lib/weeks.ts`:** единственное место, где считаются даты.
Таймзона школы задаётся переменной `SCHOOL_TIMEZONE` (по умолчанию
`Europe/Moscow`), чтобы «понедельник» не зависел от UTC на сервере.

```ts
export const SCHOOL_TIMEZONE = process.env.SCHOOL_TIMEZONE ?? "Europe/Moscow";

/** Monday 00:00 of the week containing `now`, in the school timezone. */
export function currentWeekStart(now: Date = new Date()): Date { /* ... */ }

/**
 * The single source of week boundaries: Monday 00:00 through
 * Sunday 23:59:59.999 of the week shifted by `offset` (-1 | 0 | 1).
 */
export function getWeekWindow(offset: WeekOffset, now: Date = new Date()): WeekWindow {
  const start = weekStart(offset, now);
  const end = addDays(start, 6);
  end.setUTCHours(23, 59, 59, 999);
  return { start, end, offset };
}
```

`WeekWindow` — тип из `src/types.ts`: `{ start, end, offset }`. Сервисы
принимают окно, а не «номер недели», поэтому им всё равно, откуда он пришёл.

### 3.2. Модель данных: уроки и «Дополнительно» — по конкретным датам

```prisma
model Lesson {
  id           Int       @id @default(autoincrement())
  date         DateTime  @db.Date          // конкретная дата, не «день недели»
  day          String                      // MONDAY..FRIDAY (для подписей)
  lessonNumber Int
  subject      String
  homework     Homework?
  @@unique([date, lessonNumber])
}

model Homework {
  id        Int            @id @default(autoincrement())
  lessonId  Int            @unique         // 1:1 — храним самое актуальное ДЗ
  text      String
  status    HomeworkStatus @default(APPROVED)
  createdBy String?
  lesson    Lesson         @relation(fields: [lessonId], references: [id])
}

model AdditionalHomework {
  id       Int     @id @default(autoincrement())
  date     DateTime @db.Date @unique      // та же схема «по датам», что у уроков
  text     String
  authorId String?
}
```

Следствия:

- окно -1/0/1 — это просто `WHERE date BETWEEN start AND end` для любой
  недели, прошлой или будущей;
- «Дополнительно» меняется по неделям → хранится по датам, окно работает
  так же, как у ДЗ;
- пустой день = в БД просто нет уроков на эту дату (seed создаёт все уроки
  недели, поэтому пустой день — осознанное «Уроков нет», а не ошибка).

### 3.3. Просмотр ДЗ: весь день одним сообщением

Старый сценарий «неделя → день → урок» для просмотра заменён: выбор дня
сразу присылает **весь день одним текстом**. Пустые уроки — «—», день без
уроков — «Уроков нет». Выбор отдельного урока остался только в сценарии
добавления.

```ts
/** The whole day's homework as a single message; empty lessons show "—". */
export function dayHomeworkMessage(date: Date, rows: DayHomeworkRow[], viewerIsAdmin: boolean): string {
  const header = `${DAY_LABELS[dayKeyFromDate(date)]}, ${formatDate(date)}`;
  if (rows.length === 0) return `${header}\n\n${NO_LESSONS_TEXT}`;

  const lines: string[] = [header, ""];
  for (const { lesson, homework } of rows) {
    lines.push(`📚 ${lesson.subject}`);
    lines.push(homework?.text ?? HOMEWORK_EMPTY_TEXT);   // "—" для пустых
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
```

PENDING-ДЗ фильтруется на уровне сервиса: обычный пользователь его не
видит вообще, админ видит с пометкой.

```ts
homework:
  lesson.homework && (opts.includePending || lesson.homework.status === "APPROVED")
    ? lesson.homework
    : null,
```

### 3.4. Модерация: `same=false` → PENDING → админ

Когда AI говорит, что новое ДЗ **отличается** от прошлонедельного, текст
сохраняется со статусом `PENDING`:

- обычным пользователям он не виден (фильтр из 3.3);
- всем админам из `ADMIN_TELEGRAM_IDS` уходит сообщение с кнопками
  «Подтвердить» / «Отклонить»;
- «Подтвердить» → `APPROVED`, «Отклонить» → запись удаляется;
- автор получает уведомление об исходе.

Проверка админа — **на сервере**, в обработчике колбэка, а не только
скрытием кнопок:

```ts
// src/lib/admin.ts
export function getAdminIds(): number[] {
  return (process.env.ADMIN_TELEGRAM_IDS ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export function isAdmin(userId?: number): boolean {
  return userId !== undefined && getAdminIds().includes(userId);
}
```

```ts
// src/bot/handlers/admin.ts
bot.callbackQuery(/^hw:approve:(\d+)$/, async (ctx) => {
  // Server-side permission check, not just UI-level hiding.
  if (!isAdmin(ctx.from?.id)) {
    await ctx.answerCallbackQuery({ text: NOT_ADMIN_ALERT_TEXT, show_alert: true });
    return;
  }
  // ...
});
```

«Дополнительно» модерации не имеет — сохраняется сразу (зафиксированное
решение).

### 3.5. Деградация AI: непроверенный текст никогда не публикуется

**Проблема (найдена при ревью):** изначально при недоступном OpenRouter
новый текст сохранялся сразу как `APPROVED` — то есть падение AI
автоматически «принимало» изменения, которые никто не проверял.

**Решение:** вердикта AI нет → статус неизвестен → запись сохраняется как
`PENDING`, а админы получают уведомление с **другой пометкой** —
«AI-проверка недоступна, проверьте вручную». Автор видит отдельный текст
«⚠️ AI-проверка временно недоступна…». Итог: когда AI упал, для
пользователей ничего не меняется, а решение принимает человек.

Причина модерации передаётся явно типом `AdminReviewReason`:

```ts
// src/types.ts
/** Why a homework submission was sent to admins for approval. */
export type AdminReviewReason = "same_false" | "ai_down";
```

```ts
// src/bot/handlers/homework.ts — ветка PENDING
if (result.status === "PENDING") {
  const aiDown = result.action === "pending_ai_down";
  await ctx.reply(aiDown ? HOMEWORK_PENDING_AI_DOWN_TEXT : HOMEWORK_PENDING_SAVED_TEXT);
  // ...
  await notifyAdminsNewHomework(bot, {
    homeworkId: result.id,
    reason: aiDown ? "ai_down" : "same_false",
    // ...
  });
}
```

Полная матрица решений `saveHomework` — в разделе 4.2.

### 3.6. Webhook: секрет + обработка ошибок + always-200

Три независимых уровня защиты и устойчивости:

1. **Секрет-токен.** `setWebhook` передаёт `secret_token`, Telegram шлёт его
   в заголовке `X-Telegram-Bot-Api-Secret-Token`; route handler сверяет его
   с `TELEGRAM_WEBHOOK_SECRET` и отвечает `401` до какой-либо обработки.
2. **Битый JSON** → `400`, а не падение.
3. **Always-200.** Любая ошибка обработчика логируется, но Telegram получает
   `200` — иначе Telegram бесконечно ретраит апдейт. Пользователю об ошибке
   сообщает `bot.catch` («Произошла ошибка, попробуйте позже»).

```ts
export async function POST(req: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return new Response("Bot is not configured", { status: 503 });
  }

  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const received = req.headers.get("x-telegram-bot-api-secret-token");
  if (!expected || received !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  let update: Update;
  try {
    update = (await req.json()) as Update;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  // Always answer 200 so Telegram does not retry the update endlessly;
  // handler-level errors are reported to the user from bot.catch.
  try {
    await getBot().handleUpdate(update);
  } catch (error) {
    console.error("[v0] webhook update failed:", error);
  }

  return new Response("OK", { status: 200 });
}
```

### 3.7. Тексты и клавиатуры — отдельно от логики

`src/bot/messages.ts` содержит **все** строки бота: константы и чистые
шаблонные функции (`dayHomeworkMessage`, `adminReviewMessage`,
`homeworkSavedMessage`…). Хендлеры собирают сообщения из них и не содержат
ни одного русского литерала. Смена формулировки = правка одного файла.

### 3.8. Порядок регистрации хендлеров

В `bot.ts` порядок важен: сначала команды и callback-флоу, **последним** —
`bot.on("message:text")` (ввод ДЗ). Иначе свободный текст перехватил бы
команды. Плюс `message:text` срабатывает только при активном `pending`
в сессии.

---

## 4. Поток данных

### 4.1. Просмотр ДЗ (`/дз`)

```
/дз → неделя (-1|0|1) → день
                        │ getDayHomework(date, { includePending: isAdmin })
                        ▼
              один текст: «Пн, 14.09»
                📚 Алгебра
                §12, задачи 1-4
                📚 Русский
                —            ← пустой урок
```

### 4.2. Добавление ДЗ (`/добавить`) — матрица решений `saveHomework`

| Существующее ДЗ | AI | Вердикт | `action` | Статус в БД | Кто уведомлён |
|---|---|---|---|---|---|
| нет | — | — | `created` | `APPROVED` | никто (первое ДЗ свободно) |
| есть | `same=true`, есть `betterText` | то же задание, формулировка лучше | `updated` | `APPROVED` | никто |
| есть | `same=true`, без `betterText` | то же задание | `kept` | без изменений | никто |
| есть | `same=false` | разные задания | `updated` | `PENDING` | админы: «отличается от прошлой недели» |
| есть | `null` (AI недоступен) | **неизвестно** | `pending_ai_down` | `PENDING` | админы: «AI-проверка недоступна» |

Ключевой код:

```ts
const comparison = await compareHomework(existing.text, trimmed);

if (comparison?.same) {
  // same + улучшенная формулировка -> заменить и оставить APPROVED
  // same без улучшения -> оставить как есть
}

// same=false (different assignment) -> PENDING until an admin approves it.
// AI unavailable -> the verdict is unknown, so also PENDING: an unverified
// text must never replace the approved one automatically.
const updated = await prisma.homework.update({
  where: { lessonId },
  data: { text: trimmed, createdBy, status: "PENDING" },
});
return {
  id: updated.id,
  action: comparison ? "updated" : "pending_ai_down",
  // ...
};
```

Дальше ветка PENDING (см. 3.5): автору — статус-текст, админам — карточка с
кнопками. `approve` → `APPROVED`, `reject` → запись удалена, автор уведомлён.

### 4.3. «Дополнительно»

```
меню → 📌 Дополнительно
        ├─ Просмотр: неделя → один текст «Пн: текст / — …» (без модерации)
        └─ Заполнить: неделя → день → текст → сохраняется СРАЗУ (upsert по дате)
```

### 4.4. Подтверждение админом

```
админ: карточка «🆕/⚠️ ДЗ на подтверждении»
   ├─ ✅ Подтвердить → status=APPROVED, автору «✅ Твоё ДЗ подтверждено»
   └─ ❌ Отклонить  → запись удалена, автору «❌ Твоё ДЗ отклонено админом»
Карточка после решения помечается: «✅ Подтверждено админом» / «❌ Отклонено».
Не-админ, нажавший кнопку (например, пересланное сообщение), получает
alert «Подтвердить может только админ.» — проверка серверная.
```

---

## 5. Миграция и развёртывание

- Миграция: `prisma/migrations/20260910000000_homework_status_and_additional/`
  — добавляет `HomeworkStatus` enum + колонку `status` (дефолт `APPROVED`)
  и таблицу `AdditionalHomework`. Применение: `npx prisma migrate deploy`.
- Seed (`prisma/seed.ts`) создаёт **все уроки недели** (Пн–Пт) и примеры
  «Дополнительно» — пустой день в боте означает «Уроков нет», а не отсутствие
  данных.
- Новые переменные окружения: `TELEGRAM_WEBHOOK_SECRET` (обязателен в проде —
  без него webhook отвечает 401), `ADMIN_TELEGRAM_IDS` (ID через запятую),
  `SCHOOL_TIMEZONE` (опционально). `CRON_SECRET` удалён вместе с кронами.
- После деплоя выполнить `scripts/set-webhook.ts` (передаёт `secret_token`).

## 6. Что сознательно НЕ сделано

- **Кроны и `vercel.json`** — удалены: окно недель вычисляется на лету,
  состояние «активной недели» не существует.
- **Long polling** — не используется, только webhook.
- **Хранение истории ДЗ** — модель 1:1 (`lessonId @unique`), хранится самое
  актуальное ДЗ урока; история не требуется MVP.
- **Модерация «Дополнительно»** — не нужна по зафиксированному решению.
- **OAuth/роли** — админ определяется только `ADMIN_TELEGRAM_IDS`.

## 7. Как проверить инварианты

```bash
# handlers не трогают Prisma напрямую
grep -ri "prisma" src/bot/        # -> 0 совпадений

# в handlers нет захардкоженных русских текстов
grep -rnP "[А-Яа-яЁё]" src/bot/handlers/   # -> только импорты из messages.ts

# кронов больше нет
grep -ri "cron" . --exclude-dir=node_modules   # -> 0 совпадений
```
