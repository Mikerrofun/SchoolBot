import type { Bot } from "grammy";
import type {
  AdditionalReviewNotification,
  MyContext,
  NewHomeworkNotification,
} from "@/types";
import { getAdminIds, isAdmin } from "@/lib/admin";
import {
  approveAdditional,
  rejectAdditional,
} from "@/services/additional.service";
import { approveHomework, rejectHomework } from "@/services/homework.service";
import { adminReviewKeyboard } from "../keyboards";
import {
  ADDITIONAL_APPROVED_TEXT,
  ADDITIONAL_REJECTED_TEXT,
  HOMEWORK_APPROVED_TEXT,
  HOMEWORK_REJECTED_TEXT,
  NOT_ADMIN_ALERT_TEXT,
  REVIEW_APPROVED_MARK,
  REVIEW_REJECTED_MARK,
  adminAdditionalReviewMessage,
  adminReviewMessage,
} from "../messages";

/** Sends the homework review request (with approve/reject buttons) to every admin. */
export async function notifyAdminsNewHomework(
  bot: Bot<MyContext>,
  params: NewHomeworkNotification
): Promise<void> {
  const text = adminReviewMessage(params);
  await Promise.all(
    getAdminIds().map((adminId) =>
      bot.api
        .sendMessage(adminId, text, {
          reply_markup: adminReviewKeyboard(params.homeworkId, "hw"),
        })
        .catch((error) => {
          console.error(`[v0] failed to notify admin ${adminId}:`, error);
        })
    )
  );
}

/** Sends the "Additional" review request (AI was down) to every admin. */
export async function notifyAdminsAdditionalReview(
  bot: Bot<MyContext>,
  params: AdditionalReviewNotification
): Promise<void> {
  const text = adminAdditionalReviewMessage(params);
  await Promise.all(
    getAdminIds().map((adminId) =>
      bot.api
        .sendMessage(adminId, text, {
          reply_markup: adminReviewKeyboard(params.additionalId, "ad"),
        })
        .catch((error) => {
          console.error(`[v0] failed to notify admin ${adminId}:`, error);
        })
    )
  );
}

async function markReviewMessage(ctx: MyContext, mark: string) {
  const message = ctx.callbackQuery?.message;
  if (message && "text" in message && message.text) {
    try {
      await ctx.editMessageText(`${message.text}\n\n${mark}`);
    } catch {
      // Message may be too old to edit — the action itself already succeeded.
    }
  }
}

async function notifyAuthor(
  bot: Bot<MyContext>,
  authorId: string | null,
  text: string
) {
  const id = Number(authorId);
  if (!authorId || !Number.isInteger(id) || id <= 0) return;
  await bot.api.sendMessage(id, text).catch((error) => {
    console.error(`[v0] failed to notify author ${authorId}:`, error);
  });
}

/** Answers the callback and tells whether the user may moderate. */
async function requireAdmin(ctx: MyContext): Promise<boolean> {
  // Server-side permission check, not just UI-level hiding.
  if (!isAdmin(ctx.from?.id)) {
    await ctx.answerCallbackQuery({ text: NOT_ADMIN_ALERT_TEXT, show_alert: true });
    return false;
  }
  await ctx.answerCallbackQuery();
  return true;
}

export function registerAdminHandlers(bot: Bot<MyContext>) {
  bot.callbackQuery(/^hw:approve:(\d+)$/, async (ctx) => {
    if (!(await requireAdmin(ctx))) return;

    const approved = await approveHomework(Number(ctx.match![1]));
    if (!approved) return;

    await markReviewMessage(ctx, REVIEW_APPROVED_MARK);
    await notifyAuthor(bot, approved.createdBy, HOMEWORK_APPROVED_TEXT);
  });

  bot.callbackQuery(/^hw:reject:(\d+)$/, async (ctx) => {
    if (!(await requireAdmin(ctx))) return;

    const rejected = await rejectHomework(Number(ctx.match![1]));
    if (!rejected) return;

    await markReviewMessage(ctx, REVIEW_REJECTED_MARK);
    // The submitter is `pendingCreatedBy`; `createdBy` still points at the
    // author of the approved text that was kept.
    await notifyAuthor(
      bot,
      rejected.pendingCreatedBy ?? rejected.createdBy,
      HOMEWORK_REJECTED_TEXT
    );
  });

  bot.callbackQuery(/^ad:approve:(\d+)$/, async (ctx) => {
    if (!(await requireAdmin(ctx))) return;

    const approved = await approveAdditional(Number(ctx.match![1]));
    if (!approved) return;

    await markReviewMessage(ctx, REVIEW_APPROVED_MARK);
    await notifyAuthor(bot, approved.authorId, ADDITIONAL_APPROVED_TEXT);
  });

  bot.callbackQuery(/^ad:reject:(\d+)$/, async (ctx) => {
    if (!(await requireAdmin(ctx))) return;

    const rejected = await rejectAdditional(Number(ctx.match![1]));
    if (!rejected) return;

    await markReviewMessage(ctx, REVIEW_REJECTED_MARK);
    // The submitter is `pendingAuthorId`; `authorId` still points at the
    // author of the approved text that was kept.
    await notifyAuthor(
      bot,
      rejected.pendingAuthorId ?? rejected.authorId,
      ADDITIONAL_REJECTED_TEXT
    );
  });
}
