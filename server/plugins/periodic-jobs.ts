import { CommunityFollowStatus, Prisma, PrismaClient } from "@prisma/client";
import {
  conditionalFollow,
  sleep,
  unfollowWithAllInstances,
} from "@/server/utils";
import ms from "ms";
import type { LemmyErrorType, Login } from "lemmy-js-client";

const prisma = new PrismaClient();

export default defineNitroPlugin(async () => {
  loop(updateFollows, ms("1 day"));
  loop(addCommunities, ms("1 minute")); // fetch newest communities directly from instances
  loop(addCommunitiesFromLemmyverse, ms("1 day"));
  loop(clearRemovedCommunities, ms("1 day"));
});

const loop = async (callback: () => void, timeout = 0) => {
  while (true) {
    await callback();
    await sleep(timeout);
  }
};

async function updateFollows() {
  const filter = {
    status: {
      in: ["NOT_AVAILABLE", "IN_PROGRESS", "ERROR"],
    },
  } satisfies Prisma.CommunityFollowWhereInput;
  const recordCount = await prisma.communityFollow.count({
    where: filter,
  });
  console.info("Started updating", recordCount, "community follows");
  for (let i = 0; i < recordCount; i += 100) {
    const communityFollows = await prisma.communityFollow.findMany({
      skip: i,
      take: 100,
      where: filter,
      include: {
        instance: {
          include: {
            allowed: true,
          },
        },
        community: {
          include: {
            instance: {
              include: {
                allowed: {
                  select: {
                    id: true,
                  },
                },
              },
            },
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
          console.error(
            `Error while following community periodically ${cf.community.name}@${cf.community.instance.host} from ${cf.instance.host}`,
            e
          );
          await prisma.communityFollow.update({
            where: { id: cf.id },
            data: { status: CommunityFollowStatus.ERROR },
          });
        }
      })
    );
  }
  console.info("Finished updating community follows");
}

async function addCommunities() {
  console.info("Adding communities");
  const instances = await prisma.instance.findMany({
    where: {
      enabled: true,
      auto_add: true,
      bot_name: { not: null },
      bot_pass: { not: null },
    },
  });

  for (const instance of instances) {
    try {
      const client = await getHttpClient(instance.host, {
        username_or_email: instance.bot_name!,
        password: instance.bot_pass!,
      });

      const { communities } = await client.listCommunities({
        type_: "Local",
        sort: "New",
        page: 1,
        limit: 50,
      });

      for (const c of communities) {
        const exists = await prisma.community.count({
          where: {
            name: c.community.name.toLowerCase(),
            instanceId: instance.id,
          },
        });
        if (!exists) {
          const addedCommunity = await prisma.community.create({
            data: {
              name: c.community.name.toLowerCase(),
              instanceId: instance.id,
            },
            include: {
              instance: true,
            },
          });
          conditionalFollowWithAllInstances(addedCommunity);
        }
      }
    } catch (error) {
      console.error(
        `Error while adding communities from ${instance.host}`,
        error
      );
    }
  }

  console.info("Finished adding communities");
}

async function addCommunitiesFromLemmyverse() {
  console.info("Adding communities from Lemmyverse");
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
              name: c.name.toLowerCase(),
              instanceId,
            },
          },
          update: {},
          create: {
            name: c.name.toLowerCase(),
            instanceId,
          },
        });
      })
    );
  }

  console.info("Finished adding communities from Lemmyverse");
}

async function clearRemovedCommunities() {
  console.info("Clearing removed communities");
  const communities = await prisma.community.findMany({
    include: {
      instance: true,
    },
  });

  let count = 0;
  for (const community of communities) {
    let remove = false;
    try {
      const loginForm: Login | undefined =
        community.instance.bot_name && community.instance.bot_pass
          ? {
              username_or_email: community.instance.bot_name,
              password: community.instance.bot_pass,
            }
          : undefined;
      const client = await getHttpClient(community.instance.host, loginForm);
      const { community_view } = await client.getCommunity({
        name: community.name,
      });
      // if the community is deleted/removed by user/admin or is local only, delete it
      if (
        community_view.community.removed ||
        community_view.community.deleted ||
        community_view.community.visibility === "LocalOnly"
      ) {
        remove = true;
      }
    } catch (e) {
      // remove if we get "couldnt_find_community" error
      if (
        e instanceof Error &&
        e.message ===
          ("couldnt_find_community" satisfies LemmyErrorType["error"])
      ) {
        remove = true;
      }
    }
    if (remove) {
      await unfollowWithAllInstances(community);
      await prisma.community.delete({
        where: {
          id: community.id,
        },
      });
      count++;
    }
  }
  console.info(`Cleared ${count} communities`);
}
