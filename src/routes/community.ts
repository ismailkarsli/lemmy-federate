import { CommunityFollowStatus, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import typia from "typia";
import { conditionalFollowWithAllInstances, getHttpClient } from "../lib/lemmy";
import { publicProcedure, router } from "../trpc";

const prisma = new PrismaClient();

interface FindArgs {
	take?: number;
	skip?: number;
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

			try {
				const lemmyClient = await getHttpClient(host);
				const communityViewResponse = await lemmyClient.getCommunity({ name });
				const community = communityViewResponse?.community_view.community;
				if (!community) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Community not found on the instance.",
					});
				}
				if (community.deleted || community.removed) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Community is deleted or removed on the instance.",
					});
				}
				if (community.visibility === "LocalOnly") {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: "Community is local only on the instance.",
					});
				}
			} catch (error) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Community not found on the instance. ${error}`,
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
					status: CommunityFollowStatus.IN_PROGRESS,
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
						orderBy: {
							createdAt: "desc",
						},
					}),
					prisma.community.count(),
					prisma.instance.count({
						where: {
							enabled: true,
						},
					}),
					prisma.$queryRaw`SELECT count(CASE WHEN cf.status = 'DONE' THEN 1 ELSE NULL end)::int as completed, count(CASE WHEN cf.status = 'IN_PROGRESS' THEN 1 ELSE NULL end)::int as inprogress from "CommunityFollow" cf`,
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
