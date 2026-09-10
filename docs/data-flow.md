# Поток данных — пошаговые разборы

Каждый сценарий описан текстом и подтверждён реальным кодом проекта
(цитаты приведены дословно, с указанием файла).

---

## Сценарий 1. Просмотр ДЗ (`/дз`)

**Текстом:** пользователь отправляет `/дз` → бот показывает три кнопки недель
→ пользователь выбирает неделю → бот запрашивает из БД все уроки этой недели
и показывает только дни, где уроки есть → пользователь выбирает день → бот
фильтрует уроки этого дня → пользователь выбирает урок → бот достаёт урок
вместе с ДЗ и показывает текст.

**Зачем нужен `src/bot/handlers/homework.ts`:** это самый большой handler —
он обслуживает оба ДЗ-потока сразу (`hwv` — просмотр, `hwa` — добавление):
команды `/дз` и `/добавить`, выбор недели/дня/урока, показ текста ДЗ и
перехват свободного текста для сохранения. Всё в одном файле, потому что
навигация у потоков общая, различается только финальный шаг.

**Шаг 1. Команда открывает выбор недели** — `src/bot/handlers/homework.ts`:

```ts
bot.command("дз", (ctx) =>
  ctx.reply(VIEW_PICK_TEXT, { reply_markup: weekKeyboard("hwv") })
);
```

**Шаг 2. Выбор недели → запрос диапазона из БД.** Callback
`hwv:w:<offset>` разбирается регуляркой, границы недели считаются от текущей
даты:

```ts
// Week selected -> day list (days that actually have lessons).
bot.callbackQuery(/^(hwv|hwa):w:(-1|0|1)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [, flow, offsetRaw] = ctx.match!;
  const offset = Number(offsetRaw) as WeekOffset;
  const [from, to] = weekRange(offset);
  const lessons = await getLessonsInRange(from, to);
```

**Шаг 3. Показываются только дни с уроками.** Неделя разворачивается в 7 дат,
и фильтруются те, по которым есть уроки:

```ts
  const byDay = groupByDay(lessons);
  const days = weekDates(offset)
    .filter((d) => byDay.has(dayKeyFromDate(d)))
    .map((d) => ({
      dateKey: dateKey(d),
      day: dayKeyFromDate(d),
    }));
```

**Шаг 4. Выбор дня → список уроков этого дня.** Callback несёт дату
(`YYYY-MM-DD`), уроки недели фильтруются по ней:

```ts
bot.callbackQuery(/^(hwv|hwa):d:(-1|0|1):(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [, flow, offsetRaw, dayDateKey] = ctx.match!;
  const offset = Number(offsetRaw) as WeekOffset;
  const date = parseDateKey(dayDateKey);
  if (!date) return;

  const [from, to] = weekRange(offset);
  const lessons = (await getLessonsInRange(from, to)).filter(
    (l) => dateKey(l.date) === dayDateKey
  );
```

**Шаг 5. Выбор урока → текст ДЗ.** Урок достаётся вместе со связанным ДЗ
(`include: { homework: true }`); если ДЗ нет — так и пишется:

```ts
bot.callbackQuery(/^hwv:l:(-1|0|1):(\d{4}-\d{2}-\d{2}):(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [, offsetRaw, dateKey, lessonIdRaw] = ctx.match!;
  const offset = Number(offsetRaw) as WeekOffset;
  const lessonId = Number(lessonIdRaw);
  const date = parseDateKey(dateKey);
  if (!date) return;

  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: { homework: true },
  });
  if (!lesson) {
    await ctx.editMessageText("Урок не найден.");
    return;
  }

  const text = lesson.homework
    ? `📝 ДЗ:\n${lesson.homework.text}`
    : "📝 ДЗ: нет";
```

---

## Сценарий 2. Добавление ДЗ (`/добавить`)

**Текстом:** навигация та же (неделя → день → урок), но на шаге урока бот
запоминает выбранный урок в **сессии** и просит прислать текст. Следующее
текстовое сообщение пользователя перехватывается, и ДЗ сохраняется через
`saveHomework` (с AI-дедупликацией).

**Шаг 1. Выбор урока запоминает pending-состояние** —
`src/bot/handlers/homework.ts`:

```ts
bot.callbackQuery(/^hwa:l:(-1|0|1):(\d{4}-\d{2}-\d{2}):(\d+)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const [, , dateKey, lessonIdRaw] = ctx.match!;
  const lessonId = Number(lessonIdRaw);
  const date = parseDateKey(dateKey);
  if (!date) return;

  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
  if (!lesson) {
    await ctx.editMessageText("Урок не найден.");
    return;
  }

  ctx.session.pending = {
    lessonId: lesson.id,
    subject: lesson.subject,
    dateKey,
  };

  await ctx.reply(
    `✏️ ${lesson.subject} — ${formatDate(date)}\n\nОтправь текст домашнего задания одним сообщением.`
  );
});
```

Сессия объявлена в `src/bot/bot.ts`:

**Зачем нужен `src/bot/bot.ts` (типы сессии):** grammY-сессия — это
«память диалога» на время общения пользователя с ботом. Здесь объявлено
единственное поле `pending` — урок, который пользователь сейчас наполняет
ДЗ. Как только текст получен, поле сбрасывается.

```ts
export type SessionData = {
  /** Lesson the user is currently typing homework for. */
  pending?: { lessonId: number; subject: string; dateKey: string };
};

export type MyContext = Context & SessionFlavor<SessionData>;
```

**Шаг 2. Текстовое сообщение сохраняет ДЗ.** Обработчик стоит **после**
команд и callback-флоу (порядок регистрации в `bot.ts`), поэтому команды не
перехватываются; если `pending` пуст — сообщение игнорируется:

```ts
// Text message while a lesson is pending -> save homework.
bot.on("message:text", async (ctx) => {
  const pending = ctx.session.pending;
  if (!pending) return;

  ctx.session.pending = undefined;

  const result = await saveHomework({
    lessonId: pending.lessonId,
    text: ctx.message.text,
    createdBy: String(ctx.from?.id ?? ""),
  });

  await ctx.reply(
    `${ACTION_LABEL[result.action]}\n\n📚 ${pending.subject}\n📝 ДЗ:\n${result.text}`
  );
});
```

**Шаг 3. Логика сохранения** — `src/services/homework.service.ts`.

**Зачем нужен `src/services/homework.service.ts`:** это бизнес-правило
«как записывается ДЗ». Handler не решает сам — создавать запись или
обновлять: он вызывает `saveHomework`, а сервис проверяет существующее ДЗ,
спрашивает AI о дедупликации и возвращает вердикт (`created` / `updated` /
`kept` / `duplicate_saved`). Полный разбор — в
[ai-deduplication.md](./ai-deduplication.md), здесь — сама функция:

```ts
export async function saveHomework(params: {
  lessonId: number;
  text: string;
  createdBy?: string;
}): Promise<SaveHomeworkResult> {
  const { lessonId, text, createdBy } = params;
  const trimmed = text.trim();

  const existing = await prisma.homework.findUnique({ where: { lessonId } });

  if (!existing) {
    const created = await prisma.homework.create({
      data: { lessonId, text: trimmed, createdBy },
    });
    return { action: "created", text: created.text, aiUsed: false };
  }

  const comparison = await compareHomework(existing.text, trimmed);

  if (comparison?.same) {
    if (comparison.betterText && comparison.betterText !== existing.text) {
      const updated = await prisma.homework.update({
        where: { lessonId },
        data: { text: comparison.betterText, createdBy },
      });
      return { action: "updated", text: updated.text, aiUsed: true };
    }
    return { action: "kept", text: existing.text, aiUsed: true };
  }

  // Different assignment (or AI unavailable) — replace with the new text
  // so the lesson always shows the freshest homework.
  const updated = await prisma.homework.update({
    where: { lessonId },
    data: { text: trimmed, createdBy },
  });
  return {
    action: comparison ? "updated" : "duplicate_saved",
    text: updated.text,
    aiUsed: Boolean(comparison),
  };
}
```

Пользователь видит результат по `action` — словарь сообщений в
`src/bot/handlers/homework.ts`:

```ts
const ACTION_LABEL = {
  created: "✅ ДЗ записано",
  updated: "✅ ДЗ обновлено (AI улучшил формулировку)",
  kept: "ℹ️ Такое ДЗ уже записано — оставил как есть",
  duplicate_saved: "✅ ДЗ записано",
} as const;
```

---

## Сценарий 3. Просмотр расписания (`/расписание`)

**Текстом:** выбор недели → один запрос диапазона → группировка по дням →
один текстовый ответ со всеми днями и уроками недели.

**Зачем нужен `src/bot/handlers/schedule.ts`:** это handler команды
`/расписание` и её callback-навигации. Он отвечает за текстовое
представление недели: заголовок с диапазоном дат, дни в порядке Пн→Вс,
уроки с ��омерами. Данные не запрашивает сам — берёт из сервиса.

**Подтверждение** — `src/bot/handlers/schedule.ts`:

```ts
bot.callbackQuery(/^sched:w:(-1|0|1)$/, async (ctx) => {
  await ctx.answerCallbackQuery();
  const offset = Number(ctx.match![1]) as WeekOffset;
  const [from, to] = weekRange(offset);
  const lessons = await getLessonsInRange(from, to);

  const header = `📅 ${WEEK_LABELS[offset]}\n${formatDate(from)} – ${formatDate(to)}`;

  if (lessons.length === 0) {
    await ctx.editMessageText(`${header}\n\nРасписание пока не заполнено.`, {
      reply_markup: weekKeyboard("sched"),
    });
    return;
  }

  const byDay = groupByDay(lessons);
  const lines: string[] = [header, ""];

  for (const date of weekDates(offset)) {
    const dayLessons = byDay.get(dayKeyFromDate(date));
    if (!dayLessons || dayLessons.length === 0) continue;

    lines.push(`${DAY_LABELS[dayKeyFromDate(date)]} (${formatDate(date)})`);
    for (const lesson of dayLessons) {
      lines.push(`${lesson.lessonNumber}. ${lesson.subject}`);
    }
    lines.push("");
  }

  await ctx.editMessageText(lines.join("\n").trimEnd(), {
    reply_markup: weekKeyboard("sched"),
  });
});
```

Группировка по дням с сохранением порядка Пн→Вс —
`src/services/schedule.service.ts`:

**Зачем нужен `groupByDay`:** Prisma возвращает плоский список уроков,
отсортированный по дате и номеру. Для вывода расписания и для построения
клавиатуры дней нужен словарь «день → уроки». `groupByDay` делает это
преобразование один раз для обоих потребителей.

```ts
export function groupByDay(
  lessons: LessonWithHomework[]
): Map<DayKey, LessonWithHomework[]> {
  const map = new Map<DayKey, LessonWithHomework[]>();
  for (const lesson of lessons) {
    const key = dayKeyFromDate(lesson.date);
    const list = map.get(key) ?? [];
    list.push(lesson);
    map.set(key, list);
  }
  return map;
}
```

---

## Сценарий 4. Входящее обновление Telegram (webhook)

**Текстом:** Telegram шлёт POST на `/api/telegram/webhook`. Route handler
проверяет, что токен задан (иначе 503), и передаёт запрос в grammY через
`webhookCallback`, который сам валидирует `X-Telegram-Bot-Api-Secret-Token`,
если секрет задан.

**Зачем нужен `src/app/api/telegram/webhook/route.ts`:** это единственная
точка входа для всех событий Telegram. Route handler — тонкая обёртка: он
не разбирает обновления сам, а проверяет конфигурацию и отдаёт запрос
grammY. Отдельный `GET` возвращает 200 — по нему удобно проверять, что
эндпоинт жив, не отправляя фейковое обновление.

**Подтверждение** — `src/app/api/telegram/webhook/route.ts` (файл целиком):

```ts
import { webhookCallback } from "grammy";
import { getBot } from "@/bot/bot";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return new Response("Bot is not configured", { status: 503 });
  }

  // Secret-token check: Telegram sends it with every webhook request
  // (set via `secret_token` in setWebhook). Missing env or header mismatch
  // is rejected before the update is processed at all.
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

export async function GET() {
  return new Response("Telegram webhook endpoint", { status: 200 });
}
```

`dynamic = "force-dynamic"` отключает любые попытки Next.js закэшировать
route — каждое обновление Telegram должно обрабатываться живым кодом.

---

## Сценарий 6. Заполнение расписания (seed)

**Текстом:** расписание не вводится через бота — оно заливается seed-скриптом
`pnpm db:seed`. Скрипт идемпотентный: повторный запуск обновляет предметы
(`upsert`), а не плодит дубли.

**Зачем нужен `prisma/seed.ts`:** он заполняет базу демо-данными: расписание
текущей недели (Пн–Пт, по 3 урока) и примеры ДЗ. Нужен для локальной
разработки и превью — чтобы бот сразу что-то показывал, не дожидаясь
настоящего расписания.

**Подтверждение** — `prisma/seed.ts` (ключевая часть):

```ts
const SCHEDULE: Record<string, string[]> = {
  MONDAY: ["Математика", "Русский язык", "Физика"],
  TUESDAY: ["История", "Английский язык", "Математика"],
  WEDNESDAY: ["Литература", "Химия", "Алгебра"],
  THURSDAY: ["География", "Математика", "Биология"],
  FRIDAY: ["Информатика", "Русский язык", "Обществознание"],
};

async function main() {
  const monday = currentWeekStart();

  for (let i = 0; i < 5; i++) {
    const date = addDays(monday, i);
    const day = dayKeyFromDate(date);

    for (let n = 0; n < SCHEDULE[day].length; n++) {
      const subject = SCHEDULE[day][n];
      const lesson = await prisma.lesson.upsert({
        where: { date_lessonNumber: { date, lessonNumber: n + 1 } },
        update: { subject },
        create: { date, day, lessonNumber: n + 1, subject },
      });
      // ...
    }
  }
}
```

`where: { date_lessonNumber: ... }` — это составной уникальный ключ
`@@unique([date, lessonNumber])` из схемы Prisma, сгенерированный клиентом.
