# Модель данных

Полная схема — `prisma/schema.prisma`. Модели две: `Lesson` и `Homework`.

**Зачем нужен `prisma/schema.prisma`:** это единственный источник правды о
структуре БД. Из него Prisma генерирует типизированного клиента (`prisma
generate`) и миграции (`prisma migrate dev`), поэтому любое изменение таблиц
начинается именно здесь — руками SQL в проекте не пишется.

## Схема (как написано сейчас)

```prisma
model Lesson {
  id           Int       @id @default(autoincrement())
  date         DateTime  @db.Date
  day          String // MONDAY..SUNDAY, derived from date for convenience
  lessonNumber Int
  subject      String
  homework     Homework?

  @@unique([date, lessonNumber])
  @@index([date])
}

model Homework {
  id        Int      @id @default(autoincrement())
  lessonId  Int      @unique
  lesson    Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  text      String
  createdBy String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([lessonId])
}
```

## Разбор ключевых решений

### 1. `date` вместо «дня недели»

Урок привязан к **конкретной календарной дате** (`@db.Date`), а не к абстрактному
«понедельнику». Поле `day` (`MONDAY..SUNDAY`) хранится рядом только для
удобства и всегда выводится из даты — при создании в seed:

**Зачем нужен `prisma/seed.ts`:** расписание не вводится через бота — seed
заливает демо-расписание текущей недели (Пн–Пт, по 3 урока) и примеры ДЗ
одной командой `pnpm db:seed`. Он идемпотентный: повторный запуск обновляет
предметы через `upsert`, а не плодит дубли.

```ts
// prisma/seed.ts
const date = addDays(monday, i);
const day = dayKeyFromDate(date);
```

и при чтении — из самой даты, без обращения к полю:

**Зачем нужен `src/lib/weeks.ts` (функция `dayKeyFromDate`):** она переводит
любую дату в ключ дня недели (`MONDAY`..`SUNDAY`) по UTC. Формула
`(getUTCDay() + 6) % 7` сдвигает неделю так, чтобы воскресенье (0 в JS)
стало последним днём, а понедельник — первым.

```ts
// src/lib/weeks.ts
export function dayKeyFromDate(date: Date): DayKey {
  return DAY_KEYS[(date.getUTCDay() + 6) % 7];
}
```

Благодаря этому окно «прошлая / текущая / следующая неделя» — это просто
фильтр по диапазону дат, и оно само сдвигается с течением времени.

### 2. `@@unique([date, lessonNumber])`

Урок уникален парой «дата + номер урока». Это даёт:

- защиту от дублей при повторном seed (используется `upsert` по этому ключу);
- естественный порядок вывода: `orderBy: [{ date: "asc" }, { lessonNumber: "asc" }]`.

### 3. ДЗ — строго 1:1 к уроку

`lessonId @unique` в `Homework` означает: у урока **максимум одна** запись ДЗ.
«Несколько ДЗ на один урок» в текущей модели невозможно — вместо списка
хранится один текст, который обновляется по правилам дедупликации
(см. [ai-deduplication.md](./ai-deduplication.md)).

### 4. История никогда не удаляется

Ни один путь в коде не вызывает `delete`:

```bash
$ grep -rn "\.delete\|deleteMany" src/ prisma/ --include="*.ts"
# (пусто — удалений нет)
```

Единственное каскадное удаление — `onDelete: Cascade` с урока на ДЗ, и оно
срабатывает только если удалить сам урок вручную из БД. Бот такой операции не
имеет. Прошедшие недели остаются в базе, бот лишь показывает окно трёх недель.

### 5. Аудит ДЗ

`createdBy` хранит Telegram user id (или `"seed"`), `createdAt` / `updatedAt`
ведутся автоматически (`@default(now())` / `@updatedAt`):

```ts
// src/bot/handlers/homework.ts
const result = await saveHomework({
  lessonId: pending.lessonId,
  text: ctx.message.text,
  createdBy: String(ctx.from?.id ?? ""),
});
```

## Связь с сервисным слоем

Чтение уроков инкапсулировано в `src/services/schedule.service.ts`:

**Зачем нужен `src/services/schedule.service.ts`:** это единственное место,
где бот читает уроки из БД. Handlers не пишут Prisma-запросы сами — они
вызывают `getLessonsInRange` (диапазон дат) и `groupByDay` (группировка
Пн→Вс). Так запрос к БД, порядок сортировки и расширение границы до конца
воскресенья описаны один раз и не дублируются в трёх обработчиках.

```ts
export async function getLessonsInRange(
  from: Date,
  to: Date
): Promise<LessonWithHomework[]> {
  const toEnd = new Date(to);
  toEnd.setUTCHours(23, 59, 59, 999);

  return prisma.lesson.findMany({
    where: { date: { gte: from, lte: toEnd } },
    include: { homework: { select: { text: true } } },
    orderBy: [{ date: "asc" }, { lessonNumber: "asc" }],
  });
}
```

Обратите внимание на `toEnd.setUTCHours(23, 59, 59, 999)`: `to` — это
полночь воскресенья, и без расширения до конца дня воскресные уроки
выпадали бы из выборки.
