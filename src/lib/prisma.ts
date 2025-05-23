import {
	FediseerUsage,
	type Instance,
	Mode,
	NSFW,
	PrismaClient,
	type User,
} from "@prisma/client";
import { z } from "zod/v4";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
	globalForPrisma.prisma ||
	new PrismaClient({
		omit: { instance: { client_id: true, client_secret: true } },
	});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Prisma Zod Schemas
 */
export const NSFWSchema = z.enum(Object.values(NSFW));
export const FediseerUsageSchema = z.enum(Object.values(FediseerUsage));
export const FederationModeSchema = z.enum(Object.values(Mode));

export const InstanceSchema = z.object({
	id: z.number(),
	host: z.string(),
	enabled: z.boolean(),
	nsfw: NSFWSchema,
	fediseer: FediseerUsageSchema,
	auto_add: z.boolean(),
	software: z.string(),
	client_id: z.string().nullable(),
	client_secret: z.string().nullable(),
	cross_software: z.boolean(),
	mode: FederationModeSchema,
	approved: z.boolean(),
}) satisfies z.ZodType<Instance>;

export const UserSchema = z.object({
	id: z.number(),
	username: z.string(),
	instanceId: z.number(),
	createdAt: z.date(),
	updatedAt: z.date(),
	code: z.string(),
	codeExp: z.date(),
}) satisfies z.ZodType<User>;
