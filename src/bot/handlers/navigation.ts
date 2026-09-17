// Reply-keyboard navigation: menu, weeks and days arrive as plain text
// messages. Button texts are the constants from messages.ts, so keyboards
// and this router can never drift apart. Free-text input (homework /
// additional) is handled later by the flow handlers — any navigation press
// cancels the pending input first.

import type { Bot } from "grammy";
import { isAdmin } from "@/lib/admin";
import {
  dateKey,
  dayKeyFromDate,
  getWeekWindow,
  WEEK_LABELS,
  weekDates,
} from "@/lib/weeks";
import { getAdditionalForWeek } from "@/services/additional.service";
import { getDayHomework } from "@/services/homework.service";
import { getLessonsInRange } from "@/services/schedule.service";
import type { DayKey, Flow, MyContext, WeekOffset } from "@/types";
import {
  daysReplyKeyboard,
  lessonKeyboard,
  mainMenuReplyKeyboard,
  weeksReplyKeyboard,
} from "../keyboards";
import {
  ADDITIONAL_ADD_TITLE_PREFIX,
  ADDITIONAL_VIEW_PICK_TEXT,
  BTN_ADDITIONAL_ADD,
  BTN_ADDITIONAL_VIEW,
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
  MENU_TEXT,
  NO_LESSONS_TEXT,
  PICK_DAY_TEXT,
  PICK_LESSON_TEXT,
  SCHEDULE_PICK_TEXT,
  additionalInputPrompt,
  additionalWeekMessage,
  dayHomeworkMessage,
  dayTitle,
  flowWeekTitle,
  scheduleDayMessage,
  scheduleWeekHeader,
} from "../messages";

const FLOW_PICK_TEXTS: Record<Flow, string> = {
  sched: SCHEDULE_PICK_TEXT,
  hwv: HOMEWORK_VIEW_PICK_TEXT,
  hwa: HOMEWORK_ADD_PICK_TEXT,
  adv: ADDITIONAL_VIEW_PICK_TEXT,
  ada: `${ADDITIONAL_ADD_TITLE_PREFIX}\n\n${PICK_DAY_TEXT}`,
};

const WEEK_BY_LABEL = new Map<string, WeekOffset>([
  [WEEK_LABELS[-1], -1],
  [WEEK_LABELS[0], 0],
  [WEEK_LABELS[1], 1],
]);

const DAY_BY_LABEL = new Map<string, DayKey>(
  Object.entries(DAY_SHORT_LABELS).map(([day, label]) => [label, day as DayKey])
);

/** Shows the main menu and resets navigation state. */
export async function showMainMenu(ctx: MyContext): Promise<void> {
  ctx.session.pending = undefined;
  ctx.session.flow = undefined;
  ctx.session.weekOffset = undefined;
  await ctx.reply(MENU_TEXT, { reply_markup: mainMenuReplyKeyboard() });
}

/** Enters a flow: shows its week picker and remembers the flow. */
export async function startFlow(ctx: MyContext, flow: Flow): Promise<void> {
  ctx.session.pending = undefined;
  ctx.session.flow = flow;
  ctx.session.weekOffset = undefined;
  await ctx.reply(FLOW_PICK_TEXTS[flow], { reply_markup: weeksReplyKeyboard() });
}

export function registerNavigationHandlers(bot: Bot<MyContext>) {
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text;

    if (text === BTN_MENU) return showMainMenu(ctx);
    if (text === BTN_SCHEDULE) return startFlow(ctx, "sched");
    if (text === BTN_HOMEWORK_VIEW) return startFlow(ctx, "hwv");
    if (text === BTN_HOMEWORK_ADD) return startFlow(ctx, "hwa");
    if (text === BTN_ADDITIONAL_VIEW) return startFlow(ctx, "adv");
    if (text === BTN_ADDITIONAL_ADD) return startAdditionalEdit(ctx);

    const weekOffset = WEEK_BY_LABEL.get(text);
    if (weekOffset !== undefined) return handleWeek(ctx, weekOffset);

    const day = DAY_BY_LABEL.get(text);
    if (day) return handleDay(ctx, day);
  });
}

/** « Заполнить from the add-homework day picker: edit "Дополнительно". */
async function startAdditionalEdit(ctx: MyContext): Promise<void> {
  const offset = ctx.session.weekOffset ?? 0;
  ctx.session.pending = undefined;
  ctx.session.flow = "ada";
  await showDays(ctx, "ada", offset, FLOW_PICK_TEXTS.ada);
}

async function handleWeek(ctx: MyContext, offset: WeekOffset): Promise<void> {
  const flow = ctx.session.flow;
  // State lost (e.g. server restart) — start over from the main menu.
  if (!flow) return showMainMenu(ctx);

  ctx.session.pending = undefined;
  ctx.session.weekOffset = offset;

  if (flow === "adv") {
    // The view flow shows the whole week at once, no day picking.
    const rows = await getAdditionalForWeek(getWeekWindow(offset));
    await ctx.reply(additionalWeekMessage(offset, rows), {
      reply_markup: weeksReplyKeyboard(),
    });
    return;
  }

  await showDays(ctx, flow, offset, weekHeaderFor(flow, offset));
}

function weekHeaderFor(flow: Flow, offset: WeekOffset): string {
  switch (flow) {
    case "sched": {
      const window = getWeekWindow(offset);
      return `${scheduleWeekHeader(offset, window.start, window.end)}\n\n${PICK_DAY_TEXT}`;
    }
    case "hwv":
      return `${flowWeekTitle(HOMEWORK_VIEW_TITLE_PREFIX, offset)}\n\n${PICK_DAY_TEXT}`;
    case "hwa":
      return `${flowWeekTitle(HOMEWORK_ADD_TITLE_PREFIX, offset)}\n\n${PICK_DAY_TEXT}`;
    case "ada":
      return `${flowWeekTitle(ADDITIONAL_ADD_TITLE_PREFIX, offset)}\n\n${PICK_DAY_TEXT}`;
    case "adv":
      return ADDITIONAL_VIEW_PICK_TEXT;
  }
}

async function showDays(
  ctx: MyContext,
  flow: Flow,
  offset: WeekOffset,
  header: string
): Promise<void> {
  ctx.session.weekOffset = offset;
  await ctx.reply(header, { reply_markup: daysReplyKeyboard(flow) });
}

async function handleDay(ctx: MyContext, day: DayKey): Promise<void> {
  const flow = ctx.session.flow;
  const offset = ctx.session.weekOffset;
  if (!flow || offset === undefined) return showMainMenu(ctx);

  // Map the short label back to a concrete date of the chosen week.
  const date = weekDates(offset).find((d) => dayKeyFromDate(d) === day);
  if (!date) return;

  ctx.session.pending = undefined;

  switch (flow) {
    case "sched": {
      const lessons = await getLessonsInRange(date, date);
      await ctx.reply(scheduleDayMessage(date, lessons), {
        reply_markup: daysReplyKeyboard(flow),
      });
      return;
    }
    case "hwv": {
      const viewerIsAdmin = isAdmin(ctx.from?.id);
      const { rows, additional } = await getDayHomework(date, {
        includePending: viewerIsAdmin,
      });
      await ctx.reply(dayHomeworkMessage(date, rows, additional, viewerIsAdmin), {
        reply_markup: daysReplyKeyboard(flow),
      });
      return;
    }
    case "hwa": {
      const lessons = await getLessonsInRange(date, date);
      if (lessons.length === 0) {
        await ctx.reply(NO_LESSONS_TEXT, {
          reply_markup: daysReplyKeyboard(flow),
        });
        return;
      }
      await ctx.reply(`${dayTitle(date)}\n\n${PICK_LESSON_TEXT}`, {
        reply_markup: lessonKeyboard(flow, offset, dateKey(date), lessons),
      });
      return;
    }
    case "ada": {
      ctx.session.pending = { type: "additional", dateKey: dateKey(date) };
      await ctx.reply(additionalInputPrompt(date), {
        reply_markup: daysReplyKeyboard(flow),
      });
      return;
    }
    case "adv":
      // The view flow has no day picking.
      return;
  }
}
