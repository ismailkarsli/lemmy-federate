import { randomInt } from "node:crypto";
import { fileURLToPath } from "node:url";
import { TRPCError } from "@trpc/server";
import ky from "ky";
import typia from "typia";

type NodeInfoSoftware = {
	name: string;
	version: string;
};
type NodeInfoLinks = { links: { href: string; rel: string }[] };
type NodeInfo = {
	version: "2.1" | string;
	software: NodeInfoSoftware;
};

export const randomNumber = (length: number) => {
	/// 100000 -> 999999
	return randomInt(10 ** (length - 1), 10 ** length - 1);
};

const softwareCache = new Map<string, NodeInfoSoftware>();
export async function getInstanceSoftware(
	host: string,
): Promise<NodeInfoSoftware> {
	if (softwareCache.has(host))
		return softwareCache.get(host) as NodeInfoSoftware;
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
	const softwareName = nodeInfo.software.name.toUpperCase();
	if (!softwareName)
		throw new TRPCError({
			code: "CONFLICT",
			message: `Invalid app: ${nodeInfo.software.name}`,
		});
	const instanceSoftware: NodeInfoSoftware = {
		name: softwareName,
		version: nodeInfo.software.version,
	};
	softwareCache.set(host, instanceSoftware);
	return instanceSoftware;
}

// keep this function same with /frontend/src/lib/utils.ts
export function isGenericAP(name: string): boolean {
	switch (name.toLowerCase()) {
		case "lemmy":
		case "mbin":
			return false;
		default:
			return true;
	}
}

export function isMain(moduleUrl: string) {
	const modulePath = fileURLToPath(moduleUrl);
	const [_binPath, mainScriptPath] = process.argv;
	return modulePath === mainScriptPath;
}
