import { PrismaClient } from "@prisma/client";
import { UPK_HOMEWORK_TEXT, lessonsForDay } from "../src/config/schedule";
import { addDays, currentWeekStart, dayKeyFromDate } from "../src/lib/weeks";

const prisma = new PrismaClient();

async function main() {
  const monday = currentWeekStart();

  // Seed only the current week from the shared template — previous and next
  // weeks are created on demand by the lazy-creation logic in the service.
  for (let i = 0; i < 5; i++) {
    const date = addDays(monday, i);
    const day = dayKeyFromDate(date);

    for (const slot of lessonsForDay(day)) {
      await prisma.lesson.upsert({
        where: {
          date_lessonNumber_subject: {
            date,
            lessonNumber: slot.lessonNumber,
            subject: slot.subject,
          },
        },
        update: { subject: slot.subject },
        create: {
          date,
          day,
          lessonNumber: slot.lessonNumber,
          subject: slot.subject,
        },
      });
    }
  }

  // The Wednesday УПК lesson is the only one that ships with homework.
  const upkLesson = await prisma.lesson.findFirst({
    where: {
      date: addDays(monday, 2),
      subject: { contains: "УПК" },
    },
  });
  if (upkLesson) {
    await prisma.homework.upsert({
      where: { lessonId: upkLesson.id },
      update: { text: UPK_HOMEWORK_TEXT },
      create: {
        lessonId: upkLesson.id,
        text: UPK_HOMEWORK_TEXT,
        status: "APPROVED",
        createdBy: "seed",
      },
    });
  }

  console.log("Seed complete: current week schedule created (УПК homework included).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
