import { z } from "zod";

// AI is optional: if OpenRouter is unavailable the bot keeps working
// and homework is saved without deduplication.

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
