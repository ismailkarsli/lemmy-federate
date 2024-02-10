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
