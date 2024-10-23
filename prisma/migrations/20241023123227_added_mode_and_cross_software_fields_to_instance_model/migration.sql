-- CreateEnum
CREATE TYPE "Mode" AS ENUM ('FULL', 'SEED', 'LEECH');

-- AlterTable
ALTER TABLE "Instance" ADD COLUMN     "cross_software" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mode" "Mode" NOT NULL DEFAULT 'FULL';
