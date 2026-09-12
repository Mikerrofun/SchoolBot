-- Add pending-review columns to Homework.
-- `text` stays the approved, student-visible assignment; differing
-- submissions now land in `pendingText` instead of overwriting `text`.

ALTER TABLE "Homework" ADD COLUMN "pendingText" TEXT;
ALTER TABLE "Homework" ADD COLUMN "pendingCreatedBy" TEXT;

-- Backfill: rows that were PENDING under the old model hold an unapproved
-- text in `text` (the previously approved text was already overwritten).
-- Copy it into `pendingText` so admins can still approve or reject it.
UPDATE "Homework" SET "pendingText" = "text", "pendingCreatedBy" = "createdBy"
WHERE status = 'PENDING';
