import { LemmyHttp } from "lemmy-js-client";
import { randomInt } from "node:crypto";

const BOT_INSTANCE = process.env.BOT_INSTANCE;
const BOT_USERNAME = process.env.BOT_USERNAME;
const BOT_PASSWORD = process.env.BOT_PASSWORD;
if (!BOT_INSTANCE || !BOT_USERNAME || !BOT_PASSWORD) {
  throw new Error("BOT_INSTANCE, BOT_USERNAME, and BOT_PASSWORD are required");
}

export const randomNumber = (length: number) => {
  /// 100000 -> 999999
  return randomInt(Math.pow(10, length - 1), Math.pow(10, length) - 1);
};

export const sendAuthCode = async (
  username: string,
  instance: string,
  code: string
) => {
  const lemmyClient = new LemmyHttp(`https://${BOT_INSTANCE}`);
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
  // This function is not working. We'll use direct API call instead.
  // await lemmyClient.createPrivateMessage({
  //   content: message,
  //   recipient_id: person.id,
  // });
  await $fetch(`https://${BOT_INSTANCE}/api/v3/private_message`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${loginRes.jwt}`,
    },
    body: JSON.stringify({
      recipient_id: person.id,
      content: message,
    }),
  });
};
