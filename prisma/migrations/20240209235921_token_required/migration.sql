/*
  Warnings:

  - Made the column `token` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `tokenExp` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "User" ALTER COLUMN "token" SET NOT NULL,
ALTER COLUMN "tokenExp" SET NOT NULL;
