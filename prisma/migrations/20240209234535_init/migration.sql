-- CreateEnum
CREATE TYPE "FediseerUsage" AS ENUM ('NONE', 'BLACKLIST_ONLY', 'WHITELIST_ONLY', 'FULL');

-- CreateTable
CREATE TABLE "Instance" (
    "id" SERIAL NOT NULL,
    "host" TEXT NOT NULL,
    "bot_name" TEXT NOT NULL,
    "bot_pass" TEXT NOT NULL,
    "nsfw" BOOLEAN NOT NULL,
    "fediseer" "FediseerUsage" NOT NULL DEFAULT 'BLACKLIST_ONLY',

    CONSTRAINT "Instance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "instanceId" INTEGER NOT NULL,
    "token" TEXT,
    "tokenExp" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Community" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "instanceId" INTEGER NOT NULL,

    CONSTRAINT "Community_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "_InstanceAllows_AB_unique" ON "_InstanceAllows"("A", "B");

-- CreateIndex
CREATE INDEX "_InstanceAllows_B_index" ON "_InstanceAllows"("B");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Community" ADD CONSTRAINT "Community_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstanceAllows" ADD CONSTRAINT "_InstanceAllows_A_fkey" FOREIGN KEY ("A") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstanceAllows" ADD CONSTRAINT "_InstanceAllows_B_fkey" FOREIGN KEY ("B") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
