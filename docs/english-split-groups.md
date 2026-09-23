---

**Дата:** 23.09.2026
**Теги:** #features #homework #schedule #prisma

---

## 1. Зачем

У английского в классе две группы — Веренич и не Веренич, и ДЗ у них разное.
Раньше модель не позволяла это выразить: `Lesson` был уникален парой
`(date, lessonNumber)`, а `Homework` жёстко 1:1 к уроку (`lessonId @unique`).
Физически невозможно было завести два ДЗ на один слот расписания — второй
upsert падал по unique violation. Информатику не трогали: группа там одна,
ДЗ пишут редко.

## 2. Где/что уже было

Задача была не писать новое, а использовать существующее: ленивое создание
уроков из `SCHEDULE_TEMPLATE` (единый источник правды для seed и рантайма),
upsert ДЗ по `lessonId`, рендер дня и пикер уроков, которые просто перебирают
список уроков без какой-либо дедупликации по номеру.

```ts
// src/services/schedule.service.ts
const lesson = await prisma.lesson.upsert({
  where: { ... },
  create: { date, day, lessonNumber: n + 1, subject: subjects[n] },
});
```

Каждый урок уже имел свой `id`, и вся логика ДЗ (запись, модерация
`pendingText`/`status`, AI-сравнение) работала через `lessonId`, а не через
номер урока. Значит, если сделать две строки `Lesson` в одном слоте —
остальная логика подхватит их сама.

## 3. Реализация

Схема: уникальный ключ урока расширен предметом — теперь два урока с одинаковой
датой и номером разрешены, если у них разные названия.

```prisma
// prisma/schema.prisma
// subject is part of the key so split subjects (e.g. two English groups
// — Веренич / не Веренич) can occupy the same slot on the same date.
@@unique([date, lessonNumber, subject])
```

Upsert-ключи обновлены в двух местах, где создаются уроки:

```ts
// src/services/schedule.service.ts
where: {
  date_lessonNumber_subject: { date, lessonNumber: n + 1, subject: subjects[n] },
},
```

```ts
// prisma/seed.ts
where: {
  date_lessonNumber_subject: { date, lessonNumber: n + 1, subject: subjects[n] },
},
```

Шаблон: английский разбит на два предмета в одном слоте (пн и чт). Информатика
осталась одной строкой.

```ts
// src/lib/schedule-template.ts
// Split subjects: two groups in the same slot, each with its own homework.
"Английский язык (Веренич)",
"Английский язык (не Веренич)",
```

Миграция с backfill — существующие недели не теряют ДЗ:

```sql
-- prisma/migrations/20260923000000_split_subject_groups/migration.sql
ALTER TABLE "Lesson" DROP CONSTRAINT "Lesson_date_lessonNumber_key";
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_date_lessonNumber_subject_key" UNIQUE ("date", "lessonNumber", "subject");

UPDATE "Lesson" SET "subject" = 'Английский язык (Веренич)' WHERE "subject" = 'Английский язык';

INSERT INTO "Lesson" ("date", "day", "lessonNumber", "subject")
SELECT "date", "day", "lessonNumber", 'Английский язык (не Веренич)'
FROM "Lesson" WHERE "subject" = 'Английский язык (Веренич)';

INSERT INTO "Homework" ("lessonId", "text", "pendingText", "pendingCreatedBy", "status", "createdBy")
SELECT twin."id", h."text", h."pendingText", h."pendingCreatedBy", h."status", h."createdBy"
FROM "Lesson" orig
JOIN "Homework" h ON h."lessonId" = orig."id"
JOIN "Lesson" twin
  ON twin."date" = orig."date"
 AND twin."lessonNumber" = orig."lessonNumber"
 AND twin."subject" = 'Английский язык (не Веренич)'
WHERE orig."subject" = 'Английский язык (Веренич)';
```

Не тронуто: `homework.service.ts` (запись, модерация, AI-сравнение),
`messages.ts` (рендер дня и недели), `navigation.ts` (пикер уроков),
клавиатуры, типы. Новый код приложения не писался — только схема, два
upsert-ключа, шаблон и SQL миграции.

## 4. UI (если применимо)

UI-код не менялся — новые кнопки и строки появляются сами из данных:

- пикер уроков при записи ДЗ: две отдельные кнопки
  «6. Английский язык (Веренич)» и «6. Английский язык (не Веренич)»;
- сообщение дня: два блока ДЗ с пометками групп;
- вид недели: две строки с номером 6 (косметика, номер у обоих честный).

`shortSubject` пропускает неизвестные названия как есть
(`SUBJECT_SHORT_NAMES[subject] ?? subject`), так что длинные имена групп
отображаются полностью. При желании позже можно добавить сокращения в словарь.

## 5. Поток данных

```
ensureWeekScheduleExists / seed
  ↓ SCHEDULE_TEMPLATE → upsert по (date, lessonNumber, subject)
  ↓ два урока «Английский» в слоте 6, у каждого свой id
Запись ДЗ
  ↓ пикер уроков дня → выбор конкретной группы → upsert Homework по lessonId
Выдача ДЗ
  ↓ getDayHomework: findMany({ where: { date }, orderBy: lessonNumber })
  ↓ оба урока с их Homework → рендер: блок на каждый урок с пометкой группы
```

## 6. Почему так, а не иначе

1. **Два урока вместо поля `group` на Lesson.** Нулевые изменения в логике
   ДЗ: каждая группа — обычный независимый урок, вся существующая цепочка
   (запись, модерация, AI) работает как есть. Поле `group` дало бы то же
   самое, но потребовало бы правок в пикере и рендере.
2. **Не `text2` на Homework.** У ДЗ есть не только `text`, но и `pendingText`,
   `pendingCreatedBy`, `status` — их пришлось бы дублировать, а в сервисе
   появился бы хардкод «если английский — пишем в text2». Самый хрупкий вариант.
3. **Backfill в SQL миграции, а не отдельным скриптом.** Применяется
   атомарно вместе со сменой констрейнта одним `prisma migrate deploy`,
   ничего запускать вручную помимо миграций не нужно.
4. **Копирование ДЗ на близнецов в миграции.** Ученики не теряют уже
   введённое ДЗ (включая ожидающее модерации) после деплоя.

## Преимущества

- ✅ Два ДЗ на английский работают без единой правки в логике ДЗ
- ✅ Модерация и AI-сравнение не затронуты — работают по lessonId каждой группы
- ✅ Существующие недели мигрируют с сохранением введённого ДЗ
- ✅ Информатика не разделена — одна группа, лишних кнопок нет
- ✅ Масштабируется: следующий сплит-предмет — одна строка в шаблоне
