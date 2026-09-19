import { z } from "zod";
import { BotError } from "@/lib/errors";
import type { ComparisonResult } from "@/types";

// compareHomework is optional: if OpenRouter is unavailable it returns null
// ("verdict unknown") and the submission goes to pending moderation.
// Censorship (checkTextOnTopic) is fail-closed: it never returns an unknown
// verdict — it throws AI_UNAVAILABLE, so nothing is ever saved unchecked.

const comparisonResultSchema = z.object({
  same: z.boolean(),
  betterText: z.string().optional().nullable(),
});

const onTopicVerdictSchema = z.object({
  onTopic: z.boolean(),
});

const COMPARE_SYSTEM_PROMPT = `Ты помощник, который сравнивает формулировки домашнего задания школьников.
Тебе дают два текста ДЗ по одному и тому же уроку. Определи, это одно и то же задание или разные.
Если это одно и то же задание, но новая формулировка точнее или полнее — верни улучшенный текст.
Если задания разные — same=false и betterText не нужен.

ВАЖНО: Ответь СТРОГО в формате JSON. Примеры:
{"same": true}
{"same": true, "betterText": "улучшенный текст"}
{"same": false}

Ничего кроме JSON! Никаких пояснений, markdown, дополнительных полей!`;

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

  console.log(`🚀 [AI] Отправка запроса (timeout: ${timeoutMs}ms)`);
  console.log(`📤 [AI] User content: ${userContent.substring(0, 100)}...`);

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    console.warn(`⏰ [AI] Timeout ${timeoutMs}ms истёк, прерываем запрос`);
    controller.abort();
  }, timeoutMs);

  try {
    const requestBody = {
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
    };

    console.log(`📨 [AI] Request body:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );
    
    console.log(`📥 [AI] Получен ответ, статус: ${response.status}`);
    
    // Clear the timeout now that we have a response
    // (parsing JSON should be fast, no need for 30s timeout)
    clearTimeout(timeout);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ [AI] Ошибка от OpenRouter:", response.status, errorText);
      return null;
    }

    // Проверяем, не был ли запрос уже прерван
    if (controller.signal.aborted) {
      console.error("❌ [AI] Запрос был прерван по таймауту");
      return null;
    }
    
    // Parse JSON with the same abort signal
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    
    console.log(`📦 [AI] Полный ответ:`, JSON.stringify(data, null, 2));
    
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error("❌ [AI] Пустой ответ от модели");
      return null;
    }

    console.log(`📝 [AI] Content:`, content);

    // Извлекаем JSON из markdown если есть
    let jsonText = content.trim();
    const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    let parsedJson;
    try {
      parsedJson = JSON.parse(jsonText);
    } catch (parseError) {
      // Try to fix common AI mistakes
      // Example: {"same":{ "value": false } -> {"same": false}
      const fixedJson = jsonText
        .replace(/:\s*\{\s*"value":\s*(\w+)\s*\}/g, ': $1') // Fix {"value": X} -> X
        .replace(/,\s*\}/g, '}'); // Remove trailing commas
      
      try {
        parsedJson = JSON.parse(fixedJson);
        console.log("✅ [AI] JSON исправлен автоматически");
      } catch (retryError) {
        console.error("❌ [AI] Ошибка парсинга JSON. Ответ:", content);
        return null;
      }
    }

    const parsed = schema.safeParse(parsedJson);
    if (!parsed.success) {
      console.error("❌ [AI] Ошибка валидации:", parsed.error.errors);
      return null;
    }
    
    return parsed.data;
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error("⏱️ [AI] Запрос прерван по таймауту");
      return null;
    }
    console.error("❌ [AI] Исключение при вызове API:", error);
    return null;
  }
}

export async function compareHomework(
  existing: string,
  incoming: string
): Promise<ComparisonResult | null> {
  console.log("🔍 [COMPARE] Начало сравнения ДЗ");
  console.log("📖 [COMPARE] Существующее:", existing.substring(0, 50) + "...");
  console.log("📝 [COMPARE] Новое:", incoming.substring(0, 50) + "...");
  
  try {
    const result = await callOpenRouterJson(
      COMPARE_SYSTEM_PROMPT,
      `Существующее ДЗ:\n${existing}\n\nНовое ДЗ:\n${incoming}`,
      comparisonResultSchema,
      10_000
    );
    
    if (!result) {
      console.log("⚠️ [COMPARE] Не удалось сравнить ДЗ - AI недоступен");
      return null;
    }

    if (result.same && !result.betterText) {
      console.log("✅ [COMPARE] ДЗ идентичны");
      return { same: true };
    }
    
    if (result.same && result.betterText) {
      console.log("✨ [COMPARE] ДЗ идентичны, но есть улучшенная формулировка");
    } else {
      console.log("❌ [COMPARE] ДЗ различаются");
    }
    
    return result;
  } catch (error) {
    console.error("❌ [COMPARE] Неожиданная ошибка:", error);
    return null;
  }
}

export async function checkTextOnTopic(text: string): Promise<boolean> {
  const verdict = await callOpenRouterJson(
    ON_TOPIC_SYSTEM_PROMPT,
    `Текст записи:\n${text}`,
    onTopicVerdictSchema,
    30_000
  );
  if (!verdict) {
    console.error("❌ [AI] Не удалось проверить текст");
    throw new BotError("AI_UNAVAILABLE");
  }
  return verdict.onTopic;
}
