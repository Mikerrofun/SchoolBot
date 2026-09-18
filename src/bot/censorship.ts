import { checkTextOnTopic } from "@/lib/ai";
import { ERROR_REGISTRY, toBotError } from "@/lib/errors";
import type { Flow, MyContext } from "@/types";
import { daysReplyKeyboard } from "./keyboards";

/**
 * What the censorship step decided. Nothing is ever saved unchecked:
 * - "rejected"   — garbage (profanity/spam/nonsense): the user is told,
 *                  the caller must not save anything.
 * - "moderation" — AI is down, the verdict is unknown: the caller must
 *                  save the submission into the pending moderation flow.
 * - "approved"   — the text passed the filter: the caller saves normally.
 */
export type CensorshipVerdict =
  | { outcome: "rejected" }
  | { outcome: "moderation" }
  | { outcome: "approved" };

export async function censorSubmission(
  ctx: MyContext,
  text: string,
  flow: Flow
): Promise<CensorshipVerdict> {
  console.log("🔍 [CENSORSHIP] Начало проверки текста:", text.substring(0, 50) + "...");
  try {
    const onTopic = await checkTextOnTopic(text);
    if (!onTopic) {
      console.log("❌ [CENSORSHIP] Текст отклонён (мусор/спам)");
      await ctx.reply(ERROR_REGISTRY.CONTENT_REJECTED, {
        reply_markup: daysReplyKeyboard(flow),
      });
      return { outcome: "rejected" };
    }
    console.log("✅ [CENSORSHIP] Текст принят");
    return { outcome: "approved" };
  } catch (error) {
    const botError = toBotError(error);
    console.log("⚠️ [CENSORSHIP] Ошибка проверки:", botError.code);
    if (botError.code !== "AI_UNAVAILABLE") {
      console.error("❌ [CENSORSHIP] Неожиданная ошибка:", error);
      throw error;
    }
    console.log("⏸️ [CENSORSHIP] AI недоступен - отправка на модерацию");
    return { outcome: "moderation" };
  }
}
