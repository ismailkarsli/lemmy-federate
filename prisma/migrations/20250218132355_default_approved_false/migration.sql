-- AlterTable
ALTER TABLE "Instance" ALTER COLUMN "approved" SET DEFAULT false;

-- AlterTable
ALTER TABLE "_InstanceAllows" ADD CONSTRAINT "_InstanceAllows_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_InstanceAllows_AB_unique";

-- AlterTable
ALTER TABLE "_InstanceBlocks" ADD CONSTRAINT "_InstanceBlocks_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_InstanceBlocks_AB_unique";
