import { TRPCError } from "@trpc/server";
import ky from "ky";
import * as z from "zod/v4";

const NodeInfoSoftwareSchema = z.object({
	name: z.string(),
	version: z.string(),
});
const NodeInfoSchema = z.object({
	software: NodeInfoSoftwareSchema,
	version: z.union([z.literal("2.1"), z.string()]),
});
const NodeInfoLinksSchema = z.object({
	links: z.array(
		z.object({
			href: z.string(),
			rel: z.string(),
		}),
	),
});
type NodeInfoLinks = z.infer<typeof NodeInfoLinksSchema>;
type NodeInfoSoftware = z.infer<typeof NodeInfoSoftwareSchema>;
type NodeInfo = z.infer<typeof NodeInfoSchema>;

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
		.then((l) => z.parse(NodeInfoLinksSchema, l));
	if (nodeInfoLinks.links.length === 0) {
		throw new Error("No nodeinfo links found");
	}
	const preferredNodeInfoLink =
		nodeInfoLinks.links.find(
			({ rel }) => rel === "http://nodeinfo.diaspora.software/ns/schema/2.1",
		) || nodeInfoLinks.links[0];
	const nodeInfo = await ky<NodeInfo>(preferredNodeInfoLink.href)
		.json()
		.then((ni) => z.parse(NodeInfoSchema, ni));
	const softwareName = nodeInfo.software.name;
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

interface DNSResponse {
	Answer: { data: string }[];
}
export async function getDnsTxtRecords(domain: string) {
	const googleURL = `https://dns.google/resolve?name=${domain}&type=TXT`;
	const cloudflareURL = `https://cloudflare-dns.com/dns-query?name=${domain}&type=TXT`;
	const [googleRes, cloudflareRes] = await Promise.all([
		ky.get<DNSResponse>(googleURL).json(),
		ky
			.get<DNSResponse>(cloudflareURL, {
				headers: { Accept: "application/dns-json" },
			})
			.json(),
	]);
	const merged = [...googleRes.Answer, ...cloudflareRes.Answer];
	const records = Array.from(new Set(merged.map((r) => r.data)));
	return records;
}

// Web Crypto API compatible random string generator
export function randomString(length: number) {
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+[]{}|;:,.<>?";
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	let result = "";
	for (let i = 0; i < length; i++) {
		result += chars[bytes[i] % chars.length];
	}
	return result;
}

// Constant-time comparison for security-sensitive comparisons
export function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	const encoder = new TextEncoder();
	const aBytes = encoder.encode(a);
	const bBytes = encoder.encode(b);
	let result = 0;
	for (let i = 0; i < aBytes.length; i++) {
		result |= aBytes[i] ^ bBytes[i];
	}
	return result === 0;
}
