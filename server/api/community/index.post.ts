import { PrismaClient } from "@prisma/client";
import { LemmyHttp } from "lemmy-js-client";
import { conditionalFollowWithAllInstances } from "~/server/utils";

const prisma = new PrismaClient();

export default defineEventHandler(async function (event) {
  const body = await readBody(event);
  // remove ! prefix if present
  const symbol = body?.community?.replace(/^!/, "")?.trim();

  if (!symbol) {
    throw createError({
      status: 400,
      message: "Community is required",
    });
  }

  const [name, host] = symbol.split("@");
  if (!name || !host) {
    throw createError({
      status: 400,
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
    throw createError({
      status: 400,
      message: "Instance is not registered on the server.",
    });
  }

  try {
    const lemmyClient = new LemmyHttp("https://" + host);
    const communityViewResponse = await lemmyClient.getCommunity({ name });
    const community = communityViewResponse?.community_view.community;
    if (!community) {
      throw "Community not found on the instance.";
    }
    if (community.deleted || community.removed) {
      throw "Community is deleted or removed on the instance.";
    }
  } catch (error) {
    throw createError({
      status: 400,
      message: "Community not found on the instance. " + error,
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
    update: {},
    include: {
      instance: true,
    },
  });

  conditionalFollowWithAllInstances(addedCommunity);

  return {
    message: "Community added successfully",
  };
});
