import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
	const query = getQuery(event);
	const skip = Number.parseInt(query.skip?.toString() || "0");
	const take = Number.parseInt(query.take?.toString() || "10");
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
		stats: { communityCount, instanceCount, ...stats.at(0) } as {
			communityCount: number;
			instanceCount: number;
			completed: number;
			inprogress: number;
		},
	};
});
