-- CreateEnum
CREATE TYPE "HomeworkStatus" AS ENUM ('PENDING', 'APPROVED');

-- AlterTable: existing homework stays visible, so default is APPROVED
ALTER TABLE "Homework" ADD COLUMN "status" "HomeworkStatus" NOT NULL DEFAULT 'APPROVED';

-- CreateTable
CREATE TABLE "AdditionalHomework" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "text" TEXT NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdditionalHomework_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdditionalHomework_date_key" ON "AdditionalHomework"("date");
