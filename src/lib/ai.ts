import { z } from "zod";
import { BotError } from "@/lib/errors";
import type { ComparisonResult } from "@/types";

// compareHomework is optional: if OpenRouter is unavailable it returns null
// ("verdict unknown") and the submission goes to pending moderation.
// Censorship (checkTextOnTopic) is fail-closed: it never returns an unknown
// verdict — it throws AI_UNAVAILABLE, so nothing is ever saved unchecked.

const comparisonResultSchema = z.object({
  same: z.boolean(),
  betterText: z.string().optional(),
});

const onTopicVerdictSchema = z.object({
  onTopic: z.boolean(),
});

const COMPARE_SYSTEM_PROMPT = `Ты помощник, который сравнивает формулировки домашнего задания школьников.
Тебе дают два текста ДЗ по одному и тому же уроку. Определи, это одно и то же задание или разные.
Если это одно и то же задание, но новая формулировка точнее или полнее — верни улучшенный текст.
Если задания разные — same=false и betterText не нужен.

ВАЖНО: Ответь ТОЛЬКО чистым JSON без markdown, без форматирования, без пояснений:
{"same": boolean, "betterText": string | undefined}`;

const ON_TOPIC_SYSTEM_PROMPT = `Ты фильтр записей школьного бота. Ученик хочет сохранить текст как домашнее задание или заметку.
Определи, похож ли текст на осмысленную запись по делу: домашнее задание, напоминание о задании, примечание к уроку.
Мусор — спам, реклама, мат, оскорбления, бессмысленный набор символов, случайные буквы или цифры.

ВАЖНО: Ответь ТОЛЬКО чистым JSON без markdown, без форматирования, без пояснений:
{"onTopic": boolean}`;

/** One JSON-structured OpenRouter chat call; null on any failure. */
async function callOpenRouterJson<T>(
  systemPrompt: string,
  userContent: string,
  schema: z.ZodType<T>,
  timeoutMs: number = 20_000 // По умолчанию 20 секунд
): Promise<T | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("❌ [AI] OPENROUTER_API_KEY не найден в .env");
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    console.warn(`⏰ [AI] Timeout ${timeoutMs}ms истёк, прерываем запрос`);
    controller.abort();
  }, timeoutMs);

  try {
    console.log("🤖 [AI] Отправка запроса к OpenRouter...");
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
          model: "openrouter/auto",
          temperature: 0,
          response_format: { type: "json_object" },
          route: "fallback",
          models: [
            "nvidia/nemotron-3-ultra-550b-a55b:free",
            "deepseek/deepseek-v4-flash-0731:free",
            "qwen/qwen3.8-27b:free"
          ],
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      }
    );
    
    console.log("📡 [AI] Статус ответа:", response.status, response.statusText);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ [AI] Ошибка от OpenRouter:", errorText);
      return null;
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error("❌ [AI] Пустой ответ от модели");
      return null;
    }

    console.log("✅ [AI] Получен ответ:", content.substring(0, 200) + "...");

    // Извлекаем JSON из markdown если есть
    let jsonText = content.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
      console.log("📝 [AI] Извлечён JSON из markdown");
    }

    let parsedJson;
    try {
      parsedJson = JSON.parse(jsonText);
    } catch (parseError) {
      console.error("❌ [AI] Ошибка парсинга JSON:", parseError);
      console.error("Полученный текст:", content);
      return null;
    }

    const parsed = schema.safeParse(parsedJson);
    if (!parsed.success) {
      console.error("❌ [AI] Ошибка валидации схемы:", parsed.error);
      console.error("Полученный JSON:", parsedJson);
      return null;
    }
    
    console.log("✅ [AI] Ответ успешно обработан");
    return parsed.data;
  } catch (error) {
    console.error("❌ [AI] Исключение при вызове API:", error);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function compareHomework(
  existing: string,
  incoming: string
): Promise<ComparisonResult | null> {
  console.log("🔄 [AI] Сравнение домашних заданий...");
  // Сравнение может быть быстрым - даём 10 секунд
  const result = await callOpenRouterJson(
    COMPARE_SYSTEM_PROMPT,
    `Существующее ДЗ:\n${existing}\n\nНовое ДЗ:\n${incoming}`,
    comparisonResultSchema,
    10_000 // 10 секунд для сравнения
  );
  if (!result) {
    console.log("⚠️ [AI] Не удалось сравнить ДЗ (AI недоступен)");
    return null;
  }

  // A "same" result only makes sense with a replacement text when one is given.
  if (result.same && !result.betterText) {
    console.log("✅ [AI] ДЗ одинаковые, замена не требуется");
    return { same: true };
  }
  console.log("✅ [AI] Результат сравнения:", result);
  return result;
}

export async function checkTextOnTopic(text: string): Promise<boolean> {
  console.log("🛡️ [AI] Проверка текста на адекватность...");
  // Цензура - даём 12 секунд (баланс скорость/надёжность)
  const verdict = await callOpenRouterJson(
    ON_TOPIC_SYSTEM_PROMPT,
    `Текст записи:\n${text}`,
    onTopicVerdictSchema,
    12_000 // 12 секунд
  );
  if (!verdict) {
    console.error("❌ [AI] Не удалось проверить текст - AI недоступен");
    throw new BotError("AI_UNAVAILABLE");
  }
  console.log("✅ [AI] Результат проверки:", verdict.onTopic ? "✅ Принят" : "❌ Отклонён");
  return verdict.onTopic;
}
