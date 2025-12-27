import { PrismaD1 } from "@prisma/adapter-d1";
import {
	FediseerUsage,
	type Instance,
	Mode,
	NSFW,
	PrismaClient,
} from "@prisma/client";
import { z } from "zod/v4";

// We can't use global caching in Workers (each request is isolated)
// Instead, we create a new client per request
export function getPrisma(env: CloudflareBindings): PrismaClient {
	const adapter = new PrismaD1(env.DB);
	// Note: The 'omit' option at client level causes type issues with D1 adapter
	// We'll handle omitting fields at query level instead
	const client = new PrismaClient({
		adapter,
	});

	return client;
}

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
}) satisfies z.ZodType<Instance>;
