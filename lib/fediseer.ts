export const getGuarantees = async (instance: string) => {
  try {
    const guarantees = await $fetch<{ domains: string[] }>(
      `https://fediseer.com/api/v1/guarantees/${instance}`,
      {
        query: {
          domains: true,
        },
      }
    );
    return guarantees;
  } catch (e) {
    throw createError({
      statusCode: 500,
      message: "Failed to fetch guarantees from Fediseer",
    });
  }
};

export const getCensuresGiven = async (instance: string) => {
  try {
    const censures = await $fetch<{ domains: string[] }>(
      `https://fediseer.com/api/v1/censures_given/${instance}`,
      {
        query: {
          domains: true,
        },
      }
    );
    return censures;
  } catch (e) {
    throw createError({
      statusCode: 500,
      message: "Failed to fetch censures from Fediseer",
    });
  }
};

export const getEndorsements = async (instance: string) => {
  try {
    const endorsements = await $fetch<{ domains: string[] }>(
      `https://fediseer.com/api/v1/endorsements/${instance}`,
      {
        query: {
          domains: true,
        },
      }
    );
    return endorsements;
  } catch (e) {
    throw createError({
      statusCode: 500,
      message: "Failed to fetch endorsements from Fediseer",
    });
  }
};
