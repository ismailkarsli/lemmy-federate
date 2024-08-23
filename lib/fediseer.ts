import ms from "ms";

type FediseerResponse = {
  domains: string[];
};
// Storing error to avoid spamming the API
type CachedData =
  | {
      domains: string[];
      updatedAt: string;
    }
  | {
      error: string;
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

  static async set(
    cacheKey: string,
    data: FediseerResponse | { error: string }
  ) {
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
    if (cached) {
      if ("domains" in cached) return cached;
      else throw new Error(cached.error);
    }
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
    if (e instanceof Error) {
      Cache.set(cacheKey, { error: e.message });
    }
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
    if (cached) {
      if ("domains" in cached) return cached;
      else throw new Error(cached.error);
    }
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
    if (e instanceof Error) {
      Cache.set(cacheKey, { error: e.message });
    }
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
    if (cached) {
      if ("domains" in cached) return cached;
      else throw new Error(cached.error);
    }
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
    if (e instanceof Error) {
      Cache.set(cacheKey, { error: e.message });
    }
    throw createError({
      statusCode: 500,
      message: "Failed to fetch endorsements from Fediseer",
      data: e,
    });
  }
};
