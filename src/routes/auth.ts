import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import jwt from "jsonwebtoken";
import ms from "ms";
import * as z from "zod/v4";
import { getGuarantees } from "../lib/fediseer.ts";
import { InstanceSchema, prisma } from "../lib/prisma.ts";
import {
	getDnsTxtRecords,
	getInstanceSoftware,
	isGenericAP,
	randomString,
} from "../lib/utils.ts";
import { type JWTInstance, publicProcedure, router } from "../trpc.ts";

const BLACKLISTED_INSTANCES =
	process.env.BLACKLISTED_INSTANCES?.split(",") || [];
const SECRET_KEY = process.env.SECRET_KEY;
const MASTER_KEY = process.env.MASTER_KEY;

if (!SECRET_KEY) {
	throw new Error("SECRET_KEY is required");
}

const ResponseTypeSchema = z.union([
	z.object({ instance: InstanceSchema }),
	z.object({ privateKey: z.string(), publicKey: z.string() }),
]);

export const authRouter = router({
	login: publicProcedure
		.input(
			z.object({
				instance: z.string(),
				apiKey: z.string().optional(),
			}),
		)
		.output(ResponseTypeSchema)
		.mutation(async ({ input: body, ctx }) => {
			const host = body.instance.toLowerCase();
			if (BLACKLISTED_INSTANCES.includes(host)) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "This instance is blacklisted",
				});
			}

			let instance = await prisma.instance.findFirst({
				where: { host },
				omit: { client_id: false, client_secret: false },
			});

			if (instance && body.apiKey) {
				const encoder = new TextEncoder();
				if (
					MASTER_KEY &&
					MASTER_KEY.length === body.apiKey.length &&
					crypto.timingSafeEqual(
						encoder.encode(MASTER_KEY),
						encoder.encode(body.apiKey),
					)
				) {
					// pass
				} else {
					const verification = await prisma.verification.findFirst({
						where: { instanceId: instance.id, privateKey: body.apiKey },
					});
					if (!verification) {
						throw new TRPCError({
							code: "UNAUTHORIZED",
							message: "Invalid api key",
						});
					}
					const txtRecords = await getDnsTxtRecords(host);
					const keyIsValid = txtRecords.find((r) =>
						r.includes(`lemmy-federate-verification=${verification.publicKey}`),
					);
					if (!keyIsValid) {
						throw new TRPCError({
							code: "UNAUTHORIZED",
							message:
								"DNS TXT record verification failed. The provided public key doesn't match any existing records. This may be due to DNS propagation delays—please wait for a while and try again.",
						});
					}
				}

				const valid = ms("90 days");
				const iat = Math.floor(Date.now() / 1000);
				const exp = Math.floor((Date.now() + valid) / 1000);
				const token = jwt.sign(
					{
						sub: instance.host,
						iss: "lemmy-federate",
						iat,
						exp,
						nbf: iat,
					} satisfies JWTInstance,
					SECRET_KEY,
				);
				ctx.setCookie("token", token, {
					maxAge: valid / 1000,
					httpOnly: true,
					sameSite: "strict",
					secure: ctx.protocol === "https",
				});

				return {
					instance,
				};
			}

			if (!instance) {
				const software = await getInstanceSoftware(host);
				const isGeneric = isGenericAP(software.name);

				try {
					const guaranteed =
						((await getGuarantees(host))?.domains?.length ?? 0) > 0;
					if (!guaranteed) throw new Error();
				} catch (e) {
					throw new TRPCError({
						code: "FORBIDDEN",
						message:
							"Your instance is not guaranteed in Fediseer. Please check fediseer.com",
					});
				}

				instance = await prisma.instance.create({
					data: {
						host,
						software: software.name,
						...(isGeneric
							? {
									auto_add: false,
									cross_software: true,
									mode: "SEED",
									nsfw: "BLOCK",
									fediseer: "NONE",
								}
							: {}),
					},
				});
			}

			const privateKey = randomString(16);
			const publicKey = crypto.randomBytes(16).toString("hex");
			await prisma.verification.create({
				data: { instanceId: instance.id, privateKey, publicKey },
			});
			return {
				privateKey,
				publicKey,
			};
		}),
	logout: publicProcedure.mutation(async ({ ctx }) => {
		ctx.setCookie("token", "", {
			maxAge: 0,
			httpOnly: true,
			sameSite: "strict",
			secure: ctx.protocol === "https",
		});
	}),
});
