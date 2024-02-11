import {
  Community,
  CommunityFollow,
  CommunityFollowStatus,
  FediseerUsage,
  Instance,
  NSFW,
  PrismaClient,
} from "@prisma/client";
import { LemmyHttp, Login, LoginResponse } from "lemmy-js-client";
import { randomInt } from "node:crypto";
import { getCensuresGiven, getEndorsements } from "~/lib/fediseer";

const BOT_INSTANCE = process.env.BOT_INSTANCE;
const BOT_USERNAME = process.env.BOT_USERNAME;
const BOT_PASSWORD = process.env.BOT_PASSWORD;
if (!BOT_INSTANCE || !BOT_USERNAME || !BOT_PASSWORD) {
  throw new Error("BOT_INSTANCE, BOT_USERNAME, and BOT_PASSWORD are required");
}

const prisma = new PrismaClient();

export const randomNumber = (length: number) => {
  /// 100000 -> 999999
  return randomInt(Math.pow(10, length - 1), Math.pow(10, length) - 1);
};

export const sendAuthCode = async (
  username: string,
  instance: string,
  code: string
) => {
  const lemmyClient = new LemmyHttpFixed(`https://${BOT_INSTANCE}`);
  const loginRes = await lemmyClient.login({
    username_or_email: BOT_USERNAME,
    password: BOT_PASSWORD,
  });
  const personQuery = await lemmyClient.resolveObject({
    q: `https://${instance}/u/${username}`,
  });
  const person = personQuery.person?.person;
  if (!person) {
    throw createError({
      statusCode: 500,
      message: "Person not found",
    });
  }

  const message = `Your authentication code to login Lemmy Federate is: ${code}`;
  await lemmyClient.createPrivateMessage({
    content: message,
    recipient_id: person.id,
  });
};

/**
 * @param client Authenticated LemmyHttp bot client
 * @param community Target community
 */
export const conditionalFollow = async (
  communityFollow: CommunityFollow & {
    instance: Instance & {
      allowed: Instance[];
    };
    community: Community & {
      instance: Instance;
    };
  }
): Promise<CommunityFollowStatus> => {
  /**
   * If the instance has at least one allowed instance, check if the target instance is allowed.
   */
  const { instance, community } = communityFollow;
  if (instance.allowed.length) {
    const isAllowed = instance.allowed.find(
      (i) => i.id === community.instanceId
    );
    if (!isAllowed) {
      return CommunityFollowStatus.NOT_ALLOWED;
    }
  }

  if (!(instance.bot_name && instance.bot_pass) || !instance.enabled) {
    return CommunityFollowStatus.NOT_AVAILABLE;
  }
  const client = new LemmyHttpFixed(`https://${instance.host}`);
  await client.login({
    username_or_email: instance.bot_name,
    password: instance.bot_pass,
  });

  /**
   * Check if the target instance is blocked by the source instance.
   */
  const federationStatus = await client.getFederatedInstances();
  const isBlocked = federationStatus.federated_instances?.blocked.find(
    (i) => i.domain === community.instance.host
  );
  if (isBlocked) return CommunityFollowStatus.NOT_ALLOWED;

  const { community_view } = await client.getCommunity({
    name: `${community.name}@${community.instance.host}`,
  });

  /**
   * Check if the community is deleted or removed.
   */
  if (community_view.community.deleted || community_view.community.removed) {
    return CommunityFollowStatus.NOT_ALLOWED;
  }

  /**
   * Check instance's Fediseer policy.
   */
  if (instance.fediseer === FediseerUsage.BLACKLIST_ONLY) {
    const censures = await getCensuresGiven(instance.host);
    if (censures.domains.includes(community.instance.host)) {
      return CommunityFollowStatus.NOT_ALLOWED;
    }
  } else if (instance.fediseer === FediseerUsage.WHITELIST_ONLY) {
    const endorsements = await getEndorsements(community.instance.host);
    if (!endorsements.domains.includes(instance.host)) {
      return CommunityFollowStatus.NOT_ALLOWED;
    }
  }

  /**
   * Check if the community is
   * - NSFW and the instance is not allowing NSFW content.
   * - not NSFW and the instance is only allowing NSFW content.
   */
  if (
    community_view.community.nsfw
      ? instance.nsfw === NSFW.BLOCK
      : instance.nsfw === NSFW.ONLY
  ) {
    return CommunityFollowStatus.NOT_ALLOWED;
  }

  const localSubscribers = community_view.counts.subscribers_local ?? 0;

  // Community has other subscribers than the bot
  if (localSubscribers > (community_view.subscribed === "Subscribed" ? 1 : 0)) {
    await client.followCommunity({
      community_id: community_view.community.id,
      follow: false,
    });
    return CommunityFollowStatus.DONE;
  }

  // if stuck in "Pending" state, unfollow and return error. This way we can retry in next run.
  if (community_view.subscribed === "Pending") {
    await client.followCommunity({
      community_id: community_view.community.id,
      follow: false,
    });
    return CommunityFollowStatus.ERROR;
  }

  await client.followCommunity({
    community_id: community_view.community.id,
    follow: true,
  });
  return CommunityFollowStatus.IN_PROGRESS;
};

async function createCommunityFollowRecords({
  instanceIds,
  communityIds,
}: {
  instanceIds?: number[];
  communityIds?: number[];
}) {
  const instances = await prisma.instance.findMany({
    where: {
      id: {
        in: instanceIds,
      },
    },
  });
  const communities = await prisma.community.findMany({
    where: {
      id: {
        in: communityIds,
      },
    },
  });

  for (const instance of instances) {
    for (const community of communities) {
      await prisma.communityFollow.upsert({
        where: {
          instanceId_communityId: {
            instanceId: instance.id,
            communityId: community.id,
          },
        },
        update: {},
        create: {
          instance: {
            connect: {
              id: instance.id,
            },
          },
          community: {
            connect: {
              id: community.id,
            },
          },
        },
      });
    }
  }
}

export const conditionalFollowWithAllInstances = async (
  community: Community & {
    instance: Instance;
  }
) => {
  await createCommunityFollowRecords({
    communityIds: [community.id],
  });

  const communityFollows = await prisma.communityFollow.findMany({
    where: {
      communityId: community.id,
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

  for (const cf of communityFollows) {
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
  }
};

// On some functions auth token is not included in the request like /community/follow or /private_message
class LemmyHttpFixed extends LemmyHttp {
  private jwt?: string;
  constructor(
    baseUrl: string,
    options?: {
      fetchFunction?: typeof fetch;
      headers?: {
        [key: string]: string;
      };
    }
  ) {
    const fetchToUse = options?.fetchFunction || fetch;
    const fetchFunction: typeof fetch = async (url, init) => {
      return fetchToUse(url, {
        ...init,
        headers: {
          ...init?.headers,
          Authorization: `Bearer ${this.jwt}`,
        },
      });
    };

    super(baseUrl, { ...options, fetchFunction });
  }

  async login(form: Login): Promise<LoginResponse> {
    const res = await super.login(form);
    this.jwt = res.jwt;
    return res;
  }
}
