import { randomInt } from "node:crypto";
import { fileURLToPath } from "node:url";
import ky from "ky";
import typia from "typia";
import type { Software } from "@prisma/client";
import { TRPCError } from "@trpc/server";

type InstanceSoftware = {
	name: Software;
	version: string;
};
type NodeInfoSoftware = {
	name: "lemmy" | "mbin" | "dch_blog";
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

const softwareCache = new Map<string, InstanceSoftware>();
export async function getInstanceSoftware(
	host: string,
): Promise<InstanceSoftware> {
	if (softwareCache.has(host))
		return softwareCache.get(host) as InstanceSoftware;
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
	const softwareName =
		nodeInfo.software.name === "lemmy"
			? "LEMMY"
			: nodeInfo.software.name === "mbin"
				? "MBIN"
				: nodeInfo.software.name === "dch_blog"
					? "DCH_BLOG"
					: null;
	if (!softwareName)
		throw new TRPCError({
			code: "CONFLICT",
			message: `Invalid app: ${nodeInfo.software.name}`,
		});
	const instanceSoftware: InstanceSoftware = {
		name: softwareName,
		version: nodeInfo.software.version,
	};
	softwareCache.set(host, instanceSoftware);
	return instanceSoftware;
}

export function isMain(moduleUrl: string) {
	const modulePath = fileURLToPath(moduleUrl);
	const [_binPath, mainScriptPath] = process.argv;
	return modulePath === mainScriptPath;
}
