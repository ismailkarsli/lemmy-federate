/*
  Warnings:

  - You are about to drop the column `software` on the `Instance` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Instance" DROP COLUMN "software";

-- DropEnum
DROP TYPE "Software";
