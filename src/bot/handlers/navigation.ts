import type { Bot } from "grammy";
import { isAdmin } from "@/lib/admin";
import { displaySubject } from "@/lib/subjects";
import {
  WEEK_LABELS,
  dateKey,
  dayKeyFromDate,
  formatDate,
  getWeekWindow,
  weekDates,
} from "@/lib/weeks";
import { getAdditionalForWeek } from "@/services/additional.service";
import { getDayHomework } from "@/services/homework.service";
import { getLessonsInRange } from "@/services/schedule.service";
import type { Flow, MyContext, WeekOffset } from "@/types";
import { daysReply, lessonKeyboard, weeksReply } from "../keyboards";
import {
  ADDITIONAL_ADD_PICK_TEXT,
  ADDITIONAL_VIEW_PICK_TEXT,
  BTN_ADDITIONAL_ADD,
  BTN_ADDITIONAL_VIEW,
  BTN_DAYS,
  BTN_HOMEWORK_ADD,
  BTN_HOMEWORK_VIEW,
  BTN_MENU,
  BTN_SCHEDULE,
  BTN_WEEKS,
  DAY_SHORT_LABELS,
  HOMEWORK_ADD_PICK_TEXT,
  HOMEWORK_ADD_TITLE_PREFIX,
  HOMEWORK_VIEW_PICK_TEXT,
  HOMEWORK_VIEW_TITLE_PREFIX,
  NO_LESSONS_TEXT,
  PICK_DAY_TEXT,
  PICK_LESSON_TEXT,
  SCHEDULE_EMPTY_TEXT,
  SCHEDULE_PICK_TEXT,
  additionalInputPrompt,
  additionalWeekMessage,
  dayHomeworkMessage,
  dayTitle,
  flowWeekTitle,
  scheduleWeekHeader,
} from "../messages";
import { showMainMenu } from "./start";

// Reply-keyboard navigation: menu, weeks and days arrive as plain text
// messages and are routed by the session's NavState. Lesson picking and
// admin actions remain inline callbacks (see homework.ts / admin.ts).

const FLOW_PICK_TEXTS: Record<Flow, string> = {
  sched: SCHEDULE_PICK_TEXT,
  hwv: HOMEWORK_VIEW_PICK_TEXT,
  hwa: HOMEWORK_ADD_PICK_TEXT,
  adv: ADDITIONAL_VIEW_PICK_TEXT,
  ada: ADDITIONAL_ADD_PICK_TEXT,
};

/** Any navigation press cancels a pending free-text input. */
function cancelPending(ctx: MyContext): void {
  ctx.session.pending = undefined;
}

export async function showWeeksForFlow(ctx: MyContext, flow: Flow) {
  cancelPending(ctx);
  ctx.session.nav = { flow, offset: 0 };
  await ctx.reply(FLOW_PICK_TEXTS[flow], { reply_markup: weeksReply() });
}

export async function showDaysForFlow(
  ctx: MyContext,
  flow: Flow,
  offset: WeekOffset
) {
  cancelPending(ctx);
  ctx.session.nav = { flow, offset };
  const text =
    flow === "sched" || flow === "adv"
      ? FLOW_PICK_TEXTS[flow]
      : `${flowWeekTitle(
          flow === "hwv" ? HOMEWORK_VIEW_TITLE_PREFIX : HOMEWORK_ADD_TITLE_PREFIX,
          offset
        )}\n\n${PICK_DAY_TEXT}`;
  await ctx.reply(text, { reply_markup: daysReply(flow) });
}

// ── Week press: per-flow week view ──────────────────────────────────────────

async function handleWeek(ctx: MyContext, flow: Flow, offset: WeekOffset) {
  cancelPending(ctx);
  ctx.session.nav = { flow, offset };
  const window = getWeekWindow(offset);

  if (flow === "adv") {
    const rows = await getAdditionalForWeek(window);
    await ctx.reply(additionalWeekMessage(offset, rows), {
      reply_markup: weeksReply(),
    });
    return;
  }

  if (flow === "ada") {
    await ctx.reply(ADDITIONAL_ADD_PICK_TEXT, { reply_markup: daysReply(flow) });
    return;
  }

  if (flow === "sched") {
    const lessons = await getLessonsInRange(window.start, window.end);
    const header = scheduleWeekHeader(offset, window.start, window.end);

    if (lessons.length === 0) {
      await ctx.reply(`${header}\n\n${SCHEDULE_EMPTY_TEXT}`, {
        reply_markup: daysReply(flow),
      });
      return;
    }

    const lines: string[] = [header, ""];
    for (const date of weekDates(offset)) {
      const dayLessons = lessons.filter(
        (l) => dayKeyFromDate(l.date) === dayKeyFromDate(date)
      );
      if (dayLessons.length === 0) continue;

      lines.push(`${dayTitle(date)} (${formatDate(date)})`);
      for (const lesson of dayLessons) {
        lines.push(`${lesson.lessonNumber}. ${displaySubject(lesson.subject)}`);
      }
      lines.push("");
    }

    await ctx.reply(lines.join("\n").trimEnd(), {
      reply_markup: daysReply(flow),
    });
    return;
  }

  // hwv / hwa: just show the day picker for the chosen week.
  await showDaysForFlow(ctx, flow, offset);
}

// ── Day press: per-flow day view ────────────────────────────────────────────

async function handleDay(
  ctx: MyContext,
  flow: Flow,
  offset: WeekOffset,
  date: Date
) {
  cancelPending(ctx);
  ctx.session.nav = { flow, offset };
  const dayKey = dateKey(date);

  if (flow === "sched") {
    const window = getWeekWindow(offset);
    const lessons = (await getLessonsInRange(window.start, window.end)).filter(
      (l) => dateKey(l.date) === dayKey
    );

    const lines: string[] = [`${dayTitle(date)} (${formatDate(date)})`, ""];
    if (lessons.length === 0) {
      lines.push(NO_LESSONS_TEXT);
    } else {
      for (const lesson of lessons) {
        lines.push(`${lesson.lessonNumber}. ${displaySubject(lesson.subject)}`);
      }
    }
    await ctx.reply(lines.join("\n"), { reply_markup: daysReply(flow) });
    return;
  }

  if (flow === "hwv") {
    const viewerIsAdmin = isAdmin(ctx.from?.id);
    const { rows, additional } = await getDayHomework(date, {
      includePending: viewerIsAdmin,
    });
    await ctx.reply(
      dayHomeworkMessage(date, rows, additional, viewerIsAdmin),
      { reply_markup: daysReply(flow) }
    );
    return;
  }

  if (flow === "hwa") {
    const window = getWeekWindow(offset);
    const lessons = (await getLessonsInRange(window.start, window.end)).filter(
      (l) => dateKey(l.date) === dayKey
    );

    if (lessons.length === 0) {
      await ctx.reply(`${dayTitle(date)}\n\n${NO_LESSONS_TEXT}`, {
        reply_markup: daysReply(flow),
      });
      return;
    }

    await ctx.reply(`${dayTitle(date)}\n\n${PICK_LESSON_TEXT}`, {
      reply_markup: lessonKeyboard(flow, offset, dayKey, lessons),
    });
    return;
  }

  // ada: ask for the day's "Additional" text.
  ctx.session.pending = { type: "additional", dateKey: dayKey };
  await ctx.reply(additionalInputPrompt(date));
}

export function registerNavigationHandlers(bot: Bot<MyContext>) {
  // Main menu buttons.
  bot.hears(BTN_SCHEDULE, (ctx) => showWeeksForFlow(ctx, "sched"));
  bot.hears(BTN_HOMEWORK_VIEW, (ctx) => showWeeksForFlow(ctx, "hwv"));
  bot.hears(BTN_HOMEWORK_ADD, (ctx) => showWeeksForFlow(ctx, "hwa"));
  bot.hears(BTN_ADDITIONAL_VIEW, (ctx) => showWeeksForFlow(ctx, "adv"));
  bot.hears(BTN_ADDITIONAL_ADD, (ctx) => showWeeksForFlow(ctx, "ada"));
  bot.hears(BTN_MENU, (ctx) => {
    cancelPending(ctx);
    return showMainMenu(ctx);
  });

  // Week buttons — the flow comes from the current navigation state.
  ([-1, 0, 1] as WeekOffset[]).forEach((offset) => {
    bot.hears(WEEK_LABELS[offset], async (ctx) => {
      const nav = ctx.session.nav;
      if (!nav) {
        await showMainMenu(ctx);
        return;
      }
      await handleWeek(ctx, nav.flow, offset);
    });
  });

  // Day buttons «Пн Вт Ср Чт Пт».
  DAY_SHORT_LABELS.forEach((label, index) => {
    bot.hears(label, async (ctx) => {
      const nav = ctx.session.nav;
      if (!nav) {
        await showMainMenu(ctx);
        return;
      }
      const date = weekDates(nav.offset)[index];
      await handleDay(ctx, nav.flow, nav.offset, date);
    });
  });

  // Back buttons.
  bot.hears(BTN_WEEKS, (ctx) => {
    const nav = ctx.session.nav;
    if (!nav) {
      return showMainMenu(ctx);
    }
    return showWeeksForFlow(ctx, nav.flow);
  });
  bot.hears(BTN_DAYS, (ctx) => {
    const nav = ctx.session.nav;
    if (!nav) {
      return showMainMenu(ctx);
    }
    return showDaysForFlow(ctx, nav.flow, nav.offset);
  });

  // Inline « Дни button under the lesson picker (hwa flow).
  bot.callbackQuery(/^bk:days:(-1|0|1)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const offset = Number(ctx.match![1]) as WeekOffset;
    const flow = ctx.session.nav?.flow ?? "hwa";
    await showDaysForFlow(ctx, flow, offset);
  });
}
