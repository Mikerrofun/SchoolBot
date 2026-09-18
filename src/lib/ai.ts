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
Ответь строго JSON: {"same": boolean, "betterText": string | undefined}`;

const ON_TOPIC_SYSTEM_PROMPT = `Ты модератор записей школьного бота. Тебе дают текст, который ученик хочет сохранить как домашнее задание или заметку, и предмет, к которому запись относится.
Определи, является ли текст осмысленной записью по делу: домашнее задание, напоминание о задании, примечание к уроку по этому предмету.
Мусор — спам, реклама, мат, оскорбления, бессмысленный набор символов, текст не по предмету.
Ответь строго JSON: {"onTopic": boolean}`;

/** One JSON-structured OpenRouter chat call; null on any failure. */
async function callOpenRouterJson<T>(
  systemPrompt: string,
  userContent: string,
  schema: z.ZodType<T>
): Promise<T | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
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
          model: "google/gemini-3.6-flash",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      }
    );
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
  } finally {
    clearTimeout(timeout);
  }
}

export async function compareHomework(
  existing: string,
  incoming: string
): Promise<ComparisonResult | null> {
  const result = await callOpenRouterJson(
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
 * Censorship check: is the text a legitimate homework / on-topic note.
 * Returns true (on topic) or false (spam / off topic — reject the entry).
 * Throws AI_UNAVAILABLE when no verdict can be obtained (no API key,
 * OpenRouter down, timeout, unparseable answer) — the entry is never saved
 * unchecked, and bot.catch tells the user to retry later.
 */
export async function checkTextOnTopic(
  text: string,
  subject?: string
): Promise<boolean> {
  const verdict = await callOpenRouterJson(
    ON_TOPIC_SYSTEM_PROMPT,
    subject
      ? `Предмет: ${subject}\nТекст записи:\n${text}`
      : `Текст записи:\n${text}`,
    onTopicVerdictSchema
  );
  if (!verdict) throw new BotError("AI_UNAVAILABLE");
  return verdict.onTopic;
}
