-- CreateTable
CREATE TABLE "InstanceLog" (
    "id" SERIAL NOT NULL,
    "instanceId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstanceLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InstanceLog" ADD CONSTRAINT "InstanceLog_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
