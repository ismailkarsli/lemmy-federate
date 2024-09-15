import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default defineEventHandler(async (event) => {
	const query = getQuery(event);
	const skip = query.skip ? Number.parseInt(query.skip.toString()) : undefined;
	const take = query.take ? Number.parseInt(query.take.toString()) : undefined;
	const [instances, total] = await prisma.$transaction([
		prisma.instance.findMany({
			select: {
				id: true,
				host: true,
				enabled: true,
				auto_add: true,
			},
			skip,
			take,
			orderBy: [
				{
					enabled: "desc",
				},
				{
					id: "asc",
				},
			],
		}),
		prisma.instance.count(),
	]);
	return {
		instances,
		total,
	};
});
