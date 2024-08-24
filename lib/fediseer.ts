import ms from "ms";

type FediseerResponse = {
  domains: string[];
};
type CachedData = FediseerResponse & {
  updatedAt: string;
};

class Cache {
  static async get(cacheKey: string) {
    const storage = useStorage("redis");
    const cached = await storage.getItem<CachedData>(cacheKey);
    if (
      cached &&
      new Date(cached.updatedAt).getTime() > Date.now() - ms("24h")
    ) {
      return cached;
    }
    return null;
  }

  static async set(cacheKey: string, data: FediseerResponse) {
    const storage = useStorage("redis");
    await storage.setItem(cacheKey, {
      ...data,
      updatedAt: new Date().toISOString(),
    });
  }
}

export const getGuarantees = async (instance: string) => {
  const cacheKey = `fediseer_guarantees:${instance}`;
  try {
    const cached = await Cache.get(cacheKey);
    if (cached) return cached;

    const guarantees = await $fetch<FediseerResponse>(
      `https://fediseer.com/api/v1/guarantees/${instance}`,
      {
        query: {
          domains: true,
        },
      }
    );
    await Cache.set(cacheKey, guarantees);
    return guarantees;
  } catch (e) {
    throw createError({
      statusCode: 500,
      message: "Failed to fetch guarantees from Fediseer",
      data: e,
    });
  }
};

export const getCensuresGiven = async (instance: string) => {
  const cacheKey = `fediseer_censures_given:${instance}`;
  try {
    const cached = await Cache.get(cacheKey);
    if (cached) return cached;
    const censures = await $fetch<FediseerResponse>(
      `https://fediseer.com/api/v1/censures_given/${instance}`,
      {
        query: {
          domains: true,
        },
      }
    );
    await Cache.set(cacheKey, censures);
    return censures;
  } catch (e) {
    throw createError({
      statusCode: 500,
      message: "Failed to fetch censures from Fediseer",
      data: e,
    });
  }
};

export const getEndorsements = async (instance: string) => {
  const cacheKey = `fediseer_endorsements:${instance}`;
  try {
    const cached = await Cache.get(cacheKey);
    if (cached) return cached;
    const endorsements = await $fetch<FediseerResponse>(
      `https://fediseer.com/api/v1/endorsements/${instance}`,
      {
        query: {
          domains: true,
        },
      }
    );
    await Cache.set(cacheKey, endorsements);
    return endorsements;
  } catch (e) {
    throw createError({
      statusCode: 500,
      message: "Failed to fetch endorsements from Fediseer",
      data: e,
    });
  }
};
