/*
  Warnings:

  - The `nsfw` column on the `Instance` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "NSFW" AS ENUM ('ALLOW', 'BLOCK', 'ONLY');

-- AlterTable
ALTER TABLE "Instance" DROP COLUMN "nsfw",
ADD COLUMN     "nsfw" "NSFW" NOT NULL DEFAULT 'BLOCK';
