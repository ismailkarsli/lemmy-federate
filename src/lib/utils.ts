import { randomInt } from "node:crypto";
import ky from "ky";
import typia from "typia";

type Software = {
	name: "lemmy" | "mbin";
	version: string;
};
type NodeInfoLinks = { links: { href: string; rel: string }[] };
type NodeInfo = {
	version: "2.1" | string;
	software: Software;
};

export const randomNumber = (length: number) => {
	/// 100000 -> 999999
	return randomInt(10 ** (length - 1), 10 ** length - 1);
};

export async function getInstanceSoftware(host: string) {
	const nodeInfoLinks = await ky<NodeInfoLinks>(
		`https://${host}/.well-known/nodeinfo`,
	)
		.json()
		.then(typia.createAssert<NodeInfoLinks>());
	if (nodeInfoLinks.links.length === 0) {
		throw new Error("No nodeinfo links found");
	}
	const preferredNodeInfoLink =
		nodeInfoLinks.links.find(
			({ rel }) => rel === "http://nodeinfo.diaspora.software/ns/schema/2.1",
		) || nodeInfoLinks.links[0];
	const nodeInfo = await ky<NodeInfo>(preferredNodeInfoLink.href)
		.json()
		.then(typia.createAssert<NodeInfo>());
	return nodeInfo.software;
}