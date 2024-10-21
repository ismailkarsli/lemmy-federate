import { getClient } from "./lib/federation-utils";

const client = await getClient("lemy.lol");

const user = await client.getUser("iso");
console.log(user);

const client2 = await getClient("fedia.io");
const user2 = await client2.getUser("ismail");
console.log(user2);
