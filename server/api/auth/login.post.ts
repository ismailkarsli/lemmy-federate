import { Instance, PrismaClient, User } from "@prisma/client";
import { getGuarantees } from "@/lib/fediseer";
import { LemmyHttp } from "lemmy-js-client";
import { randomNumber, sendAuthCode } from "~/server/utils";
import jwt from "jsonwebtoken";
import ms from "ms";

const SECRET_KEY = process.env.SECRET_KEY;
const BLACKLISTED_INSTANCES =
  process.env.BLACKLISTED_INSTANCES?.split(",") || [];
if (!SECRET_KEY) {
  throw new Error("SECRET_KEY is required");
}

const prisma = new PrismaClient();

type ResponseType =
  | {
      user: Omit<User, "code" | "codeExp"> & {
        instance: Instance;
      };
      token: string;
    }
  | {
      message: string;
    };
export default defineEventHandler(async function (
  event
): Promise<ResponseType> {
  const body = await readBody(event);
  if (!body.username || !body.instance) {
    throw createError({
      statusCode: 400,
      message: "Username and instance are required",
    });
  }

  if (BLACKLISTED_INSTANCES.includes(body.instance)) {
    throw createError({
      statusCode: 403,
      message: "This instance is blacklisted",
    });
  }

  let instance = await prisma.instance.findFirst({
    where: {
      host: body.instance,
    },
  });
  if (!instance) {
    /**
     * Only allow instances that have guarantees in Fediseer
     */
    const guarantees = await getGuarantees(body.instance);
    if (!guarantees?.domains?.length) {
      throw createError({
        statusCode: 404,
        message: "No guarantees found for this instance",
      });
    }

    instance = await prisma.instance.create({
      data: {
        host: body.instance,
      },
    });
  }

  const lemmyClient = new LemmyHttp(`https://${body.instance}`);
  const siteView = await lemmyClient.getSite();
  const isAdmin = siteView.admins.some(
    ({ person }) =>
      person.name === body.username && !person.banned && !person.deleted
  );
  if (!isAdmin) {
    throw createError({
      statusCode: 403,
      message: "You are not an admin on this instance",
    });
  }

  if (body.code) {
    const user = await prisma.user.findUnique({
      where: {
        username_instanceId: {
          username: body.username,
          instanceId: instance.id,
        },
        code: body.code,
        codeExp: {
          gte: new Date(),
        },
      },
      include: {
        instance: true,
      },
    });
    if (!user) {
      throw createError({
        statusCode: 401,
        message: "Invalid code",
      });
    }

    const token = jwt.sign(
      {
        username: user.username,
        instance: user.instance.host,
        iss: "lemmy-federate",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor((Date.now() + ms("90 days")) / 1000),
        nbf: Math.floor(Date.now() / 1000),
      },
      SECRET_KEY
    );

    return {
      user,
      token,
    };
  }

  const code = randomNumber(8).toString();
  const codeExp = new Date(Date.now() + ms("5 minutes"));
  const user = await prisma.user.upsert({
    where: {
      username_instanceId: {
        username: body.username,
        instanceId: instance.id,
      },
    },
    update: {
      code,
      codeExp,
    },
    create: {
      username: body.username,
      instanceId: instance.id,
      code,
      codeExp,
    },
    include: {
      instance: true,
    },
  });

  await sendAuthCode(user.username, user.instance.host, code);

  return {
    message: `Code sent to @${body.username}@${body.instance}.`,
  };
});
