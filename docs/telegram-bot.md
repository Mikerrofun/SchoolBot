# Telegram-бот (grammY)

## Инициализация и сессия

Бот создаётся лениво и кэшируется; сессия хранит единственное поле — урок,
который пользователь сейчас «наполняет» ДЗ.

**Зачем нужен `src/bot/bot.ts`:** фабрика бота. Собирает grammY-инстанс
(сессия + регистрация обработчиков + перехватчик ошибок) и кэширует его,
чтобы webhook route вызывал `getBot()` без пересоздания. Здесь же объявлены
типы сессии и контекста, которые импортируют все handlers.

**`src/bot/bot.ts`:**

```ts
export type SessionData = {
  /** Lesson the user is currently typing homework for. */
  pending?: { lessonId: number; subject: string; dateKey: string };
};

export type MyContext = Context & SessionFlavor<SessionData>;
```

```ts
bot.use(session({ initial: (): SessionData => ({}) }));

// Commands and callback flows first, free-text homework input last.
registerStartHandler(bot);
registerScheduleHandlers(bot);
registerHomeworkHandlers(bot);
```

Порядок регистрации критичен: обработчик свободного текста
`bot.on("message:text")` зарегистрирован последним, поэтому команды
(`/дз`, `/добавить`) успевают перехватить сообщение раньше. Внутри
`message:text` стоит защита `if (!pending) return;` — посторонние сообщения
без выбранного урока игнорируются.

## Схема callback-данных

Все inline-кнопки несут строку вида `поток:уровень:параметры`. Это позволяет
одному обработчику-регулярке обслуживать весь уровень навигации.

**Зачем нужен `src/bot/keyboards.ts`:** все inline-клавиатуры и схема
callback-данных в одном файле. Handlers не собирают кнопки вручную — они
вызывают `weekKeyboard` / `dayKeyboard` / `lessonKeyboard` / `mainMenuKeyboard`.
Единый формат callback (`поток:уровень:параметры`) живёт здесь же, поэтому
handler-регулярки и кнопки не могут разойтись.

**`src/bot/keyboards.ts`:**

```ts
export type Flow = "sched" | "hwv" | "hwa";
```

| Формат callback | Смысл | Пример |
|---|---|---|
| `<flow>:pick` | вернуться к выбору недели | `hwv:pick` |
| `<flow>:w:<offset>` | выбрана неделя (-1/0/1) | `sched:w:1` |
| `<flow>:d:<offset>:<YYYY-MM-DD>` | выбран день | `hwv:d:0:2026-09-07` |
| `<flow>:l:<offset>:<date>:<lessonId>` | выбран урок | `hwa:l:0:2026-09-07:42` |
| `menu` | главное меню | `menu` |

Потоки: `sched` — расписание, `hwv` — просмотр ДЗ, `hwa` — добавление ДЗ.

## Клавиатуры

**Главное меню** (`src/bot/keyboards.ts`):

```ts
export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text("📅 Расписание", "sched:pick")
    .row()
    .text("📝 Домашнее задание", "hwv:pick")
    .row()
    .text("✏️ Добавить ДЗ", "hwa:pick");
}
```

**Выбор недели** — ровно три кнопки, ровно как в `WeekOffset`:

```ts
export function weekKeyboard(flow: Flow): InlineKeyboard {
  const kb = new InlineKeyboard();
  ([-1, 0, 1] as WeekOffset[]).forEach((offset, i) => {
    if (i > 0) kb.row();
    kb.text(WEEK_LABELS[offset], `${flow}:w:${offset}`);
  });
  kb.row().text("« Меню", "menu");
  return kb;
}
```

**Выбор дня** — только дни, где есть уроки (список формирует handler):

```ts
export function dayKeyboard(
  flow: Flow,
  offset: WeekOffset,
  days: { dateKey: string; day: keyof typeof DAY_LABELS }[]
): InlineKeyboard {
  const kb = new InlineKeyboard();
  days.forEach(({ dateKey, day }, i) => {
    if (i > 0) kb.row();
    kb.text(DAY_LABELS[day], `${flow}:d:${offset}:${dateKey}`);
  });
  kb.row().text("« Недели", `${flow}:pick`).text("Меню", "menu");
  return kb;
}
```

**Выбор урока** — подпись «номер. предмет», в callback идёт id урока:

```ts
export function lessonKeyboard(
  flow: Flow,
  offset: WeekOffset,
  dateKey: string,
  lessons: { id: number; lessonNumber: number; subject: string }[]
): InlineKeyboard {
  const kb = new InlineKeyboard();
  lessons.forEach((lesson) => {
    kb.text(
      `${lesson.lessonNumber}. ${lesson.subject}`,
      `${flow}:l:${offset}:${dateKey}:${lesson.id}`
    ).row();
  });
  kb.text("« Дни", `${flow}:w:${offset}`).text("Меню", "menu");
  return kb;
}
```

## Навигация «назад»

Каждый уровень клавиатуры содержит кнопку возврата на уровень выше, и
handler'ы переиспользуют один и тот же callback: например, кнопка «« Дни»
шлёт `hwv:w:0` — тот же callback, что и выбор недели. Поэтому «назад» не
требует отдельного кода — работает тот же обработчик.

```ts
// keyboards.ts — кнопка возврата к дням из списка уроков
kb.text("« Дни", `${flow}:w:${offset}`).text("Меню", "menu");
```

## Команды

| Команда | Файл | Действие |
|---|---|---|
| `/start`, `/menu` | `handlers/start.ts` | главное меню |
| `/расписание` | `handlers/schedule.ts` | выбор недели → текст расписания |
| `/дз` | `handlers/homework.ts` | выбор недели → день → урок → текст ДЗ |
| `/добавить` | `handlers/homework.ts` | выбор урока → ввод текста → сохранение |

**Зачем нужен `handlers/start.ts`:** точка входа для пользователя — команды
`/start` и `/menu` плюс callback-кнопка «Меню». Все три пути показывают один
и тот же текст и одно и то же главное меню, поэтому логика вынесена в
функцию `showMainMenu` и переиспользуется.

**`handlers/start.ts` (целиком):**

```ts
const MENU_TEXT = `👋 Привет! Это бот класса.

Здесь можно посмотреть расписание и домашнее задание на прошлую, текущую и следующую неделю, а также записать новое ДЗ.

Выбери действие:`;

export function showMainMenu(ctx: MyContext) {
  return ctx.reply(MENU_TEXT, { reply_markup: mainMenuKeyboard() });
}

export function registerStartHandler(bot: Bot<MyContext>) {
  bot.command("start", (ctx) => showMainMenu(ctx));
  bot.command("menu", (ctx) => showMainMenu(ctx));

  bot.callbackQuery("menu", async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(MENU_TEXT, { reply_markup: mainMenuKeyboard() });
  });
}
```

## Обработка ошибок

Единый перехватчик в `bot.ts` логирует ошибку и не роняет процесс — webhook
всегда отвечает Telegram'у:

```ts
bot.catch((err) => {
  console.error("[v0] bot error:", err.error);
});
```
