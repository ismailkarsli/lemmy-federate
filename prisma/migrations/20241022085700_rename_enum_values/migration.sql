/*
  Warnings:

  - The values [DONE,IN_PROGRESS_UNKNOWN] on the enum `CommunityFollowStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "CommunityFollowStatus_new" AS ENUM ('FEDERATED_BY_USER', 'FEDERATED_BY_BOT', 'IN_PROGRESS', 'WAITING', 'ERROR', 'NOT_ALLOWED', 'NOT_AVAILABLE');
ALTER TABLE "CommunityFollow" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CommunityFollow" ALTER COLUMN "status" TYPE "CommunityFollowStatus_new" USING ("status"::text::"CommunityFollowStatus_new");
ALTER TYPE "CommunityFollowStatus" RENAME TO "CommunityFollowStatus_old";
ALTER TYPE "CommunityFollowStatus_new" RENAME TO "CommunityFollowStatus";
DROP TYPE "CommunityFollowStatus_old";
ALTER TABLE "CommunityFollow" ALTER COLUMN "status" SET DEFAULT 'IN_PROGRESS';
COMMIT;
