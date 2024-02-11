/*
  Warnings:

  - The values [FULL] on the enum `FediseerUsage` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "FediseerUsage_new" AS ENUM ('NONE', 'BLACKLIST_ONLY', 'WHITELIST_ONLY');
ALTER TABLE "Instance" ALTER COLUMN "fediseer" DROP DEFAULT;
ALTER TABLE "Instance" ALTER COLUMN "fediseer" TYPE "FediseerUsage_new" USING ("fediseer"::text::"FediseerUsage_new");
ALTER TYPE "FediseerUsage" RENAME TO "FediseerUsage_old";
ALTER TYPE "FediseerUsage_new" RENAME TO "FediseerUsage";
DROP TYPE "FediseerUsage_old";
ALTER TABLE "Instance" ALTER COLUMN "fediseer" SET DEFAULT 'BLACKLIST_ONLY';
COMMIT;
