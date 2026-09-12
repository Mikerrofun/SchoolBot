import { PrismaClient } from "@prisma/client";
import { addDays, currentWeekStart, dayKeyFromDate } from "../src/lib/weeks";

const prisma = new PrismaClient();

const SCHEDULE: Record<string, string[]> = {
  MONDAY: ["Математика", "Русский язык", "Физика"],
  TUESDAY: ["История", "Английский язык", "Математика"],
  WEDNESDAY: ["Литература", "Химия", "Алгебра"],
  THURSDAY: ["География", "Математика", "Биология"],
  FRIDAY: ["Информатика", "Русский язык", "Обществознание"],
};

const SAMPLE_HOMEWORK: Record<string, string> = {
  "Математика": "§12, №45–46, выучить правило",
  "Русский язык": "Написать сочинение по теме «Осень»",
  "Физика": "Задачи 3.4, 3.5 после параграфа 7",
};

const SAMPLE_ADDITIONAL: Record<string, string> = {
  MONDAY: "Повторить формулы сокращённого умножения",
  WEDNESDAY: "Дочитать главу 4 и составить план",
  FRIDAY: "Подготовиться к контрольной по информатике",
};

async function main() {
  const monday = currentWeekStart();

  // Every weekday gets all its lesson records, so no day is ever empty.
  for (let i = 0; i < 5; i++) {
    const date = addDays(monday, i);
    const day = dayKeyFromDate(date);

    for (let n = 0; n < SCHEDULE[day].length; n++) {
      const subject = SCHEDULE[day][n];
      const lesson = await prisma.lesson.upsert({
        where: { date_lessonNumber: { date, lessonNumber: n + 1 } },
        update: { subject },
        create: { date, day, lessonNumber: n + 1, subject },
      });

      const homework = SAMPLE_HOMEWORK[subject];
      if (homework) {
        await prisma.homework.upsert({
          where: { lessonId: lesson.id },
          update: { text: homework },
          create: { lessonId: lesson.id, text: homework, createdBy: "seed" },
        });
      }
    }

    const additional = SAMPLE_ADDITIONAL[day];
    if (additional) {
      await prisma.additionalHomework.upsert({
        where: { date },
        update: { text: additional },
        create: { date, text: additional, authorId: "seed" },
      });
    }
  }

  console.log("Seed complete: current week schedule and samples created.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
