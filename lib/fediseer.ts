export const getGuarantees = async (instance: string) => {
  const storage = useStorage("redis");
  const cached = await storage.getItem<{ domains: string[] }>(
    `fediseer_guarantees-${instance}`
  );
  if (cached) return cached;
  try {
    const guarantees = await $fetch<{ domains: string[] }>(
      `https://fediseer.com/api/v1/guarantees/${instance}`,
      {
        query: {
          domains: true,
        },
      }
    );
    await storage.setItem(`guarantees-${instance}`, guarantees);
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
  try {
    const storage = useStorage("redis");
    const cached = await storage.getItem<{ domains: string[] }>(
      `fediseer_censures_given-${instance}`
    );
    if (cached) return cached;
    const censures = await $fetch<{ domains: string[] }>(
      `https://fediseer.com/api/v1/censures_given/${instance}`,
      {
        query: {
          domains: true,
        },
      }
    );
    await storage.setItem(`censures-${instance}`, censures);
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
  try {
    const storage = useStorage("redis");
    const cached = await storage.getItem<{ domains: string[] }>(
      `fediseer_endorsements-${instance}`
    );
    if (cached) return cached;
    const endorsements = await $fetch<{ domains: string[] }>(
      `https://fediseer.com/api/v1/endorsements/${instance}`,
      {
        query: {
          domains: true,
        },
      }
    );
    await storage.setItem(`endorsements-${instance}`, endorsements);
    return endorsements;
  } catch (e) {
    throw createError({
      statusCode: 500,
      message: "Failed to fetch endorsements from Fediseer",
      data: e,
    });
  }
};
