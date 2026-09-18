-- Add pending moderation to "AdditionalHomework": submissions made while
-- the AI was down wait in `pendingText` for admin approval, like homework.
ALTER TABLE "AdditionalHomework" ADD COLUMN "pendingText" TEXT;
ALTER TABLE "AdditionalHomework" ADD COLUMN "pendingAuthorId" TEXT;
ALTER TABLE "AdditionalHomework" ADD COLUMN "status" "HomeworkStatus" NOT NULL DEFAULT 'APPROVED';
