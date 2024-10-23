import { CommunityFollowStatus, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import typia from "typia";
import {
	conditionalFollowWithAllInstances,
	getClient,
} from "../lib/federation-utils";
import { publicProcedure, router } from "../trpc";

const prisma = new PrismaClient();

interface FindArgs {
	take?: number;
	skip?: number;
	instanceId?: number;
}

export const communityRouter = router({
	add: publicProcedure
		.input(typia.createAssert<{ community: string }>())
		.mutation(async ({ input }) => {
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

			const instance = await prisma.instance.findUnique({
				where: {
					host,
				},
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

			const client = getClient(instance);
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

			const addedCommunity = await prisma.community.upsert({
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
					instance: true,
				},
			});

			await prisma.communityFollow.updateMany({
				where: {
					community: addedCommunity,
				},
				data: {
					status: CommunityFollowStatus.WAITING,
				},
			});

			conditionalFollowWithAllInstances(addedCommunity);

			return {
				message: "Community added successfully",
			};
		}),
	find: publicProcedure
		.input(typia.createAssert<FindArgs>())
		.query(async ({ input }) => {
			const skip = Number.parseInt(input.skip?.toString() || "0");
			const take = Number.parseInt(input.take?.toString() || "10");
			const [communities, communityCount, instanceCount, stats] =
				await prisma.$transaction([
					prisma.community.findMany({
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
					prisma.community.count({ where: { instanceId: input.instanceId } }),
					prisma.instance.count({
						where: {
							enabled: true,
						},
					}),
					prisma.$queryRaw`SELECT count(CASE WHEN cf.status = 'FEDERATED_BY_USER' THEN 1 ELSE NULL end)::int as completed, count(CASE WHEN cf.status IN ('FEDERATED_BY_BOT', 'IN_PROGRESS') THEN 1 ELSE NULL end)::int as inprogress from "CommunityFollow" cf`,
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
