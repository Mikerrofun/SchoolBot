// Single source of truth for the class schedule. Used by both the seed
// script and the lazy-creation logic in schedule.service.ts, so lessons
// are always created from the same template no matter who creates them.

import type { ScheduleTemplate } from "@/types";

export const SCHEDULE_TEMPLATE: ScheduleTemplate = {
  MONDAY: [
    "Математика",
    "Физическая культура и здоровье",
    "Физика",
    "Биология",
    "Обществоведение",
    // Split subjects: two groups in the same slot, each with its own homework.
    "Английский язык (Веренич)",
    "Английский язык (не Веренич)",
  ],
  TUESDAY: [
    "Русская литература",
    "Русский язык",
    "География",
    "Химия",
    "История",
    "Математика",
    "Информатика",
  ],
  WEDNESDAY: ["Трудовое обучение (УПК)"],
  THURSDAY: [
    "Английский язык (Веренич)",
    "Английский язык (не Веренич)",
    "Математика",
    "Белорусская литература",
    "Белорусский язык",
    "Химия",
    "Физическая культура и здоровье",
    "Астрономия",
  ],
  FRIDAY: [
    "Биология",
    "История",
    "Белорусский язык",
    "Физика",
    "Русская литература",
    "Математика",
    "Физическая культура и здоровье",
  ],
};

/** Standing joke homework attached to the Wednesday УПК lesson. */
export const UPK_HOMEWORK_TEXT = "ВАМ РЕАЛЬНО ЗАДАЮТ ДЗ ПО УПК???";
