// Reply-keyboard navigation: menu, weeks, days and lesson options arrive as
// plain text messages. Button texts are the constants from messages.ts, so
// keyboards and this router can never drift apart. Free-text input (homework
// / additional) is handled later by the flow handlers — any navigation press
// cancels the pending input first.

import type { Bot } from "grammy";
import { isAdmin } from "@/lib/admin";
import {
  WEEK_LABELS,
  dayKeyFromDate,
  getWeekWindow,
  parseDateKey,
  weekDates,
} from "@/lib/weeks";
import { shortSubject } from "@/lib/subjects";
import { getAdditionalForWeek } from "@/services/additional.service";
import { getDayHomework } from "@/services/homework.service";
import { getLessonsInRange, getWeekLessons } from "@/services/schedule.service";
import type {
  DayKey,
  Flow,
  LessonChoice,
  MyContext,
  WeekOffset,
} from "@/types";
import {
  daysReplyKeyboard,
  lessonsReplyKeyboard,
  mainMenuReplyKeyboard,
  weeksReplyKeyboard,
} from "../keyboards";
import {
  ADDITIONAL_ADD_PICK_TEXT,
  ADDITIONAL_ADD_TITLE_PREFIX,
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
  MENU_TEXT,
  NO_LESSONS_TEXT,
  PICK_DAY_TEXT,
  PICK_LESSON_TEXT,
  additionalInputPrompt,
  additionalWeekMessage,
  dayHomeworkMessage,
  dayTitle,
  flowWeekTitle,
  homeworkInputPrompt,
  scheduleWeekMessage,
} from "../messages";

const FLOW_PICK_TEXTS: Record<Flow, string> = {
  hwv: HOMEWORK_VIEW_PICK_TEXT,
  hwa: HOMEWORK_ADD_PICK_TEXT,
  adv: ADDITIONAL_VIEW_PICK_TEXT,
  ada: ADDITIONAL_ADD_PICK_TEXT,
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
  ctx.session.lessonChoices = undefined;
  await ctx.reply(MENU_TEXT, { reply_markup: mainMenuReplyKeyboard() });
}

/** Enters a flow: shows its week picker and remembers the flow. */
export async function startFlow(ctx: MyContext, flow: Flow): Promise<void> {
  ctx.session.pending = undefined;
  ctx.session.flow = flow;
  ctx.session.weekOffset = undefined;
  ctx.session.lessonChoices = undefined;
  await ctx.reply(FLOW_PICK_TEXTS[flow], { reply_markup: weeksReplyKeyboard() });
}

/**
 * The schedule template is the same every week, so there is nothing to pick:
 * one message with the current week, then back to the main menu keyboard.
 */
export async function showSchedule(ctx: MyContext): Promise<void> {
  ctx.session.pending = undefined;
  ctx.session.flow = undefined;
  ctx.session.weekOffset = undefined;
  ctx.session.lessonChoices = undefined;
  const days = await getWeekLessons(getWeekWindow(0));
  await ctx.reply(scheduleWeekMessage(days), {
    reply_markup: mainMenuReplyKeyboard(),
  });
}

export function registerNavigationHandlers(bot: Bot<MyContext>) {
  bot.on("message:text", async (ctx, next) => {
    const text = ctx.message.text;
    
    console.log("🧭 [NAVIGATION] Получено сообщение:", text.substring(0, 50));

    if (text === BTN_MENU) {
      await showMainMenu(ctx);
      return; // Обработано - не передаём дальше
    }
    if (text === BTN_SCHEDULE) {
      await showSchedule(ctx);
      return;
    }
    if (text === BTN_HOMEWORK_VIEW) {
      await startFlow(ctx, "hwv");
      return;
    }
    if (text === BTN_HOMEWORK_ADD) {
      await startFlow(ctx, "hwa");
      return;
    }
    if (text === BTN_ADDITIONAL_VIEW) {
      await startFlow(ctx, "adv");
      return;
    }
    if (text === BTN_ADDITIONAL_ADD) {
      await startAdditionalEdit(ctx);
      return;
    }

    if (text === BTN_WEEKS) {
      await handleWeeksButton(ctx);
      return;
    }
    if (text === BTN_DAYS) {
      await handleDaysButton(ctx);
      return;
    }

    const weekOffset = WEEK_BY_LABEL.get(text);
    if (weekOffset !== undefined) {
      await handleWeek(ctx, weekOffset);
      return;
    }

    const day = DAY_BY_LABEL.get(text);
    if (day) {
      await handleDay(ctx, day);
      return;
    }

    const choice = ctx.session.lessonChoices?.find((c) => c.label === text);
    if (choice) {
      await handleLessonChoice(ctx, choice);
      return;
    }
    
    // Не обработано навигацией - передаём следующему handler
    console.log("➡️ [NAVIGATION] Не является командой навигации, передаём дальше");
    await next(); // КРИТИЧЕСКИ ВАЖНО!
  });
}

/** "✏️ Дополнительно" from the add-homework day picker: edit "Дополнительно". */
async function startAdditionalEdit(ctx: MyContext): Promise<void> {
  const offset = ctx.session.weekOffset ?? 0;
  ctx.session.pending = undefined;
  ctx.session.flow = "ada";
  await showDays(ctx, "ada", offset, FLOW_PICK_TEXTS.ada);
}

/** "« Недели": back to the week picker of the current flow. */
async function handleWeeksButton(ctx: MyContext): Promise<void> {
  const flow = ctx.session.flow;
  if (!flow) return showMainMenu(ctx);
  return startFlow(ctx, flow);
}

/** "« Дни": back to the day picker of the current flow and week. */
async function handleDaysButton(ctx: MyContext): Promise<void> {
  const flow = ctx.session.flow;
  const offset = ctx.session.weekOffset;
  if (!flow || offset === undefined) return showMainMenu(ctx);
  return showDays(ctx, flow, offset, weekHeaderFor(flow, offset));
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
    case "hwv":
      return `${flowWeekTitle(HOMEWORK_VIEW_TITLE_PREFIX, offset)}\n\n${PICK_DAY_TEXT}`;
    case "hwa":
      return `${flowWeekTitle(HOMEWORK_ADD_TITLE_PREFIX, offset)}\n\n${PICK_DAY_TEXT}`;
    case "ada":
      return `${flowWeekTitle(ADDITIONAL_ADD_TITLE_PREFIX, offset)}\n\n${PICK_DAY_TEXT}`;
    case "adv":
      // Unreachable: the view flow never shows a day picker.
      return ADDITIONAL_VIEW_PICK_TEXT;
  }
}

async function showDays(
  ctx: MyContext,
  flow: Flow,
  offset: WeekOffset,
  header: string
): Promise<void> {
  ctx.session.pending = undefined;
  ctx.session.lessonChoices = undefined;
  ctx.session.weekOffset = offset;
  await ctx.reply(header, { reply_markup: daysReplyKeyboard(flow) });
}

async function handleDay(ctx: MyContext, day: DayKey): Promise<void> {
  const flow = ctx.session.flow;
  const offset = ctx.session.weekOffset;
  if (!flow || offset === undefined) return showMainMenu(ctx);

  // Map the short label back to a concrete date of the chosen week.
  const date = weekDateOf(offset, day);
  if (!date) return;

  ctx.session.pending = undefined;

  switch (flow) {
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
      // Lessons become reply buttons; the mapping lives in the session so
      // the router can resolve a pressed label back to a lesson id.
      const choices: LessonChoice[] = lessons.map((lesson) => ({
        lessonId: lesson.id,
        label: `${lesson.lessonNumber}. ${shortSubject(lesson.subject)}`,
        subject: lesson.subject,
        dateKey: dateKeyOf(date),
      }));
      ctx.session.lessonChoices = choices;
      await ctx.reply(`${dayTitle(date)}\n\n${PICK_LESSON_TEXT}`, {
        reply_markup: lessonsReplyKeyboard(choices),
      });
      return;
    }
    case "ada": {
      ctx.session.pending = { type: "additional", dateKey: dateKeyOf(date) };
      await ctx.reply(additionalInputPrompt(date), {
        reply_markup: daysReplyKeyboard(flow),
      });
      return;
    }
  }
}

/** A lesson reply-button was pressed: ask for the homework text. */
async function handleLessonChoice(
  ctx: MyContext,
  choice: LessonChoice
): Promise<void> {
  const date = parseDateKey(choice.dateKey);
  if (!date) return showMainMenu(ctx);

  ctx.session.pending = {
    type: "lesson",
    lessonId: choice.lessonId,
    subject: choice.subject,
    dateKey: choice.dateKey,
  };
  console.log("✏️ [NAVIGATION] Урок выбран, установлен pending:", ctx.session.pending);
  await ctx.reply(homeworkInputPrompt(choice.subject, date));
}

// ── Small date helpers ──────────────────────────────────────────────────────

function weekDateOf(offset: WeekOffset, day: DayKey): Date | undefined {
  return weekDates(offset).find((d) => dayKeyFromDate(d) === day);
}

function dateKeyOf(date: Date): string {
  return date.toISOString().slice(0, 10);
}
