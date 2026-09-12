# AI-дедупликация домашнего задания

## Зачем

ДЗ на один урок могут прислать несколько человек. Наивное поведение —
перезаписывать текст каждым новым сообщением. Здесь добавлен умный слой:
перед перезаписью AI сравнивает существующий и новый текст и решает:

- **одно и то же задание** → оставить как есть (`kept`) или заменить более
  точной формулировкой (`updated`);
- **разные задания** (`same=false`) → новый текст сохраняется как `PENDING`
  и уходит админам на подтверждение;
- **AI недоступен** → вердикт неизвестен, поэтому новый текст тоже
  сохраняется как `PENDING`, а админы получают уведомление с пометкой
  «AI-проверка недоступна». Непроверенный текст никогда не публикуется
  автоматически — бот продолжает работать, но решение принимает человек.

## Контракт с моделью

Модель обязана ответить строгим JSON, что проверяется и схемой zod, и
параметром `response_format` у OpenRouter.

**Зачем нужен `src/lib/ai.ts`:** единственное место, где проект общается с
внешним AI. Он изолирует всё, что может сломаться (ключ, сеть, таймаут,
неожиданный формат ответа), за одной функцией `compareHomework`, которая
возвращает `null` при любой неудаче — вызывающий код не знает про HTTP,
промпты и zod, только про `{ same, betterText } | null`.

**`src/lib/ai.ts`:**

```ts
const comparisonResultSchema = z.object({
  same: z.boolean(),
  betterText: z.string().optional(),
});

export type ComparisonResult = z.infer<typeof comparisonResultSchema>;

const SYSTEM_PROMPT = `Ты помощник, который сравнивает формулировки домашнего задания школьников.
Тебе дают два текста ДЗ по одному и тому же уроку. Определи, это одно и то же задание или разные.
Если это одно и то же задание, но новая формулировка точнее или полнее — верни улучшенный текст.
Если задания разные — same=false и betterText не нужен.
Ответь строго JSON: {"same": boolean, "betterText": string | undefined}`;
```

## Вызов OpenRouter

Обычный `fetch` к `https://openrouter.ai/api/v1/chat/completions`, модель
`openai/gpt-4o-mini`, `temperature: 0` (детерминированность), таймаут 15
секунд через `AbortController`:

```ts
export async function compareHomework(
  existing: string,
  incoming: string
): Promise<ComparisonResult | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: `Существующее ДЗ:\n${existing}\n\nНовое ДЗ:\n${incoming}`,
            },
          ],
        }),
      }
    );
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = comparisonResultSchema.safeParse(JSON.parse(content));
    if (!parsed.success) return null;

    // A "same" result only makes sense with a replacement text when one is given.
    if (parsed.data.same && !parsed.data.betterText) {
      return { same: true };
    }
    return parsed.data;
  } catch {
    return null;
  }
}
```

Каждая точка отказа возвращает `null`, а не бросает исключение:

| Ситуация | Результат |
|---|---|
| `OPENROUTER_API_KEY` не задан | `null` |
| Таймаут 15 с / сетевая ошибка | `null` (catch) |
| HTTP != 2xx | `null` |
| Ответ не JSON / не прошёл zod | `null` |

## Как `null` превращается в поведение бота

**`src/services/homework.service.ts`** — таблица решений:

**Зачем нужен `src/services/homework.service.ts` (функция `saveHomework`):**
она превращает вердикт AI в действие над БД. Именно здесь решается:
создать запись, обновить текст или оставить существующий. Handler получает
готовый `action` и не знает ни про AI, ни про Prisma-запросы.

```ts
const comparison = await compareHomework(existing.text, trimmed);

if (comparison?.same) {
  if (comparison.betterText && comparison.betterText !== existing.text) {
    // same + есть улучшенная формулировка -> заменить, статус APPROVED
    return { action: "updated", text: updated.text, aiUsed: true, status: "APPROVED" };
  }
  // same без улучшения -> оставить как есть
  return { action: "kept", text: existing.text, aiUsed: true, status: existing.status };
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
  text: updated.text,
  aiUsed: Boolean(comparison),
  status: updated.status,
};
```

Итоговая матрица:

| Существующее ДЗ | AI | Вердикт | `action` | Статус в БД | Уведомление |
|---|---|---|---|---|---|
| нет | — | — | `created` | `APPROVED` | — |
| есть | `same=true`, есть `betterText` | то же задание, формулировка лучше | `updated` | `APPROVED` | — |
| есть | `same=true`, без `betterText` | то же задание | `kept` | без изменений | — |
| есть | `same=false` | разные задания | `updated` | `PENDING` | админам: «отличается от прошлой недели» |
| есть | `null` (недоступен) | неизвестно | `pending_ai_down` | `PENDING` | админам: «AI-проверка недоступна» |

Ветка `PENDING` в `src/bot/handlers/homework.ts` отвечает автору
(`HOMEWORK_PENDING_SAVED_TEXT` или `HOMEWORK_PENDING_AI_DOWN_TEXT`) и
рассылает админам карточку с кнопками «Подтвердить»/«Отклонить» — причина
модерации передаётся типом `AdminReviewReason` (`same_false` | `ai_down`).

Пользователь видит результат через словарь сообщений
(`src/bot/messages.ts`):

**Зачем нужен `HOMEWORK_SAVED_TEXTS`:** словарь переводит служебный вердикт
(`created` / `updated` / `kept` / `duplicate_saved`) в человеческое
сообщение. Тексты ответов собраны в одном месте — их легко поменять, не
трогая логику сохранения.

```ts
export const HOMEWORK_SAVED_TEXTS = {
  created: "✅ ДЗ записано",
  updated: "✅ ДЗ обновлено (AI улучшил формулировку)",
  kept: "ℹ️ Такое ДЗ уже записано — оставил как есть",
  duplicate_saved: "✅ ДЗ записано",
  // Never shown: the PENDING branch replies with HOMEWORK_PENDING_*_TEXT
  // before this dictionary is reached; the key exists to keep types total.
  pending_ai_down: "⏳ ДЗ отправлено на проверку",
} as const;
```

## Стоимость и частота вызовов

AI вызывается **только** когда ДЗ на урок уже существует (`existing` найден).
Первое ДЗ на урок сохраняется без обращения к OpenRouter — самый частый
случай бесплатен.
