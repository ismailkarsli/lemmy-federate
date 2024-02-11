-- CreateEnum
CREATE TYPE "CommunityFollowStatus" AS ENUM ('DONE', 'IN_PROGRESS', 'ERROR', 'NOT_ALLOWED');

-- DropForeignKey
ALTER TABLE "Community" DROP CONSTRAINT "Community_instanceId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_instanceId_fkey";

-- CreateTable
CREATE TABLE "CommunityFollow" (
    "id" SERIAL NOT NULL,
    "instanceId" INTEGER NOT NULL,
    "communityId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "status" "CommunityFollowStatus" NOT NULL DEFAULT 'IN_PROGRESS',

    CONSTRAINT "CommunityFollow_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Community" ADD CONSTRAINT "Community_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityFollow" ADD CONSTRAINT "CommunityFollow_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityFollow" ADD CONSTRAINT "CommunityFollow_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;
