/*
  Warnings:

  - You are about to drop the column `approved` on the `Instance` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "CommunityFollow" ADD COLUMN     "attemptCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Instance" DROP COLUMN "approved";
