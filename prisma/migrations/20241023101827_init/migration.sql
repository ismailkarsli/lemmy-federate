-- CreateEnum
CREATE TYPE "FediseerUsage" AS ENUM ('NONE', 'BLACKLIST_ONLY', 'WHITELIST_ONLY');

-- CreateEnum
CREATE TYPE "NSFW" AS ENUM ('ALLOW', 'BLOCK', 'ONLY');

-- CreateEnum
CREATE TYPE "CommunityFollowStatus" AS ENUM ('FEDERATED_BY_USER', 'FEDERATED_BY_BOT', 'IN_PROGRESS', 'WAITING', 'ERROR', 'NOT_ALLOWED', 'NOT_AVAILABLE');

-- CreateEnum
CREATE TYPE "Software" AS ENUM ('LEMMY', 'MBIN');

-- CreateTable
CREATE TABLE "Instance" (
    "id" SERIAL NOT NULL,
    "host" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "nsfw" "NSFW" NOT NULL DEFAULT 'BLOCK',
    "fediseer" "FediseerUsage" NOT NULL DEFAULT 'BLACKLIST_ONLY',
    "auto_add" BOOLEAN NOT NULL DEFAULT false,
    "software" "Software" NOT NULL,
    "client_id" TEXT,
    "client_secret" TEXT,

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "instanceId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "code" TEXT NOT NULL,
    "codeExp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Community" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "instanceId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityFollow" (
    "id" SERIAL NOT NULL,
    "instanceId" INTEGER NOT NULL,
    "communityId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "CommunityFollowStatus" NOT NULL DEFAULT 'WAITING',

    CONSTRAINT "CommunityFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_InstanceAllows" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Instance_host_key" ON "Instance"("host");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_instanceId_key" ON "User"("username", "instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "Community_name_instanceId_key" ON "Community"("name", "instanceId");

-- CreateIndex
CREATE UNIQUE INDEX "CommunityFollow_instanceId_communityId_key" ON "CommunityFollow"("instanceId", "communityId");

-- CreateIndex
CREATE UNIQUE INDEX "_InstanceAllows_AB_unique" ON "_InstanceAllows"("A", "B");

-- CreateIndex
CREATE INDEX "_InstanceAllows_B_index" ON "_InstanceAllows"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Community" ADD CONSTRAINT "Community_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityFollow" ADD CONSTRAINT "CommunityFollow_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityFollow" ADD CONSTRAINT "CommunityFollow_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstanceAllows" ADD CONSTRAINT "_InstanceAllows_A_fkey" FOREIGN KEY ("A") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstanceAllows" ADD CONSTRAINT "_InstanceAllows_B_fkey" FOREIGN KEY ("B") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
