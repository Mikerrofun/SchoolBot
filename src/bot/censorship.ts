import { checkTextOnTopic } from "@/lib/ai";
import { ERROR_REGISTRY, toBotError } from "@/lib/errors";
import type { Flow, MyContext } from "@/types";
import { daysReplyKeyboard } from "./keyboards";

export type CensorshipResult =
  | { allowed: false }
  | { allowed: true; aiDown: boolean };

/**
 * Shared censorship step for every free-text submission (homework and
 * "additional"). A garbage text is answered with CONTENT_REJECTED and
 * nothing may be saved. When the AI is down the verdict is unknown, so the
 * submission is neither approved nor lost: the caller saves it into the
 * pending moderation flow instead.
 */
export async function censorSubmission(
  ctx: MyContext,
  text: string,
  flow: Flow
): Promise<CensorshipResult> {
  try {
    const onTopic = await checkTextOnTopic(text);
    if (!onTopic) {
      await ctx.reply(ERROR_REGISTRY.CONTENT_REJECTED, {
        reply_markup: daysReplyKeyboard(flow),
      });
      return { allowed: false };
    }
    return { allowed: true, aiDown: false };
  } catch (error) {
    if (toBotError(error).code !== "AI_UNAVAILABLE") throw error;
    return { allowed: true, aiDown: true };
  }
}
