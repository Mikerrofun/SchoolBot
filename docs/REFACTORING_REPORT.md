---

**Дата:** 17.09.2026
**Теги:** #features #refactoring #telegram-bot #ai

---

## 1. Зачем

Бот SchoolBot (grammY + Prisma + Next.js route handler) накопил проблемы, которые мешали и пользователям, и разработке. Ошибки обработки падали молча или текстами, размазанными по хендлерам. Все типы лежали одним файлом `src/types.ts`. Админ-уведомление о перезаписи ДЗ ссылалось на поле `oldText`, которого у нового ДЗ не существует. Навигация была на inline-кнопках: кнопки возврата терялись, «⬅️ Недели» местами просто ничего не делал, на каждый шаг уходило новое сообщение. Предметы писались целиком («Физическая культура и здоровье»). Текст ДЗ сохранялся без проверки на тему. Авторы в уведомлениях были анонимными telegram-id. Расписание, одинаковое каждую неделю, заставляло проходить два лишних пикера (неделя → день).

## 2. Где/что уже было

Переиспользовано почти всё ядро, нового кода минимум:

- grammY-сессия с состоянием флоу (`flow`, `weekOffset`, `pending`) — навигация построена поверх неё, сама сессия не менялась;
- `saveHomework` в `homework.service.ts` с AI-сравнением через OpenRouter (`compareHomework`) — цензура встроена в тот же процесс, а не рядом с ним;
- хелперы дат `lib/weeks.ts` (`getWeekWindow`, `weekDates`, `dayKeyFromDate`) — пикеры недель/дней работают на них;
- пайплайн админ-уведомлений и инлайн-модерация (`hw:approve:` / `hw:reject:`) — не тронуты;
- константы текстов кнопок в `messages.ts` — роутер навигации матчит именно их, поэтому клавиатуры и роутер не могут разойтись.

Задача была не писать новое, а переупаковать существующее: например, из `compareHomework` вынесен общий `callOpenRouterJson`, и цензура получилась 15 строк поверх него.

## 3. Реализация

### Реестр ошибок

```ts
// src/lib/errors.ts
export const ERROR_REGISTRY: Record<ErrorCode, string> = {
  UNKNOWN: "Произошла ошибка, попробуйте позже.",
  BOT_NOT_CONFIGURED: "Бот не настроен: отсутствует токен.",
  UNAUTHORIZED: "Неавторизованный запрос.",
  AI_UNAVAILABLE: "AI-проверка временно недоступна, попробуйте позже.",
  CONTENT_REJECTED: "❌ Текст не похож на запись по делу ...",
};

export class BotError extends Error {
  readonly code: ErrorCode;
  constructor(code: ErrorCode, message: string = ERROR_REGISTRY[code]) { ... }
}
```

Вебхук сериализует любую ошибку в структурированный JSON:

```ts
// src/app/api/telegram/webhook/route.ts
catch (error) {
  // Always HTTP 200: Telegram must not retry and duplicate the update.
  const botError = toBotError(error);
  return errorResponse(botError.code); // { ok:false, error:{ code, message } }
}
```

### Типы

`src/types.ts` разбит на `src/types/{schedule,homework,additional,user,errors,bot,ai}.ts` + барель `index.ts` — импорты `@/types` не изменились. Ключевое: результат сохранения ДЗ стал дискриминированным объединением — у нового ДЗ поля `oldText` нет вообще, у перезаписи оно строго обязательно:

```ts
// src/types/homework.ts
export type SaveHomeworkCreated = {
  action: "created";
  text: string;
  aiUsed: false;
  status: "APPROVED";
}; // поля oldText нет вообще

export type SaveHomeworkReplaced = {
  action: Exclude<HomeworkSaveAction, "created">;
  text: string;
  oldText: string; // строго обязателен
  aiUsed: boolean;
  status: HomeworkStatus;
};

export type SaveHomeworkResult = SaveHomeworkCreated | SaveHomeworkReplaced;
```

### Reply-навигация

Меню, недели, дни и уроки — reply-клавиатуры под полем ввода. Один роутер матчит текст сообщения с константами кнопок:

```ts
// src/bot/handlers/navigation.ts
if (text === BTN_MENU) return showMainMenu(ctx);
if (text === BTN_SCHEDULE) return showSchedule(ctx);
if (text === BTN_WEEKS) return handleWeeksButton(ctx);   // «⬅️ Недели»
if (text === BTN_DAYS) return handleDaysButton(ctx);     // «⬅️ Дни»

const choice = ctx.session.lessonChoices?.find((c) => c.label === text);
if (choice) return handleLessonChoice(ctx, choice);
```

Любое нажатие навигации сначала сбрасывает `pending` — ввод текста нельзя «потерять» в чужом флоу. Соответствие «кнопка → урок» живёт в сессии (`lessonChoices`), поэтому нажатие другого урока переключает цель ввода без потери шага.

### Сокращение предметов

```ts
// src/lib/subjects.ts
const SUBJECT_SHORT_NAMES: Record<string, string> = {
  "Физическая культура и здоровье": "Физра",
};
export function shortSubject(subject: string): string {
  return SUBJECT_SHORT_NAMES[subject] ?? subject;
}
```

Применяется только на выводе (кнопки, сообщения, уведомления); в БД и шаблоне расписания — официальные названия.

### Цензура текста

```ts
// src/lib/ai.ts
export function checkTextOnTopic(text: string): Promise<boolean | null> {
  return callOpenRouterJson(ON_TOPIC_SYSTEM_PROMPT, `Текст записи:\n${text}`,
    onTopicVerdictSchema
  ).then((verdict) => verdict?.onTopic ?? null);
}
```

Вызывается **до** сохранения в обоих флоу (ДЗ и «Дополнительно»). `false` — запись не создаётся, пользователь получает `ERROR_REGISTRY.CONTENT_REJECTED`. `null` (AI недоступен) — сохранение продолжается: ДЗ уходит в pending-модерацию, «Дополнительно» сохраняется как есть.

### Хранилище пользователей

```prisma
// prisma/schema.prisma
model User {
  id           Int      @id @default(autoincrement())
  telegramId   String   @unique
  username     String?
  firstName    String?
  lastName     String?
  registeredAt DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

```ts
// src/services/user.service.ts
export async function upsertUserFromTelegram(profile: TelegramUserProfile) {
  return prisma.user.upsert({
    where: { telegramId },
    update: { username, firstName, lastName },
    create: { telegramId, username, firstName, lastName },
  });
}
```

Upsert только на `/start`, без проверок на каждое сообщение. В админ-уведомлении автор теперь «Иван @ivanov (id: 123)»; при отсутствии записи — просто id.

### Правки после тестирования

1. Расписание — одним сообщением, без пикеров (флоу `sched` удалён из `Flow`, роутера и клавиатур):

```ts
// src/bot/messages.ts
export function scheduleWeekMessage(days: WeekDayLessons[]): string {
  const lines: string[] = [SCHEDULE_TITLE, ""];
  for (const { date, lessons } of days) {
    lines.push(`${dayTitle(date)} (${formatDate(date)})`);
    for (const lesson of lessons)
      lines.push(`${lesson.lessonNumber}. ${shortSubject(lesson.subject)}`);
  }
  ...
}
```

2. Починен возврат: тексты `BTN_WEEKS` / `BTN_DAYS` раньше вообще не обрабатывались роутером — нажатие молча проваливалось. Теперь «⬅️ Недели» открывает пикер недель текущего флоу, «⬅️ Дни» — пикер дней текущей недели.
3. Уроки перенесены из inline в reply-клавиатуру (`lessonsReplyKeyboard`), инлайн-пикер и его колбэки удалены.
4. «✏️ Заполнить» → «✏️ Дополнительно», заголовок — «Дополнительно — добавление».

Не тронуто: инлайн-модерация админов, логика `approveHomework` / `rejectHomework`, шаблон расписания и сид, запросы сервисов.

## 4. UI

Все пользовательские клавиатуры — reply, перерисовываются на каждом шаге:

```ts
// src/bot/keyboards.ts
export function lessonsReplyKeyboard(choices: LessonChoice[]): Keyboard {
  const kb = new Keyboard();
  for (const choice of choices) kb.text(choice.label).row(); // «1. Физра»
  return kb.text(BTN_DAYS).text(BTN_MENU).resized();
}
```

Инлайн остался только там, где он нужен по смыслу — кнопки «Одобрить/Отклонить» в админ-уведомлении (`adminReviewKeyboard`). Сообщений на флоу стало меньше: выбор урока и ввод текста не создают отдельных «служебных» сообщений с кнопками.

## 5. Поток данных

Обновление от Telegram:

```
POST /api/telegram/webhook
↓ проверка secret token (x-telegram-bot-api-secret-token)
↓ bot.handleUpdate(update)
↓ registerNavigationHandlers: message:text → матч текста с константой кнопки
↓ handleWeek / handleDay / handleLessonChoice
↓ services: getWeekLessons / getDayHomework / getLessonsInRange / upsertAdditional
↓ Prisma
↓ ctx.reply(текст, { reply_markup: reply-клавиатура следующего шага })
```

Сохранение ДЗ с цензурой и модерацией:

```
Ученик ввёл текст (pending.type === "lesson")
↓ checkTextOnTopic(text)
↓ false → ctx.reply(ERROR_REGISTRY.CONTENT_REJECTED) — запись не создаётся
↓ true / null → saveHomework({ lessonId, text, createdBy })
↓ ДЗ нет → create → APPROVED → админам «новое ДЗ» (без oldText)
↓ ДЗ есть → compareHomework(existing, new)
↓ same + betterText → update text → APPROVED → уведомление «Прошлое ДЗ / Новое ДЗ»
↓ same=false или AI недоступен → pendingText, статус PENDING
↓ инлайн «Одобрить/Отклонить» админам
↓ approve → pendingText становится text; reject → pendingText очищен, старый текст остался
```

## 6. Почему так, а не иначе

1. Reply вместо inline для навигации — клавиатура всегда видна под полем ввода, не требует `editMessageText` (reply-клавиатуру нельзя прикрепить к редактированию) и не плодит сообщения с кнопками.
2. Расписание одной неделей — шаблон одинаков каждую неделю, пикеры недели/дня не несут информации; флоу `sched` удалён целиком, а не заглушен.
3. Дискриминированное объединение вместо `oldText?: string | null` — компилятор заставляет обработать случай «старого текста нет», баг с `undefined` в уведомлении становится невозможным по типам.
4. Цензура до сохранения, а не после — отклонённый текст никогда не попадает в БД и не уходит админам на модерацию.
5. `boolean | null` вместо исключения при недоступности AI — проверка не должна блокировать сохранение; fallback предсказуем: ДЗ → pending-модерация, «Дополнительно» → сохранить.
6. Миграция `User` написана вручную (SQL-файл), а не `prisma migrate dev` — в песочнице нет `DATABASE_URL`; на деплое её применит уже настроенный `prisma migrate deploy`.

## Преимущества

- ✅ Все ошибки — с стабильными кодами и одним текстом из реестра; вебхук всегда отвечает структурированным JSON.
- ✅ `oldText` гарантирован типами: у нового ДЗ его нет, у перезаписи — обязателен.
- ✅ Навигация всегда под рукой (reply), возврат «⬅️ Недели»/«⬅️ Дни» работает из любой точки флоу.
- ✅ Роутер матчит константы из `messages.ts` — клавиатуры и обработчики не могут разойтись.
- ✅ Спам и нецелевой текст отсекаются до записи в БД; недоступность AI не ломает сохранение.
- ✅ Авторы в уведомлениях читаемы (имя + username), хранилище обновляется одним upsert на `/start`.
- ✅ Расписание — одно сообщение вместо трёх шагов; «Физра» вместо «Физическая культура и здоровье».
- ✅ Типы разбиты по доменам, импорты не изменились — остальной код не переписывался.
