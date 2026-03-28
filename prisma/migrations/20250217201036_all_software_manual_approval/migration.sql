/*
  Warnings:

  - Changed the type of `software` on the `Instance` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "Instance" ADD COLUMN     "approved" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Instance" ALTER COLUMN "software" TYPE TEXT USING "software"::TEXT;
