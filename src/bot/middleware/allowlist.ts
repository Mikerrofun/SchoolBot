// Allowlist навигационных команд: константы + мапы из navigation.ts.

import {
  BTN_MENU,
  BTN_SCHEDULE,
  BTN_HOMEWORK_VIEW,
  BTN_HOMEWORK_ADD,
  BTN_ADDITIONAL_VIEW,
  BTN_ADDITIONAL_ADD,
  BTN_WEEKS,
  BTN_DAYS,
} from "../messages";

import { WEEK_LABELS } from "@/lib/weeks";
import { DAY_SHORT_LABELS } from "../messages";

export const NAV_ALLOWLIST = new Set<string>([
  "/start",
  BTN_MENU,
  BTN_SCHEDULE,
  BTN_HOMEWORK_VIEW,
  BTN_HOMEWORK_ADD,
  BTN_ADDITIONAL_VIEW,
  BTN_ADDITIONAL_ADD,
  BTN_WEEKS,
  BTN_DAYS,
  // Недели из WEEK_LABELS
  ...Object.values(WEEK_LABELS),
  // Дни из DAY_SHORT_LABELS
  ...Object.values(DAY_SHORT_LABELS),
]);
