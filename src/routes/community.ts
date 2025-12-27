import { CommunityFollowStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import * as z from "zod/v4";
import {
	conditionalFollowWithAllInstances,
	getClient,
} from "../lib/federation-utils.ts";
import { publicProcedure, router } from "../trpc.ts";

const FindArgsSchema = z.object({
	take: z.number().min(1).max(100).optional(),
	skip: z.number().min(0).optional(),
	instanceId: z.number().optional(),
});

export const communityRouter = router({
	add: publicProcedure
		.input(
			z.object({
				community: z.string(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			// remove ! prefix if present
			const symbol = input?.community?.replace(/^!/, "")?.trim();

			if (!symbol) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Community is required",
				});
			}

			const [name, host] = symbol.toLowerCase().split("@");
			if (!name || !host) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message:
						"Invalid community name. It should be in 'community@instance' format.",
				});
			}

			const instance = await ctx.prisma.instance.findUnique({
				where: {
					host,
				},
				omit: { client_id: false, client_secret: false },
			});
			if (!instance) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Instance is not registered.",
				});
			}
			if (!instance.enabled) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Instance is disabled. Please contact your admin.",
				});
			}

			const client = await getClient(instance, ctx.kv);
			const community = await client.getCommunity(name);
			if (!community) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Community not found on the instance.",
				});
			}
			if (community.isDeleted || community.isRemoved) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Community is deleted or removed on the instance.",
				});
			}
			if (!community.public) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Community is local only on the instance.",
				});
			}

			const addedCommunity = await ctx.prisma.community.upsert({
				where: {
					name_instanceId: {
						name,
						instanceId: instance.id,
					},
				},
				create: {
					name,
					instance: {
						connect: {
							host,
						},
					},
				},
				update: {
					createdAt: new Date(),
					updatedAt: new Date(),
				},
				include: {
					instance: {
						omit: { client_id: false, client_secret: false },
					},
				},
			});

			await ctx.prisma.communityFollow.updateMany({
				where: {
					community: addedCommunity,
				},
				data: {
					status: CommunityFollowStatus.WAITING,
				},
			});

			conditionalFollowWithAllInstances(addedCommunity, ctx.prisma, ctx.kv);

			return {
				message: "Community added successfully",
			};
		}),
	find: publicProcedure.input(FindArgsSchema).query(async ({ input, ctx }) => {
		const skip = Number.parseInt(input.skip?.toString() || "0");
		const take = Number.parseInt(input.take?.toString() || "10");
		const [communities, communityCount, instanceCount, stats] =
			await Promise.all([
				ctx.prisma.community.findMany({
					include: {
						instance: {
							select: {
								id: true,
								host: true,
							},
						},
						follows: {
							include: {
								instance: {
									select: {
										id: true,
										host: true,
									},
								},
							},
						},
					},
					skip,
					take,
					orderBy: { createdAt: "desc" },
					where: { instanceId: input.instanceId },
				}),
				ctx.prisma.community.count({ where: { instanceId: input.instanceId } }),
				ctx.prisma.instance.count({
					where: { enabled: true },
				}),
				// SQLite-compatible query (replaced PostgreSQL ::int cast)
				ctx.prisma.$queryRaw`SELECT 
					CAST(SUM(CASE WHEN cf.status = 'FEDERATED_BY_USER' THEN 1 ELSE 0 END) AS INTEGER) as completed, 
					CAST(SUM(CASE WHEN cf.status IN ('FEDERATED_BY_BOT', 'IN_PROGRESS') THEN 1 ELSE 0 END) AS INTEGER) as inprogress 
				FROM "CommunityFollow" cf`,
			]);

		return {
			communities,
			stats: {
				communityCount,
				instanceCount,
				...(stats as Array<object>).at(0),
			} as {
				communityCount: number;
				instanceCount: number;
				completed: number;
				inprogress: number;
			},
		};
	}),
});
