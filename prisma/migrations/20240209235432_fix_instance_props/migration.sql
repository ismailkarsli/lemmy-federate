-- AlterTable
ALTER TABLE "Instance" ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "bot_name" DROP NOT NULL,
ALTER COLUMN "bot_pass" DROP NOT NULL,
ALTER COLUMN "nsfw" SET DEFAULT false;
