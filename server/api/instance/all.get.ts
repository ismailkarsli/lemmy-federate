import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default defineEventHandler(async function (event) {
  const query = getQuery(event);
  const skip = query.skip ? parseInt(query.skip.toString()) : undefined;
  const take = query.take ? parseInt(query.take.toString()) : undefined;
  const [instances, total] = await prisma.$transaction([
    prisma.instance.findMany({
      select: {
        id: true,
        host: true,
        enabled: true,
        nsfw: true,
        auto_add: true,
        fediseer: true,
        allowed: {
          select: {
            id: true,
            host: true,
          },
        },
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
