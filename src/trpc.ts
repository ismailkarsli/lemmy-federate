import { initTRPC, TRPCError } from "@trpc/server";
import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import cookie, { type SerializeOptions } from "cookie";
import jwt from "jsonwebtoken";

export type JWTInstance = {
	sub: string; // instance host
	iss: "lemmy-federate";
	iat: number;
	exp: number;
	nbf: number;
};

// biome-ignore lint/style/noNonNullAssertion: we're checking it already
const SECRET_KEY = process.env.SECRET_KEY!;
if (!SECRET_KEY) throw new Error("SECRET_KEY is required");

export async function createContext({
	req,
	resHeaders,
}: FetchCreateContextFnOptions) {
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
			instance = jwt.verify(token, SECRET_KEY) as JWTInstance;
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
	};
}
type Context = Awaited<ReturnType<typeof createContext>>;
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
