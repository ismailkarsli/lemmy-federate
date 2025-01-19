-- CreateTable
CREATE TABLE "_InstanceBlocks" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "_InstanceBlocks_AB_unique" ON "_InstanceBlocks"("A", "B");

-- CreateIndex
CREATE INDEX "_InstanceBlocks_B_index" ON "_InstanceBlocks"("B");

-- AddForeignKey
ALTER TABLE "_InstanceBlocks" ADD CONSTRAINT "_InstanceBlocks_A_fkey" FOREIGN KEY ("A") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InstanceBlocks" ADD CONSTRAINT "_InstanceBlocks_B_fkey" FOREIGN KEY ("B") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
