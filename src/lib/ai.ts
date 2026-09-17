import { z } from "zod";

// AI is optional: if OpenRouter is unavailable the bot keeps working
// and homework is saved without deduplication.

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "google/gemini-3.6-flash";
const REQUEST_TIMEOUT_MS = 15_000;

const comparisonResultSchema = z.object({
  same: z.boolean(),
  betterText: z.string().optional(),
});

export type ComparisonResult = z.infer<typeof comparisonResultSchema>;

const relevanceResultSchema = z.object({
  relevant: z.boolean(),
});

export type RelevanceResult = z.infer<typeof relevanceResultSchema>;

const COMPARE_SYSTEM_PROMPT = `Ты помощник, который сравнивает формулировки домашнего задания школьников.
Тебе дают два текста ДЗ по одному и тому же уроку. Определи, это одно и то же задание или разные.
Если это одно и то же задание, но новая формулировка точнее или полнее — верни улучшенный текст.
Если задания разные — same=false и betterText не нужен.
Ответь строго JSON: {"same": boolean, "betterText": string | undefined}`;

const RELEVANCE_SYSTEM_PROMPT = `Ты модератор записей в школьном боте домашнего задания.
Тебе дают текст, который ученик хочет записать. Определи, является ли текст домашним заданием
или другой записью по делу (домашка, напоминание об уроке, задание по предмету).
Спам, мат, оскорбления, реклама, бессмысленный набор слов и тексты не по теме — не по делу.
Ответь строго JSON: {"relevant": boolean}`;

/**
 * Single OpenRouter call helper: returns the parsed JSON verdict,
 * or null when the key is missing / the request fails / the answer
 * does not match the schema.
 */
async function callOpenRouter<S extends z.ZodTypeAny>(
  systemPrompt: string,
  userPrompt: string,
  schema: S
): Promise<z.infer<S> | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = schema.safeParse(JSON.parse(content));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function compareHomework(
  existing: string,
  incoming: string
): Promise<ComparisonResult | null> {
  const result = await callOpenRouter(
    COMPARE_SYSTEM_PROMPT,
    `Существующее ДЗ:\n${existing}\n\nНовое ДЗ:\n${incoming}`,
    comparisonResultSchema
  );

  if (!result) return null;

  // A "same" result only makes sense with a replacement text when one is given.
  if (result.same && !result.betterText) {
    return { same: true };
  }
  return result;
}

/**
 * Moderation verdict for a free-text submission (homework or "Additional").
 * Returns null when AI is unavailable — callers must handle that case
 * explicitly and uniformly.
 */
export async function checkTextRelevance(
  text: string
): Promise<RelevanceResult | null> {
  return callOpenRouter(
    RELEVANCE_SYSTEM_PROMPT,
    `Текст записи:\n${text}`,
    relevanceResultSchema
  );
}
