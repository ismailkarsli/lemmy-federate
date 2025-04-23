/*
  Warnings:

  - The `content` column on the `InstanceLog` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `message` to the `InstanceLog` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "InstanceLog" ADD COLUMN     "message" TEXT NOT NULL,
DROP COLUMN "content",
ADD COLUMN     "content" JSONB;
