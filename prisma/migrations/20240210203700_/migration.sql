/*
  Warnings:

  - A unique constraint covering the columns `[instanceId,communityId]` on the table `CommunityFollow` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "CommunityFollow_instanceId_communityId_key" ON "CommunityFollow"("instanceId", "communityId");
