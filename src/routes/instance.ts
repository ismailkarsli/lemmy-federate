import { type Instance, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import typia from "typia";
import { resetSubscriptions } from "../lib/federation-utils";
import { MbinClient } from "../lib/mbin";
import { protectedProcedure, publicProcedure, router } from "../trpc";

interface FindArgs {
	take?: number;
	skip?: number;
	enabledOnly?: boolean;
}
const prisma = new PrismaClient();

export const instanceRouter = router({
	get: protectedProcedure.query(async ({ ctx }) => {
		const instance = await prisma.instance.findFirst({
			where: {
				host: ctx.user.instance,
			},
			include: {
				allowed: {
					select: {
						id: true,
						host: true,
					},
				},
			},
		});

		return instance;
	}),
	update: protectedProcedure
		.input(typia.createAssert<Instance & { id: number }>())
		.mutation(async ({ input, ctx }) => {
			const instance = await prisma.instance.update({
				where: {
					host: ctx.user.instance,
					id: input.id,
				},
				data: {
					enabled: input.enabled,
					nsfw: input.nsfw,
					auto_add: input.auto_add,
					fediseer: input.fediseer,
					client_id: input.client_id || null,
					client_secret: input.client_secret || null,
					mode: input.mode,
					software: input.software,
					cross_software: input.cross_software,
				},
			});

			if (input.enabled === false) {
				await prisma.community.deleteMany({
					where: {
						instance,
					},
				});
			}

			return instance;
		}),
	find: publicProcedure
		.input(typia.createAssert<FindArgs | undefined>())
		.query(async ({ input }) => {
			const skip = input?.skip
				? Number.parseInt(input.skip.toString())
				: undefined;
			const take = input?.take
				? Number.parseInt(input.take.toString())
				: undefined;
			const [instances, total] = await prisma.$transaction([
				prisma.instance.findMany({
					select: {
						id: true,
						host: true,
						enabled: true,
						auto_add: true,
					},
					skip,
					take,
					orderBy: [{ enabled: "desc" }, { id: "asc" }],
					where: input?.enabledOnly ? { enabled: true } : undefined,
				}),
				prisma.instance.count(),
			]);
			return {
				instances,
				total,
			};
		}),
	createOauthClient: protectedProcedure.mutation(async ({ ctx }) => {
		const instance = await prisma.instance.findFirst({
			where: { host: ctx.user.instance },
		});
		if (!instance) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Instance not found",
			});
		}
		if (instance.software !== "MBIN") {
			throw new TRPCError({
				code: "BAD_REQUEST",
				message: "Only Mbin instances can create OAuth client",
			});
		}

		const oauthClient = await MbinClient.getMbinOauthClient(instance.host);
		await prisma.instance.update({
			where: { id: instance.id },
			data: {
				client_id: oauthClient.identifier,
				client_secret: oauthClient.secret,
			},
		});

		return { message: "OAuth client successfuly created." };
	}),
	resetSubscriptions: protectedProcedure.query(async ({ ctx }) => {
		const instance = await prisma.instance.findFirst({
			where: {
				host: ctx.user.instance,
			},
		});

		if (!instance) {
			throw new TRPCError({
				code: "NOT_FOUND",
				message: "Instance not found",
			});
		}

		resetSubscriptions(instance);

		return {
			message: "Started resetting subscriptions. This may take a while.",
		};
	}),
	allowed: router({
		add: protectedProcedure
			.input(typia.createAssert<{ instanceId: number }>())
			.mutation(async ({ ctx, input }) => {
				await prisma.instance.update({
					where: {
						host: ctx.user.instance,
					},
					data: {
						allowed: {
							connect: {
								id: input.instanceId,
							},
						},
					},
				});

				return {
					message: "Instance added to allowed list",
				};
			}),
		delete: protectedProcedure
			.input(typia.createAssert<{ instanceId: number }>())
			.mutation(async ({ ctx, input }) => {
				await prisma.instance.update({
					where: {
						host: ctx.user.instance,
					},
					data: {
						allowed: {
							disconnect: {
								id: input.instanceId,
							},
						},
					},
				});

				return {
					message: "Instance removed from allowed list",
				};
			}),
	}),
});
