import { z } from "zod";

// ============================================================================
// Zod Schemas
// ============================================================================

export const comparisonResultSchema = z.object({
  same: z.boolean(),
  betterText: z.string().optional().nullable(),
});

export const onTopicVerdictSchema = z.object({
  onTopic: z.boolean(),
});

// ============================================================================
// System Prompts
// ============================================================================

export const COMPARE_SYSTEM_PROMPT = `Ты помощник, который сравнивает формулировки домашнего задания школьников.
Тебе дают два текста ДЗ по одному и тому же уроку. Определи, это одно и то же задание или разные.
Если это одно и то же задание, но новая формулировка точнее или полнее — верни улучшенный текст.
Если задания разные — same=false и betterText не нужен.

ВАЖНО: Ответь СТРОГО в формате JSON.

ТИПЫ ПОЛЕЙ:
- same: boolean (true или false, БЕЗ кавычек)
- betterText: string (строка в кавычках) ИЛИ вообще не включай это поле

ПРАВИЛЬНЫЕ примеры:
{"same": true}
{"same": true, "betterText": "улучшенный текст"}
{"same": false}

НЕПРАВИЛЬНО (НЕ ДЕЛАЙ ТАК):
{"same": true, "betterText": null}  ❌ НЕ используй null!
{"same": "true"}  ❌ НЕ оборачивай boolean в кавычки!

Ничего кроме JSON! Никаких пояснений, markdown, дополнительных полей!`;

export const ON_TOPIC_SYSTEM_PROMPT = `Ты фильтр записей школьного бота. Ученик хочет сохранить текст как домашнее задание или заметку.
Определи, похож ли текст на осмысленную запись по делу: домашнее задание, напоминание о задании, примечание к уроку.
Мусор — спам, реклама, мат, оскорбления, бессмысленный набор символов, случайные буквы или цифры.

ВАЖНО: Ответь ТОЛЬКО чистым JSON без markdown, без форматирования, без пояснений:
{"onTopic": boolean}`;

// ============================================================================
// Configuration Constants
// ============================================================================

export const AI_CONFIG = {
  DEFAULT_TIMEOUT_MS: 20_000,
  COMPARE_TIMEOUT_MS: 10_000,
  ON_TOPIC_TIMEOUT_MS: 30_000,
  
  OPENROUTER_API_URL: "https://openrouter.ai/api/v1/chat/completions",
  
  MODELS: [
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "deepseek/deepseek-v4-flash-0731:free",
    "qwen/qwen3.8-27b:free"
  ],
  
  MODEL_CONFIG: {
    model: "openrouter/auto",
    temperature: 0,
    response_format: { type: "json_object" as const },
    route: "fallback" as const,
  },
} as const;
