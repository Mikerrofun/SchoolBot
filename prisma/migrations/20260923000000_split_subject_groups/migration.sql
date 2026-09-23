-- Split subjects: allow two groups (Веренич / не Веренич) of the same subject
-- to occupy the same schedule slot, each with its own homework.
-- No data backfill: the database is re-seeded from the static schedule config.

ALTER TABLE "Lesson" DROP CONSTRAINT "Lesson_date_lessonNumber_key";
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_date_lessonNumber_subject_key" UNIQUE ("date", "lessonNumber", "subject");
