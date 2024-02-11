import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default defineEventHandler(async function (event) {
  const query = getQuery(event);
  const skip = parseInt(query.skip?.toString() || "0");
  const take = parseInt(query.take?.toString() || "10");
  const [communities, total] = await prisma.$transaction([
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
    }),
    prisma.community.count(),
  ]);
  return {
    communities,
    total,
  };
});
