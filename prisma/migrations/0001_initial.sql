-- Migration: Initial schema for lemmy-federate D1 database
-- This creates the same schema as the Prisma schema but for SQLite/D1

-- Instance table
CREATE TABLE IF NOT EXISTS "Instance" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "host" TEXT NOT NULL UNIQUE,
    "enabled" INTEGER NOT NULL DEFAULT 0,
    "nsfw" TEXT NOT NULL DEFAULT 'BLOCK',
    "fediseer" TEXT NOT NULL DEFAULT 'BLACKLIST_ONLY',
    "auto_add" INTEGER NOT NULL DEFAULT 1,
    "software" TEXT NOT NULL,
    "client_id" TEXT,
    "client_secret" TEXT,
    "cross_software" INTEGER NOT NULL DEFAULT 1,
    "mode" TEXT NOT NULL DEFAULT 'FULL'
);

-- Verification table
CREATE TABLE IF NOT EXISTS "Verification" (
    "instanceId" INTEGER NOT NULL,
    "privateKey" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("instanceId", "privateKey"),
    FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE
);

-- Community table
CREATE TABLE IF NOT EXISTS "Community" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "instanceId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE,
    UNIQUE ("name", "instanceId")
);

-- CommunityFollow table
CREATE TABLE IF NOT EXISTS "CommunityFollow" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "instanceId" INTEGER NOT NULL,
    "communityId" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'WAITING',
    "errorReason" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE,
    FOREIGN KEY ("communityId") REFERENCES "Community"("id") ON DELETE CASCADE,
    UNIQUE ("instanceId", "communityId")
);

-- Junction table for Instance allowed relationship (many-to-many self-relation)
CREATE TABLE IF NOT EXISTS "_InstanceAllows" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    FOREIGN KEY ("A") REFERENCES "Instance"("id") ON DELETE CASCADE,
    FOREIGN KEY ("B") REFERENCES "Instance"("id") ON DELETE CASCADE,
    UNIQUE ("A", "B")
);

-- Junction table for Instance blocked relationship (many-to-many self-relation)
CREATE TABLE IF NOT EXISTS "_InstanceBlocks" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    FOREIGN KEY ("A") REFERENCES "Instance"("id") ON DELETE CASCADE,
    FOREIGN KEY ("B") REFERENCES "Instance"("id") ON DELETE CASCADE,
    UNIQUE ("A", "B")
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "Instance_host_idx" ON "Instance"("host");
CREATE INDEX IF NOT EXISTS "Community_instanceId_idx" ON "Community"("instanceId");
CREATE INDEX IF NOT EXISTS "CommunityFollow_instanceId_idx" ON "CommunityFollow"("instanceId");
CREATE INDEX IF NOT EXISTS "CommunityFollow_communityId_idx" ON "CommunityFollow"("communityId");
CREATE INDEX IF NOT EXISTS "CommunityFollow_status_idx" ON "CommunityFollow"("status");
CREATE INDEX IF NOT EXISTS "_InstanceAllows_A_idx" ON "_InstanceAllows"("A");
CREATE INDEX IF NOT EXISTS "_InstanceAllows_B_idx" ON "_InstanceAllows"("B");
CREATE INDEX IF NOT EXISTS "_InstanceBlocks_A_idx" ON "_InstanceBlocks"("A");
CREATE INDEX IF NOT EXISTS "_InstanceBlocks_B_idx" ON "_InstanceBlocks"("B");
