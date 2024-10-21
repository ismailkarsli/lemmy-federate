-- CreateEnum
CREATE TYPE "Software" AS ENUM ('LEMMY', 'MBIN');

-- AlterTable
ALTER TABLE "Instance" ADD COLUMN     "software" "Software" NOT NULL DEFAULT 'LEMMY';
