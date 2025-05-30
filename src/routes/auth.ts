import type { Instance } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import jwt from "jsonwebtoken";
import ms from "ms";
import * as z from "zod/v4";
import { getClient, sendAuthCode } from "../lib/federation-utils.ts";
import { getGuarantees } from "../lib/fediseer.ts";
import { InstanceSchema, UserSchema, prisma } from "../lib/prisma.ts";
import {
	getInstanceSoftware,
	isGenericAP,
	randomNumber,
} from "../lib/utils.ts";
import { publicProcedure, router } from "../trpc.ts";

const BLACKLISTED_INSTANCES =
	process.env.BLACKLISTED_INSTANCES?.split(",") || [];
const SECRET_KEY = process.env.SECRET_KEY;

if (!SECRET_KEY) {
	throw new Error("SECRET_KEY is required");
}

const ResponseTypeSchema = z.union([
	z.object({
		user: UserSchema.omit({ code: true, codeExp: true }).extend({
			instance: InstanceSchema,
		}),
	}),
	z.object({ message: z.string() }),
]);

export const authRouter = router({
	login: publicProcedure
		.input(
			z.object({
				instance: z.string(),
				username: z.string(),
				code: z.string().optional(),
			}),
		)
		.output(ResponseTypeSchema)
		.mutation(async ({ input: body, ctx }) => {
			const host = body.instance.toLowerCase();
			const username = body.username.toLowerCase();
			if (BLACKLISTED_INSTANCES.includes(host)) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "This instance is blacklisted",
				});
			}

			const existingUser = await prisma.user.findFirst({
				where: { instance: { host }, username },
				include: {
					instance: { omit: { client_id: false, client_secret: false } },
				},
			});

			if (existingUser && body.code) {
				if (
					body.code !== existingUser.code ||
					existingUser.codeExp < new Date()
				) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "Invalid code",
					});
				}

				const valid = ms("90 days");
				const iat = Math.floor(Date.now() / 1000);
				const exp = Math.floor((Date.now() + valid) / 1000);
				const token = jwt.sign(
					{
						username: existingUser.username,
						instance: existingUser.instance.host,
						iss: "lemmy-federate",
						iat,
						exp,
						nbf: iat,
					},
					SECRET_KEY,
				);
				ctx.setCookie("token", token, {
					maxAge: valid / 1000,
					httpOnly: true,
					sameSite: "strict",
					secure: ctx.protocol === "https",
				});

				return {
					user: existingUser,
				};
			}

			let createdInstance: Instance | null = null;
			if (!existingUser) {
				const software = await getInstanceSoftware(host);
				const isGeneric = isGenericAP(software.name);
				const client = await getClient({
					host,
					software: software.name,
					client_id: null,
					client_secret: null,
				});
				const user_ = await client.getUser(username);
				const canLogin = user_.isAdmin && !user_.isBanned;
				if (!canLogin) {
					// if we can't verify user is an admin and it's a generic ActivityPub instance, return specific message for that.
					if (isGeneric) {
						throw new TRPCError({
							code: "CONFLICT",
							message:
								"We were unable to verify that you are an admin. Please contact to iso@lemy.lol for manual registration.",
						});
					}
					throw new TRPCError({
						code: "FORBIDDEN",
						message: "You are not an admin on this instance",
					});
				}

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

				createdInstance = await prisma.instance.findFirst({ where: { host } });
				if (!createdInstance) {
					createdInstance = await prisma.instance.create({
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
			}

			const instanceId = createdInstance?.id || existingUser?.instanceId;
			if (!instanceId) {
				throw new Error("instanceId is null. it should be impossible.");
			}
			const code = randomNumber(8).toString();
			const codeExp = new Date(Date.now() + ms("5 minutes"));
			await prisma.user.upsert({
				where: {
					username_instanceId: { username, instanceId },
				},
				update: { code, codeExp },
				create: {
					username,
					instanceId,
					code,
					codeExp,
				},
			});

			await sendAuthCode(username, host, code);

			return { message: `Code sent to @${username}@${host}.` };
		}),
});
