/*
  Warnings:

  - You are about to drop the `InstanceLog` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "InstanceLog" DROP CONSTRAINT "InstanceLog_instanceId_fkey";

-- AlterTable
ALTER TABLE "CommunityFollow" ADD COLUMN     "errorReason" TEXT;

-- DropTable
DROP TABLE "InstanceLog";
