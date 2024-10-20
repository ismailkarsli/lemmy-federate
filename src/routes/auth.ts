import { type Instance, PrismaClient, type User } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import jwt from "jsonwebtoken";
import ms from "ms";
import typia from "typia";
import { getGuarantees } from "../lib/fediseer";
import { getHttpClient, randomNumber, sendAuthCode } from "../lib/lemmy";
import { publicProcedure, router } from "../trpc";

const prisma = new PrismaClient();
const BLACKLISTED_INSTANCES =
	process.env.BLACKLISTED_INSTANCES?.split(",") || [];
const SECRET_KEY = process.env.SECRET_KEY;

if (!SECRET_KEY) {
	throw new Error("SECRET_KEY is required");
}

type ResponseType =
	| {
			user: Omit<User, "code" | "codeExp"> & {
				instance: Instance;
			};
	  }
	| {
			message: string;
	  };

export const authRouter = router({
	login: publicProcedure
		.input(
			typia.createAssert<{
				instance: string;
				username: string;
				code?: string;
			}>(),
		)
		.output(typia.createAssert<ResponseType>())
		.mutation(async ({ input: body, ctx }) => {
			const host = body.instance.toLowerCase();
			if (BLACKLISTED_INSTANCES.includes(host)) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "This instance is blacklisted",
				});
			}

			/**
			 * Only allow instances that have guarantees in Fediseer
			 */
			const guarantees = await getGuarantees(host);
			if (!guarantees?.domains?.length) {
				throw new TRPCError({
					code: "CONFLICT",
					message: "No guarantees found for this instance",
				});
			}

			const lemmyClient = await getHttpClient(host);
			const siteView = await lemmyClient.getSite();
			const isAdmin = siteView.admins.some(
				({ person }) =>
					person.name === body.username && !person.banned && !person.deleted,
			);
			if (!isAdmin) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "You are not an admin on this instance",
				});
			}

			let instance = await prisma.instance.findFirst({ where: { host: host } });
			if (!instance) {
				instance = await prisma.instance.create({ data: { host } });
			}

			if (body.code) {
				const user = await prisma.user.findUnique({
					where: {
						username_instanceId: {
							username: body.username,
							instanceId: instance.id,
						},
						code: body.code,
						codeExp: {
							gte: new Date(),
						},
					},
					include: {
						instance: true,
					},
				});
				if (!user) {
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
						username: user.username,
						instance: user.instance.host,
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
					user,
				};
			}

			const code = randomNumber(8).toString();
			const codeExp = new Date(Date.now() + ms("5 minutes"));
			const user = await prisma.user.upsert({
				where: {
					username_instanceId: {
						username: body.username,
						instanceId: instance.id,
					},
				},
				update: {
					code,
					codeExp,
				},
				create: {
					username: body.username,
					instanceId: instance.id,
					code,
					codeExp,
				},
				include: {
					instance: true,
				},
			});

			await sendAuthCode(user.username, user.instance.host, code);

			return {
				message: `Code sent to @${body.username}@${host}.`,
			};
		}),
});
