-- Split subjects: allow two groups (Веренич / не Веренич) of the same subject
-- to occupy the same schedule slot, each with its own homework.

-- 1. Relax the per-slot uniqueness to include the subject name.
ALTER TABLE "Lesson" DROP CONSTRAINT "Lesson_date_lessonNumber_key";
ALTER TABLE "Lesson" ADD CONSTRAINT "Lesson_date_lessonNumber_subject_key" UNIQUE ("date", "lessonNumber", "subject");

-- 2. Rename existing split-subject lessons to the (Веренич) variant.
UPDATE "Lesson" SET "subject" = 'Английский язык (Веренич)' WHERE "subject" = 'Английский язык';
UPDATE "Lesson" SET "subject" = 'Информатика (Веренич)' WHERE "subject" = 'Информатика';

-- 3. Create the (не Веренич) twin lesson in the same slot.
INSERT INTO "Lesson" ("date", "day", "lessonNumber", "subject")
SELECT "date", "day", "lessonNumber", 'Английский язык (не Веренич)'
FROM "Lesson" WHERE "subject" = 'Английский язык (Веренич)';

INSERT INTO "Lesson" ("date", "day", "lessonNumber", "subject")
SELECT "date", "day", "lessonNumber", 'Информатика (не Веренич)'
FROM "Lesson" WHERE "subject" = 'Информатика (Веренич)';

-- 4. Copy existing homework (including pending submissions) to the twins so
-- students keep seeing the assignment they already had.
INSERT INTO "Homework" ("lessonId", "text", "pendingText", "pendingCreatedBy", "status", "createdBy")
SELECT twin."id", h."text", h."pendingText", h."pendingCreatedBy", h."status", h."createdBy"
FROM "Lesson" orig
JOIN "Homework" h ON h."lessonId" = orig."id"
JOIN "Lesson" twin
  ON twin."date" = orig."date"
 AND twin."lessonNumber" = orig."lessonNumber"
 AND twin."subject" = 'Английский язык (не Веренич)'
WHERE orig."subject" = 'Английский язык (Веренич)';

INSERT INTO "Homework" ("lessonId", "text", "pendingText", "pendingCreatedBy", "status", "createdBy")
SELECT twin."id", h."text", h."pendingText", h."pendingCreatedBy", h."status", h."createdBy"
FROM "Lesson" orig
JOIN "Homework" h ON h."lessonId" = orig."id"
JOIN "Lesson" twin
  ON twin."date" = orig."date"
 AND twin."lessonNumber" = orig."lessonNumber"
 AND twin."subject" = 'Информатика (не Веренич)'
WHERE orig."subject" = 'Информатика (Веренич)';
