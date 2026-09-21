import { z } from "zod";
import { BotError } from "@/lib/errors";
import type { ComparisonResult } from "@/types";
import {
  AI_CONFIG,
  COMPARE_SYSTEM_PROMPT,
  ON_TOPIC_SYSTEM_PROMPT,
  comparisonResultSchema,
  onTopicVerdictSchema,
} from "./ai.types";

// compareHomework is optional: if OpenRouter is unavailable it returns null
// ("verdict unknown") and the submission goes to pending moderation.
// Censorship (checkTextOnTopic) is fail-closed: it never returns an unknown
// verdict — it throws AI_UNAVAILABLE, so nothing is ever saved unchecked.

/**
 * Парсит JSON ответ от AI, обрабатывая markdown обертки и типичные ошибки AI.
 * @returns распарсенный объект или null при ошибке
 */
function parseAIJsonResponse(content: string): unknown | null {
  // Извлекаем JSON из markdown если есть
  let jsonText = content.trim();
  const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) {
    jsonText = jsonMatch[1];
  }

  try {
    return JSON.parse(jsonText);
  } catch (parseError) {
    // Пытаемся исправить типичные ошибки AI
    const fixedJson = jsonText
      .replace(/:\s*\{\s*"value":\s*(\w+)\s*\}/g, ': $1')
      .replace(/,\s*\}/g, '}');
    
    try {
      const parsed = JSON.parse(fixedJson);
      console.log("✅ [AI] JSON исправлен автоматически");
      return parsed;
    } catch (retryError) {
      console.error("❌ [AI] Ошибка парсинга JSON:", content.substring(0, 100));
      return null;
    }
  }
}

/** One JSON-structured OpenRouter chat call; null on any failure. */
async function callOpenRouterJson<T>(
  systemPrompt: string,
  userContent: string,
  schema: z.ZodType<T>,
  timeoutMs: number = AI_CONFIG.DEFAULT_TIMEOUT_MS
): Promise<T | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.error("❌ [AI] OPENROUTER_API_KEY не найден");
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    console.warn(`⏰ [AI] Timeout ${timeoutMs}ms`);
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(AI_CONFIG.OPENROUTER_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...AI_CONFIG.MODEL_CONFIG,
        models: AI_CONFIG.MODELS,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
      }),
    });
    
    clearTimeout(timeout);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ [AI] Ошибка OpenRouter:", response.status, errorText);
      return null;
    }

    if (controller.signal.aborted) {
      console.error("❌ [AI] Запрос прерван по таймауту");
      return null;
    }
    
    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error("❌ [AI] Пустой ответ");
      return null;
    }

    const parsedJson = parseAIJsonResponse(content);
    if (!parsedJson) {
      return null;
    }

    const parsed = schema.safeParse(parsedJson);
    if (!parsed.success) {
      console.error("❌ [AI] Валидация не прошла:", parsed.error.errors);
      return null;
    }
    
    return parsed.data;
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      console.error("⏱️ [AI] Прервано по таймауту");
      return null;
    }
    console.error("❌ [AI] Исключение:", error);
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
      AI_CONFIG.COMPARE_TIMEOUT_MS
    );
    
    if (!result) {
      console.log("⚠️ [COMPARE] Не удалось сравнить ДЗ - AI недоступен");
      return null;
    }

    // Преобразуем null в undefined для соответствия типу ComparisonResult
    const betterText = result.betterText ?? undefined;

    if (result.same && !betterText) {
      console.log("✅ [COMPARE] ДЗ идентичны");
      return { same: true };
    }
    
    if (result.same && betterText) {
      console.log("✨ [COMPARE] ДЗ идентичны, но есть улучшенная формулировка");
      return { same: true, betterText };
    } else {
      console.log("❌ [COMPARE] ДЗ различаются");
      return { same: false };
    }
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
    AI_CONFIG.ON_TOPIC_TIMEOUT_MS
  );
  if (!verdict) {
    console.error("❌ [AI] Не удалось проверить текст");
    throw new BotError("AI_UNAVAILABLE");
  }
  return verdict.onTopic;
}
