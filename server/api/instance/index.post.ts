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
  const instance = await prisma.instance.update({
    where: {
      host: user.instance,
      id: body.id,
    },
    data: {
      enabled: body.enabled,
      nsfw: body.nsfw,
      auto_add: body.auto_add,
      fediseer: body.fediseer,
      bot_name: body.bot_name,
      bot_pass: body.bot_pass,
    },
  });

  return instance;
});
