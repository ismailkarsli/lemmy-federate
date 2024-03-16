import { useScheduler } from "#scheduler";
import { PrismaClient } from "@prisma/client";
import { conditionalFollow } from "@/server/utils";

const prisma = new PrismaClient();

export default defineNitroPlugin(() => {
  startScheduler();
});

function startScheduler() {
  const scheduler = useScheduler();

  scheduler.run(updateFollows).everyDays(7);
  scheduler.run(addCommunities).everyDays(7);
}

async function updateFollows() {
  const recordCount = await prisma.communityFollow.count();
  console.info("Started updating", recordCount, "community follows");
  for (let i = 0; i < recordCount; i += 100) {
    const communityFollows = await prisma.communityFollow.findMany({
      skip: i,
      take: 100,
      where: {
        status: {
          in: ["NOT_AVAILABLE", "IN_PROGRESS", "ERROR"],
        },
      },
      include: {
        instance: {
          include: {
            allowed: true,
          },
        },
        community: {
          include: {
            instance: true,
          },
        },
      },
    });

    await Promise.all(
      communityFollows.map(async (cf) => {
        try {
          const status = await conditionalFollow(cf);
          await prisma.communityFollow.update({
            where: {
              id: cf.id,
            },
            data: {
              status,
            },
          });
        } catch (e) {
          console.error("Error while following community", cf.instance.host, e);
        }
      })
    );
  }
  console.info("Finished updating community follows");
}

async function addCommunities() {
  console.info("Started adding communities automatically");
  const instances = await prisma.instance.findMany({
    where: {
      enabled: true,
      auto_add: true,
    },
  });
  const instanceIdMap = Object.fromEntries(
    instances.map((i) => [i.host, i.id])
  );

  const pageCount = await fetch(
    "https://data.lemmyverse.net/data/community.json"
  )
    .then((r) => r.json())
    .then((r) => r.count);

  if (!pageCount) {
    throw new Error("No page count found");
  }

  for (let i = 0; i < pageCount; i++) {
    const communities = (await fetch(
      `https://lemmyverse.net/data/community/${i}.json`
    ).then((r) => r.json())) as {
      baseurl: string;
      name: string;
      isSuspicious: boolean;
    }[];

    await Promise.all(
      communities.map(async (c) => {
        if (c.isSuspicious) return;
        const instanceId = instanceIdMap[c.baseurl];
        if (!instanceId) return;
        await prisma.community.upsert({
          where: {
            name_instanceId: {
              name: c.name,
              instanceId,
            },
          },
          update: {},
          create: {
            name: c.name,
            instanceId,
          },
        });
      })
    );
  }

  console.info("Finished adding communities automatically");
}
