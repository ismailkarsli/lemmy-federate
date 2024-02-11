import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default defineEventHandler(async function (event) {
  const user = event.context.auth;
  if (!user) {
    throw createError({
      status: 401,
      message: "Unauthorized",
    });
  }

  const body = await readBody(event);
  const instanceId = parseInt(body.instanceId);
  if (!instanceId) {
    throw createError({
      status: 400,
      message: "No instanceId provided",
    });
  }

  await prisma.instance.update({
    where: {
      host: user.instance,
    },
    data: {
      allowed: {
        disconnect: {
          id: instanceId,
        },
      },
    },
  });

  return {
    message: "Instance removed from allowed list",
  };
});
