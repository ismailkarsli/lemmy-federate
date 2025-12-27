import { initTRPC, TRPCError } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import cookie, { type SerializeOptions } from "cookie";
import type { Context as HonoContext } from "hono";
import { KVCache } from "./lib/kv.ts";
import { getPrisma } from "./lib/prisma.ts";

export type JWTInstance = {
	sub: string; // instance host
	iss: "lemmy-federate";
	iat: number;
	exp: number;
	nbf: number;
};

// Simple JWT parsing without jsonwebtoken library (uses Web Crypto for Workers)
async function verifyJWT(token: string, secret: string): Promise<JWTInstance> {
	const [headerB64, payloadB64, signatureB64] = token.split(".");
	if (!headerB64 || !payloadB64 || !signatureB64) {
		throw new Error("Invalid token format");
	}

	// Decode payload
	const payload = JSON.parse(atob(payloadB64)) as JWTInstance;

	// Verify expiration
	const now = Math.floor(Date.now() / 1000);
	if (payload.exp && payload.exp < now) {
		throw new Error("Token expired");
	}
	if (payload.nbf && payload.nbf > now) {
		throw new Error("Token not yet valid");
	}

	// Verify signature using Web Crypto
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["verify"],
	);

	const signatureData = Uint8Array.from(
		atob(signatureB64.replace(/-/g, "+").replace(/_/g, "/")),
		(c) => c.charCodeAt(0),
	);
	const dataToVerify = encoder.encode(`${headerB64}.${payloadB64}`);

	const isValid = await crypto.subtle.verify(
		"HMAC",
		key,
		signatureData,
		dataToVerify,
	);
	if (!isValid) {
		throw new Error("Invalid signature");
	}

	return payload;
}

export async function signJWT(
	payload: JWTInstance,
	secret: string,
): Promise<string> {
	const header = { alg: "HS256", typ: "JWT" };
	const headerB64 = btoa(JSON.stringify(header))
		.replace(/=/g, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_");
	const payloadB64 = btoa(JSON.stringify(payload))
		.replace(/=/g, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_");

	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);

	const signature = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(`${headerB64}.${payloadB64}`),
	);
	const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
		.replace(/=/g, "")
		.replace(/\+/g, "-")
		.replace(/\//g, "_");

	return `${headerB64}.${payloadB64}.${signatureB64}`;
}

export async function createContext(
	{ req, resHeaders }: FetchCreateContextFnOptions,
	honoCtx?: HonoContext<{ Bindings: CloudflareBindings }>,
) {
	const env = honoCtx?.env;
	if (!env) {
		throw new Error("Environment bindings not available");
	}

	const SECRET_KEY = env.SECRET_KEY;
	if (!SECRET_KEY) throw new Error("SECRET_KEY is required");

	function getCookie(name: string) {
		const cookieHeader = req.headers.get("Cookie");
		if (!cookieHeader) return null;
		const cookies = cookie.parse(cookieHeader);
		return cookies[name];
	}
	function setCookie(name: string, value: string, options: SerializeOptions) {
		resHeaders.append("Set-Cookie", cookie.serialize(name, value, options));
	}
	const token = getCookie("token");
	let instance: JWTInstance | null = null;
	if (token) {
		try {
			instance = await verifyJWT(token, SECRET_KEY);
		} catch (_e) {
			setCookie("token", "", {
				maxAge: -1,
				httpOnly: true,
				sameSite: "strict",
				secure: req.headers.get("x-forwarded-proto") === "https",
			});
			throw new TRPCError({
				code: "UNAUTHORIZED",
				message: "Invalid token",
			});
		}
	}

	return {
		instance,
		getCookie,
		setCookie,
		protocol:
			req.headers.get("x-forwarded-proto") ||
			(req.url.startsWith("https") ? "https" : "http"),
		env,
		prisma: getPrisma(env),
		kv: new KVCache(env.CACHE),
	};
}
export type Context = Awaited<ReturnType<typeof createContext>>;
/**
 * Initialization of tRPC backend
 * Should be done only once per backend!
 */
const t = initTRPC.context<Context>().create();

/**
 * Export reusable router and procedure helpers
 * that can be used throughout the router
 */
export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
	if (!ctx.instance) {
		ctx.setCookie("token", "", {
			maxAge: -1,
			httpOnly: true,
			sameSite: "strict",
			secure: ctx.protocol === "https",
		});
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Unauthorized",
		});
	}

	return next({ ctx: { instance: ctx.instance } });
});
