/*
  Warnings:

  - You are about to drop the column `token` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `tokenExp` on the `User` table. All the data in the column will be lost.
  - Added the required column `code` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `codeExp` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "token",
DROP COLUMN "tokenExp",
ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "codeExp" TIMESTAMP(3) NOT NULL;
